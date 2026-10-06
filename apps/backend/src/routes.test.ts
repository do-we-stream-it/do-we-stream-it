import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { buildApp } from './app.js';
import type { Dependencies, JobDto, Queue, ReleaseDto, ScraperJobMessage } from './contracts.js';
import { InMemoryRepository } from './mock/memory-repository.js';

class RecordingQueue implements Queue {
  messages: ScraperJobMessage[] = [];
  fail = false;
  async enqueueScraperJob(message: ScraperJobMessage) {
    if (this.fail) throw new Error('redis down');
    this.messages.push(message);
  }
  async close() {}
}

const release = (id: string, title: string, date = '2026-05-01', country = 'DE'): ReleaseDto => ({
  id, title, date, country, type: 'movie', platform: 'Netflix',
});

describe('API', () => {
  let repository: InMemoryRepository;
  let queue: RecordingQueue;
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    repository = new InMemoryRepository();
    queue = new RecordingQueue();
    const dependencies: Dependencies = { repository, queue };
    app = buildApp({ dependencies, logger: false });
  });

  const start = (payload?: unknown) => app.inject({ method: 'POST', url: '/api/scraper/jobs', ...(payload === undefined ? {} : { payload: payload as object }) });

  it('keeps the health endpoint', async () => {
    assert.equal((await app.inject('/api/health')).statusCode, 200);
  });

  it('starts jobs with defaults and enqueues each one', async () => {
    const a = await start();
    const b = await start({ date: '2026-05-01', country: 'de' });
    assert.equal(a.statusCode, 202);
    assert.equal(b.statusCode, 202);
    const jobA = a.json().job as JobDto;
    const jobB = b.json().job as JobDto;
    assert.notEqual(jobA.id, jobB.id);
    assert.equal(jobA.date, new Date().toISOString().slice(0, 10));
    assert.equal(jobA.country, 'DE');
    assert.equal(jobA.status, 'queued');
    assert.deepEqual(queue.messages, [
      { jobId: jobA.id, date: jobA.date, country: 'DE' },
      { jobId: jobB.id, date: '2026-05-01', country: 'DE' },
    ]);
  });

  it('rejects invalid start input with 400', async () => {
    for (const payload of [{ date: '2026-02-30' }, { date: 'x' }, { country: 'DEU' }, { country: 5 }, [1]]) {
      const res = await start(payload);
      assert.equal(res.statusCode, 400, JSON.stringify(payload));
      assert.ok(res.json().error.code);
    }
    const bad = await app.inject({ method: 'POST', url: '/api/scraper/jobs', headers: { 'content-type': 'application/json' }, payload: '{oops' });
    assert.equal(bad.statusCode, 400);
    assert.equal(queue.messages.length, 0);
  });

  it('answers 503 and marks the job failed when enqueue fails', async () => {
    queue.fail = true;
    const res = await start();
    assert.equal(res.statusCode, 503);
    const { error } = res.json();
    assert.equal(error.code, 'ENQUEUE_FAILED');
    assert.ok(error.jobId);
    assert.equal(JSON.stringify(res.json()).includes('redis'), false);
    assert.equal((await repository.getJob(error.jobId))?.status, 'failed');
  });

  it('returns filtered, stably sorted releases with empty default', async () => {
    await repository.saveReleases([
      release('2', 'B'), release('1', 'B'), release('3', 'A'),
      release('4', 'Z', '2026-05-02'), release('5', 'Y', '2026-05-01', 'AT'),
    ]);
    const res = await app.inject('/api/releases?date=2026-05-01&country=DE');
    assert.equal(res.statusCode, 200);
    const body = res.json();
    assert.deepEqual([body.date, body.country, body.job], ['2026-05-01', 'DE', null]);
    assert.deepEqual(body.releases.map((r: ReleaseDto) => r.id), ['3', '1', '2']);

    const empty = await app.inject('/api/releases?date=2030-01-01');
    assert.deepEqual(empty.json().releases, []);
    assert.equal(queue.messages.length, 0);
  });

  it('includes job status for a matching jobId', async () => {
    const { job } = (await start({ date: '2026-05-01' })).json();
    const res = await app.inject(`/api/releases?date=2026-05-01&jobId=${job.id}`);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json().job.id, job.id);
  });

  it('handles bad releases queries', async () => {
    const unknown = await app.inject('/api/releases?jobId=7b0f1f43-2b6b-4c5e-9d0b-0a8f5a1f2c11');
    assert.equal(unknown.statusCode, 404);
    assert.equal(unknown.json().error.code, 'JOB_NOT_FOUND');

    const { job } = (await start({ date: '2026-05-01' })).json();
    assert.equal((await app.inject(`/api/releases?date=2026-05-02&jobId=${job.id}`)).statusCode, 400);
    assert.equal((await app.inject(`/api/releases?date=2026-05-01&country=AT&jobId=${job.id}`)).statusCode, 400);

    for (const q of ['jobId=nope', 'date=2026-02-30', 'country=D1', 'date=2026-05-01&date=2026-05-02']) {
      assert.equal((await app.inject(`/api/releases?${q}`)).statusCode, 400, q);
    }
  });
});
