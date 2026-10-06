import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { enqueueScraperJob, isCalendarDate, redisConnection, validateScraperJobPayload } from '../src/index.js';

test('calendar validation rejects rollover dates and accepts leap days', () => {
  assert.equal(isCalendarDate('2024-02-29'), true);
  for (const date of ['2026-02-29', '2026-02-30', '2026-13-01', '26-01-01', '2026-1-01', 'garbage']) {
    assert.equal(isCalendarDate(date), false);
  }
});

test('producer validates payloads before attempting to connect', async () => {
  const valid = { jobId: randomUUID(), date: '2026-10-06', country: 'DE' };
  assert.doesNotThrow(() => validateScraperJobPayload(valid));
  for (const invalid of [null, { ...valid, jobId: '123' }, { ...valid, country: 'de' }, { ...valid, date: '2026-02-30' }]) {
    assert.throws(() => validateScraperJobPayload(invalid));
  }
  await assert.rejects(enqueueScraperJob({ ...valid, date: 'invalid' }), /valid YYYY-MM-DD/);
});

test('Redis connection parses credentials, TLS and database without losing encoding', () => {
  const options = redisConnection('rediss://user:p%40ss@localhost:6380/2');
  assert.equal(options.host, 'localhost');
  assert.equal(options.port, 6380);
  assert.equal(options.db, 2);
  assert.equal(options.username, 'user');
  assert.equal(options.password, 'p@ss');
  assert.deepEqual(options.tls, {});
  for (const url of ['https://localhost', 'redis://localhost/not-a-db', 'redis://localhost/-1', 'redis://localhost/1?db=2']) {
    assert.throws(() => redisConnection(url));
  }
});
