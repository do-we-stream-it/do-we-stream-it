import { Queue, Worker } from 'bullmq';
import type { Job, WorkerOptions } from 'bullmq';
import { redisConnection, SCRAPER_QUEUE_NAME, validateScraperJobPayload } from '@do-we-stream-it/scraper-queue';
import type { ScraperJobPayload } from '@do-we-stream-it/scraper-queue';
import { publicFailure } from './errors.js';
import { createProcessor } from './processor.js';
import type { Log, Scrape, WorkerRepositories } from './types.js';

export interface WorkerRuntimeOptions {
  redisUrl: string;
  queueName?: string;
  repositories: WorkerRepositories;
  scrape: Scrape;
  log?: Log;
  reconciliationIntervalMs?: number;
  workerOptions?: Pick<WorkerOptions, 'lockDuration' | 'stalledInterval' | 'maxStalledCount'>;
}

export async function startWorker(options: WorkerRuntimeOptions) {
  const log: Log = options.log ?? ((entry) => console.log(JSON.stringify(entry)));
  const connection = { ...redisConnection(options.redisUrl), maxRetriesPerRequest: null };
  const name = options.queueName ?? SCRAPER_QUEUE_NAME;
  const queue = new Queue<ScraperJobPayload>(name, { connection });
  const worker = new Worker<ScraperJobPayload>(name,
    createProcessor(options.repositories, options.scrape, log),
    { connection, concurrency: 1, autorun: false, ...options.workerOptions },
  );
  const pending = new Set<Promise<void>>();

  async function persistFailure(job: Job<ScraperJobPayload>, reason: string) {
    try { validateScraperJobPayload(job.data); }
    catch { log({ level: 'error', event: 'job.invalid', jobId: job.id }); return; }
    const stored = await options.repositories.jobs.findById(job.data.jobId);
    if (
      stored && stored.id === job.id && stored.date === job.data.date &&
      stored.country === job.data.country && ['queued', 'running'].includes(stored.status)
    ) {
      await options.repositories.jobs.markFailed(stored.id, publicFailure(reason));
      log({ level: 'error', event: 'job.failed', jobId: stored.id, code: publicFailure(reason).code });
    }
  }

  function track(operation: Promise<void>) {
    const safe = operation.catch((error: unknown) => {
      log({ level: 'error', event: 'failure.persistence', message: error instanceof Error ? error.message : String(error) });
    });
    pending.add(safe);
    void safe.then(() => pending.delete(safe));
  }

  async function reconcileFailedJobs() {
    for (let offset = 0; ; offset += 100) {
      const failed = await queue.getFailed(offset, offset + 99);
      for (const job of failed) await persistFailure(job, job.failedReason);
      if (failed.length < 100) break;
    }
  }

  let reconciliation: Promise<void> | undefined;
  function reconcile() {
    if (reconciliation) return reconciliation;
    reconciliation = reconcileFailedJobs().finally(() => { reconciliation = undefined; });
    return reconciliation;
  }

  const reportError = (error: Error) => log({ level: 'error', event: 'queue.error', message: error.message });
  worker.on('error', reportError);
  queue.on('error', reportError);
  worker.on('failed', (job, error) => {
    if (!job) return;
    log({ level: 'warn', event: 'job.attempt.failed', jobId: job.id, attempt: job.attemptsMade });
    track((async () => {
      if (await job.getState() === 'failed') await persistFailure(job, error.message);
    })());
  });

  try {
    await worker.waitUntilReady();
    await queue.waitUntilReady();
    // Covers failures caused by stalled jobs and a process dying before its
    // terminal event could be recorded in MongoDB.
    await reconcile();
  } catch (error) {
    await Promise.allSettled([worker.close(), queue.close()]);
    throw error;
  }
  const running = worker.run().catch(reportError);
  const timer = setInterval(() => track(reconcile()), options.reconciliationIntervalMs ?? 10000);
  timer.unref();
  log({ level: 'info', event: 'worker.ready', queue: name });

  let closing: Promise<void> | undefined;
  return {
    worker,
    async close(): Promise<void> {
      closing ??= (async () => {
        clearInterval(timer);
        // Wait for active work before the caller closes the MongoDB client.
        await worker.close();
        await running;
        await Promise.all(pending);
        await queue.close();
      })();
      await closing;
    },
  };
}
