import { isCalendarDate, validateScraperJobPayload } from '@do-we-stream-it/scraper-queue';
import type { ScraperJobPayload } from '@do-we-stream-it/scraper-queue';
import { UnrecoverableError } from 'bullmq';
import type { Job } from 'bullmq';
import { ScraperError } from './errors.js';
import type { Log, ReleaseInput, Scrape, WorkerRepositories } from './types.js';

export function createProcessor(repositories: WorkerRepositories, scrape: Scrape, log: Log) {
  return async (queueJob: Job<ScraperJobPayload>): Promise<{ releaseCount: number; skipped: boolean }> => {
    try { validateScraperJobPayload(queueJob.data); }
    catch { throw new UnrecoverableError(new ScraperError('INVALID_JOB').message); }
    const payload = queueJob.data;
    const stored = await repositories.jobs.findById(payload.jobId);
    if (
      queueJob.id !== payload.jobId || !stored || stored.id !== payload.jobId ||
      stored.date !== payload.date || stored.country !== payload.country
    ) throw new UnrecoverableError(new ScraperError('INVALID_JOB').message);
    if (stored.status === 'succeeded' || stored.status === 'failed') {
      log({ level: 'info', event: 'job.skipped', jobId: payload.jobId, status: stored.status });
      return { releaseCount: 0, skipped: true };
    }
    const running = await repositories.jobs.markRunning(payload.jobId);
    if (!running) throw new ScraperError('SCRAPE_FAILED');
    log({ level: 'info', event: 'job.started', jobId: payload.jobId, attempt: queueJob.attemptsMade + 1 });
    const releases = await scrape(payload);
    const unique = new Map<string, ReleaseInput>();
    for (const release of releases) {
      if (
        release.provider !== 'netflix' || release.country !== payload.country ||
        release.releaseDate !== payload.date || !isCalendarDate(release.releaseDate) ||
        !release.sourceId || !release.title.trim() ||
        !['movie', 'series'].includes(release.type)
      ) throw new ScraperError('SOURCE_PARSE_FAILED');
      unique.set(`${release.provider}:${release.country}:${release.sourceId}:${release.releaseDate}`, release);
    }
    for (const release of unique.values()) await repositories.releases.upsert(release);
    if (!await repositories.jobs.markSucceeded(payload.jobId, unique.size)) throw new ScraperError('SCRAPE_FAILED');
    log({ level: 'info', event: 'job.succeeded', jobId: payload.jobId, releaseCount: unique.size });
    return { releaseCount: unique.size, skipped: false };
  };
}
