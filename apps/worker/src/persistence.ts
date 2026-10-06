import type { WorkerRepositories } from './types.js';

interface DataModule {
  connectMongo(config: { uri: string; database: string }): Promise<unknown>;
  initializeMongoSchema(db: unknown): Promise<void>;
  closeMongo(): Promise<void>;
  JobRepository: new (db: unknown) => WorkerRepositories['jobs'];
  ReleaseRepository: new (db: unknown) => WorkerRepositories['releases'];
}

export interface PersistenceConfig {
  uri: string;
  database: string;
  packageName?: string;
}

export async function connectWorkerRepositories(
  config: PersistenceConfig,
  loadModule?: () => Promise<unknown>,
): Promise<{ repositories: WorkerRepositories; close: () => Promise<void> }> {
  const packageName = config.packageName ?? '@do-we-stream-it/data';
  let value: unknown;
  try {
    // Variable import intentionally allows #2 to build before the data
    // workspace from #1 exists. No repository implementation is duplicated.
    value = await (loadModule ? loadModule() : import(packageName));
  } catch (cause) {
    throw new Error(`Cannot load ${packageName}. Integrate the data workspace from issue #1 and run npm install first.`, { cause });
  }
  const exports = value as Partial<DataModule> | null;
  if (!exports || ['connectMongo', 'initializeMongoSchema', 'closeMongo', 'JobRepository', 'ReleaseRepository']
    .some((key) => typeof (exports as Record<string, unknown>)[key] !== 'function')) {
    throw new Error(`The data workspace ${packageName} does not expose the agreed repository interface.`);
  }
  const data = exports as DataModule;
  try {
    const db = await data.connectMongo({ uri: config.uri, database: config.database });
    await data.initializeMongoSchema(db);
    const repositories: WorkerRepositories = {
      jobs: new data.JobRepository(db), releases: new data.ReleaseRepository(db),
    };
    for (const method of ['findById', 'markRunning', 'markSucceeded', 'markFailed'] as const) {
      if (typeof repositories.jobs[method] !== 'function') throw new Error(`JobRepository.${method} is required by the worker.`);
    }
    if (typeof repositories.releases.upsert !== 'function') throw new Error('ReleaseRepository.upsert is required by the worker.');
    return { repositories, close: () => data.closeMongo() };
  } catch (error) {
    await data.closeMongo().catch(() => {});
    throw error;
  }
}
