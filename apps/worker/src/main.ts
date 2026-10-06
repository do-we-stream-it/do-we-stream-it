import { connectWorkerRepositories } from './persistence.js';
import { scrapeNetflix } from './netflix.js';
import { startWorker } from './runtime.js';

async function main() {
  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error('MONGO_URI is required. Copy apps/worker/.env.example to apps/worker/.env and configure issue #1 infrastructure.');
  const persistence = await connectWorkerRepositories({
    uri, database: process.env.MONGO_DATABASE ?? 'netflix-releases',
    packageName: process.env.WORKER_DATA_PACKAGE ?? '@do-we-stream-it/data',
  });
  let runtime: Awaited<ReturnType<typeof startWorker>>;
  try {
    runtime = await startWorker({
      redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
      repositories: persistence.repositories, scrape: scrapeNetflix,
    });
  } catch (error) {
    await persistence.close();
    throw error;
  }
  let stopping = false;
  async function shutdown(signal: string) {
    if (stopping) return;
    stopping = true;
    console.log(JSON.stringify({ level: 'info', event: 'worker.stopping', signal }));
    try { await runtime.close(); }
    catch (error) { console.error(error); process.exitCode = 1; }
    finally { await persistence.close(); }
  }
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => void shutdown(signal).catch((error: unknown) => {
      console.error(error); process.exitCode = 1;
    }));
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
