import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';
import type { TestContext } from 'node:test';
import { Queue } from 'bullmq';
import { createScraperQueue, redisConnection } from '@do-we-stream-it/scraper-queue';
import type { ScraperJobPayload } from '@do-we-stream-it/scraper-queue';
import { startWorker } from '../../src/runtime.js';
import { ScraperError } from '../../src/errors.js';
import { fakeStore, releaseFor, waitFor } from '../helpers.js';
import type { Scrape, WorkerRepositories } from '../../src/types.js';

const redisUrl = process.env.REDIS_TEST_URL;
if (!redisUrl) throw new Error('Set REDIS_TEST_URL to a running test Redis, e.g. redis://127.0.0.1:16379. These tests use real Redis and mock only issue #1 repositories.');

function environment(t: TestContext) {
  const queueName = `test-netflix-${randomUUID()}`;
  const producer = createScraperQueue({ redisUrl: redisUrl!, queueName, backoffDelay: 10 });
  const queue = new Queue<ScraperJobPayload>(queueName, { connection: { ...redisConnection(redisUrl!), maxRetriesPerRequest: 1 } });
  queue.on('error', () => {});
  const runtimes: Awaited<ReturnType<typeof startWorker>>[] = [];
  t.after(async () => {
    for (const runtime of runtimes) await runtime.close();
    await producer.close();
    await queue.obliterate({ force: true });
    await queue.close();
  });
  return {
    producer, queue, queueName,
    async start(repositories: WorkerRepositories, scrape: Scrape) {
      const runtime = await startWorker({
        redisUrl: redisUrl!, queueName, repositories, scrape, log: () => {},
        reconciliationIntervalMs: 30,
        workerOptions: { lockDuration: 500, stalledInterval: 500 },
      });
      runtimes.push(runtime);
      return runtime;
    },
  };
}

test('queued work survives producer shutdown and succeeds after worker start', { timeout: 15000 }, async (t) => {
  const env = environment(t), store = fakeStore();
  await env.producer.enqueueScraperJob(store.payload);
  await env.producer.close();
  assert.equal((await env.queue.getJob(store.payload.jobId))?.data.jobId, store.payload.jobId);
  await env.start(store.repositories, async () => [releaseFor(store.payload)]);
  await waitFor(() => store.stored.status === 'succeeded');
  assert.equal(store.stored.releaseCount, 1);
  assert.equal(store.releases.size, 1);
});

test('temporary source failures get exactly three attempts and no premature failed state', { timeout: 15000 }, async (t) => {
  const env = environment(t), store = fakeStore();
  let attempts = 0;
  await env.start(store.repositories, async () => {
    attempts++;
    if (attempts < 3) throw new ScraperError('SOURCE_UNAVAILABLE');
    return [releaseFor(store.payload)];
  });
  await env.producer.enqueueScraperJob(store.payload);
  await waitFor(() => store.stored.status === 'succeeded');
  assert.equal(attempts, 3);
  assert.ok(!store.events.includes('failed'));
});

test('final source failure is persisted, with no fourth attempt', { timeout: 15000 }, async (t) => {
  const env = environment(t), store = fakeStore();
  let attempts = 0;
  await env.start(store.repositories, async () => { attempts++; throw new ScraperError('SOURCE_PARSE_FAILED'); });
  await env.producer.enqueueScraperJob(store.payload);
  await waitFor(() => store.stored.status === 'failed');
  assert.equal(attempts, 3);
  assert.equal(store.stored.error?.code, 'SOURCE_PARSE_FAILED');
  assert.equal(await (await env.queue.getJob(store.payload.jobId))?.getState(), 'failed');
});

test('failure persistence is reconciled after MongoDB outage and worker restart', { timeout: 15000 }, async (t) => {
  const env = environment(t), store = fakeStore();
  const markFailed = store.repositories.jobs.markFailed;
  let unavailable = true;
  store.repositories.jobs.markFailed = async (...args) => {
    if (unavailable) throw new Error('Test database unavailable');
    return markFailed(...args);
  };
  const first = await env.start(store.repositories, async () => { throw new ScraperError('SOURCE_UNAVAILABLE'); });
  await env.producer.enqueueScraperJob(store.payload);
  await waitFor(async () => await (await env.queue.getJob(store.payload.jobId))?.getState() === 'failed');
  await first.close();
  assert.equal(store.stored.status, 'running');
  unavailable = false;
  await env.start(store.repositories, async () => { throw new Error('Must not rerun failed queue work'); });
  await waitFor(() => store.stored.status === 'failed');
  assert.equal(store.stored.error?.code, 'SOURCE_UNAVAILABLE');
});

