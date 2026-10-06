import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createProcessor } from '../src/processor.js';
import { publicFailure } from '../src/errors.js';
import { fakeStore, releaseFor } from './helpers.js';

test('results are deduplicated and saved before success is persisted', async () => {
  const store = fakeStore();
  const release = releaseFor(store.payload);
  const result = await createProcessor(store.repositories, async () => [release, release], () => {})(store.queueJob);
  assert.deepEqual(result, { releaseCount: 1, skipped: false });
  assert.deepEqual(store.events, ['running', 'upsert', 'succeeded']);
  assert.equal(store.stored.releaseCount, 1);
});

test('terminal database jobs are skipped on redelivery', async () => {
  for (const status of ['succeeded', 'failed'] as const) {
    const store = fakeStore(); store.stored.status = status;
    const result = await createProcessor(store.repositories, async () => { throw new Error('Must not scrape'); }, () => {})(store.queueJob);
    assert.equal(result.skipped, true);
    assert.deepEqual(store.events, []);
  }
});

test('a source failure stays running for retry; an empty success has count zero', async () => {
  const store = fakeStore();
  await assert.rejects(createProcessor(store.repositories, async () => { throw new Error('Unavailable'); }, () => {})(store.queueJob));
  assert.equal(store.stored.status, 'running');
  await createProcessor(store.repositories, async () => [], () => {})(store.queueJob);
  assert.equal(store.stored.status, 'succeeded');
  assert.equal(store.stored.releaseCount, 0);
});

test('partial storage failures can be resumed without declaring premature success', async () => {
  const store = fakeStore();
  const original = store.repositories.releases.upsert;
  let calls = 0;
  store.repositories.releases.upsert = async (release) => {
    calls++;
    if (calls === 2) throw new Error('Temporary MongoDB outage');
    return original(release);
  };
  const releases = [releaseFor(store.payload), { ...releaseFor(store.payload), sourceId: '81744789' }];
  const processJob = createProcessor(store.repositories, async () => releases, () => {});
  await assert.rejects(processJob(store.queueJob), /MongoDB outage/);
  assert.equal(store.stored.status, 'running');
  assert.equal(store.releases.size, 1);
  await processJob(store.queueJob);
  assert.equal(store.stored.releaseCount, 2);
  assert.equal(store.releases.size, 2);
});

test('mismatched payloads and invalid result batches cannot contaminate other dates', async () => {
  const store = fakeStore();
  await assert.rejects(createProcessor(store.repositories, async () => [], () => {})({ ...store.queueJob, data: { ...store.payload, country: 'US' } } as typeof store.queueJob), /INVALID_JOB/);
  await assert.rejects(createProcessor(store.repositories, async () => [releaseFor(store.payload), { ...releaseFor(store.payload), releaseDate: '2026-10-03' }], () => {})(store.queueJob), /SOURCE_PARSE_FAILED/);
  assert.equal(store.releases.size, 0);
});

test('public failures expose only fixed messages, including after reconciliation', () => {
  assert.equal(publicFailure('[SOURCE_UNAVAILABLE] internal details').code, 'SOURCE_UNAVAILABLE');
  assert.equal(publicFailure('mongodb://user:password@internal').code, 'SCRAPE_FAILED');
  assert.ok(!publicFailure('mongodb://user:password@internal').message.includes('password'));
});
