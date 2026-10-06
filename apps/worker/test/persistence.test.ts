import assert from 'node:assert/strict';
import { test } from 'node:test';
import { connectWorkerRepositories } from '../src/persistence.js';
import { fakeStore } from './helpers.js';

test('data adapter consumes the supplied issue #1 interface and closes it', async () => {
  const store = fakeStore();
  const calls: string[] = [];
  const db = {};
  const connection = await connectWorkerRepositories({ uri: 'mongodb://test', database: 'test' }, async () => ({
    async connectMongo() { calls.push('connect'); return db; },
    async initializeMongoSchema(value: unknown) { assert.equal(value, db); calls.push('schema'); },
    async closeMongo() { calls.push('close'); },
    JobRepository: class { constructor(value: unknown) { assert.equal(value, db); return store.repositories.jobs; } },
    ReleaseRepository: class { constructor(value: unknown) { assert.equal(value, db); return store.repositories.releases; } },
  }));
  assert.equal(connection.repositories.jobs, store.repositories.jobs);
  await connection.close();
  assert.deepEqual(calls, ['connect', 'schema', 'close']);
});

test('missing issue #1 dependency and incompatible exports have actionable errors', async () => {
  await assert.rejects(connectWorkerRepositories({ uri: 'mongodb://test', database: 'test' }, async () => { throw new Error('Missing module'); }), /issue #1/);
  await assert.rejects(connectWorkerRepositories({ uri: 'mongodb://test', database: 'test' }, async () => ({})), /agreed repository interface/);
});