test('duplicate delivery is deduplicated, and terminal database jobs guard against replay', { timeout: 15000 }, async (t) => {
  const env = environment(t), store = fakeStore();
  let scrapes = 0;
  await env.start(store.repositories, async () => { scrapes++; return [releaseFor(store.payload)]; });
  await env.producer.enqueueScraperJob(store.payload);
  await env.producer.enqueueScraperJob(store.payload);
  await waitFor(() => store.stored.status === 'succeeded');
  await waitFor(async () => await (await env.queue.getJob(store.payload.jobId))?.getState() === 'completed');
  assert.equal(scrapes, 1);
  await assert.rejects(env.producer.enqueueScraperJob({ ...store.payload, date: '2026-10-03' }), /different request/);
  await (await env.queue.getJob(store.payload.jobId))?.remove();
  await env.producer.enqueueScraperJob(store.payload);
  await waitFor(async () => await (await env.queue.getJob(store.payload.jobId))?.getState() === 'completed');
  assert.equal(scrapes, 1);
  assert.equal(store.releases.size, 1);
});

test('a new UUID creates a new run while release upserts stay idempotent', { timeout: 15000 }, async (t) => {
  const env = environment(t), first = fakeStore(), second = fakeStore();
  const repositories: WorkerRepositories = {
    jobs: Object.fromEntries(Object.keys(first.repositories.jobs).map((method) => [method, async (id: string, ...args: unknown[]) => {
      const target = id === first.payload.jobId ? first : second;
      return (target.repositories.jobs[method as keyof WorkerRepositories['jobs']] as (...values: unknown[]) => Promise<unknown>)(id, ...args);
    }])) as unknown as WorkerRepositories['jobs'],
    releases: first.repositories.releases,
  };
  let scrapes = 0;
  await env.start(repositories, async (payload) => { scrapes++; return [releaseFor(payload)]; });
  await env.producer.enqueueScraperJob(first.payload);
  await env.producer.enqueueScraperJob(second.payload);
  await waitFor(() => second.stored.status === 'succeeded');
  assert.equal(scrapes, 2);
  assert.equal(first.releases.size, 1);
});

test('empty successful scrapes persist releaseCount zero', { timeout: 15000 }, async (t) => {
  const env = environment(t), store = fakeStore();
  await env.start(store.repositories, async () => []);
  await env.producer.enqueueScraperJob(store.payload);
  await waitFor(() => store.stored.status === 'succeeded');
  assert.equal(store.stored.releaseCount, 0);
});

test('a hard-killed worker leaves recoverable work in Redis', { timeout: 20000 }, async (t) => {
  const env = environment(t), store = fakeStore();
  await env.producer.enqueueScraperJob(store.payload);
  const child = fork(new URL('./fixtures/crash-worker.ts', import.meta.url), [], {
    execArgv: ['--import', 'tsx'],
    env: { ...process.env, TEST_QUEUE_NAME: env.queueName, JOB_PAYLOAD: JSON.stringify(store.payload) },
    stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
  });
  let errors = '';
  child.stderr?.on('data', (chunk) => { errors += String(chunk); });
  t.after(() => { if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL'); });
  await Promise.race([
    once(child, 'message'),
    once(child, 'exit').then(() => { throw new Error(`Crash worker exited early: ${errors}`); }),
  ]);
  const exited = once(child, 'exit');
  child.kill('SIGKILL');
  await exited;
  // In production #1 keeps this state in MongoDB across the process crash.
  store.stored.status = 'running';
  await env.start(store.repositories, async () => [releaseFor(store.payload)]);
  await waitFor(() => store.stored.status === 'succeeded');
  assert.equal(store.releases.size, 1);
});

test('an unavailable Redis rejects enqueue instead of reporting a successful start', { timeout: 10000 }, async () => {
  const producer = createScraperQueue({ redisUrl: 'redis://127.0.0.1:1' });
  try { await assert.rejects(producer.enqueueScraperJob(fakeStore().payload)); }
  finally { await producer.close(); }
});
