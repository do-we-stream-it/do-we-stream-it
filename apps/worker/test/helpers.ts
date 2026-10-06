import { randomUUID } from 'node:crypto';
import type { Job } from 'bullmq';
import type { ScraperJobPayload } from '@do-we-stream-it/scraper-queue';
import type { ReleaseInput, WorkerJob, WorkerRepositories } from '../src/types.js';

export function fakeStore(date = '2026-10-02') {
  const payload: ScraperJobPayload = { jobId: randomUUID(), date, country: 'DE' };
  const stored: WorkerJob & { releaseCount?: number; error?: { code: string; message: string } } = {
    id: payload.jobId, date, country: payload.country, status: 'queued',
  };
  const releases = new Map<string, ReleaseInput>();
  const events: string[] = [];
  const repositories: WorkerRepositories = {
    jobs: {
      async findById(id) { return id === stored.id ? { ...stored } : null; },
      async markRunning(id) {
        if (id !== stored.id || ['succeeded', 'failed'].includes(stored.status)) return null;
        events.push('running'); stored.status = 'running'; return { ...stored };
      },
      async markSucceeded(id, count) {
        if (id !== stored.id || stored.status !== 'running') return null;
        events.push('succeeded'); stored.status = 'succeeded'; stored.releaseCount = count; return { ...stored };
      },
      async markFailed(id, error) {
        if (id !== stored.id || ['succeeded', 'failed'].includes(stored.status)) return null;
        events.push('failed'); stored.status = 'failed'; stored.error = error; return { ...stored };
      },
    },
    releases: {
      async upsert(release) { events.push('upsert'); releases.set(`${release.country}:${release.sourceId}:${release.releaseDate}`, release); },
    },
  };
  const queueJob = { id: payload.jobId, data: payload, attemptsMade: 0 } as Job<ScraperJobPayload>;
  return { payload, stored, releases, events, repositories, queueJob };
}

export function releaseFor(payload: ScraperJobPayload): ReleaseInput {
  return {
    provider: 'netflix', country: payload.country, sourceId: '82023496',
    title: 'Doing Life', type: 'movie', releaseDate: payload.date,
    sourceUrl: 'https://www.netflix.com/title/82023496',
  };
}

export async function waitFor(predicate: () => boolean | Promise<boolean>, timeout = 10000) {
  const end = Date.now() + timeout;
  while (!await predicate()) {
    if (Date.now() > end) throw new Error('Timed out waiting for test state.');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
