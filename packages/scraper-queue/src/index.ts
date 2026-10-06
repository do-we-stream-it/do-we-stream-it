import { Queue } from 'bullmq';
import type { RedisOptions } from 'bullmq';

// Structural boundary matching ScraperJobPayload from issue #1. No database
// package is implemented here; callers can pass that shared DTO directly.
export interface ScraperJobPayload {
  jobId: string;
  date: string;
  country: string;
}

export const SCRAPER_QUEUE_NAME = 'netflix-scraper';
export const SCRAPER_JOB_NAME = 'scrape-netflix';
export const SCRAPER_ATTEMPTS = 3;

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateScraperJobPayload(value: unknown): asserts value is ScraperJobPayload {
  if (typeof value !== 'object' || value === null) throw new Error('Invalid scraper job payload.');
  const payload = value as Record<string, unknown>;
  if (
    typeof payload.jobId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(payload.jobId) ||
    !isCalendarDate(payload.date) ||
    typeof payload.country !== 'string' || !/^[A-Z]{2}$/.test(payload.country)
  ) {
    throw new Error('Expected a UUID jobId, a valid YYYY-MM-DD date and an uppercase country code.');
  }
}

export function redisConnection(redisUrl: string): RedisOptions {
  const url = new URL(redisUrl);
  if (!['redis:', 'rediss:'].includes(url.protocol)) throw new Error('REDIS_URL must use redis:// or rediss://.');
  if (url.search || url.hash) throw new Error('Redis URL query strings and fragments are not supported.');
  const db = url.pathname === '/' || !url.pathname ? 0 : Number(url.pathname.slice(1));
  if (!/^\/?\d*$/.test(url.pathname) || !Number.isSafeInteger(db) || db < 0) {
    throw new Error('Redis database must be a nonnegative integer.');
  }
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    db,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
    connectTimeout: 5000,
  };
}

export interface ScraperQueueOptions {
  redisUrl: string;
  queueName?: string;
  backoffDelay?: number;
  onError?: (error: Error) => void;
}

export function createScraperQueue(options: ScraperQueueOptions) {
  const queue = new Queue<ScraperJobPayload>(options.queueName ?? SCRAPER_QUEUE_NAME, {
    connection: {
      ...redisConnection(options.redisUrl),
      maxRetriesPerRequest: 1,
      commandTimeout: 5000,
      enableOfflineQueue: false,
      retryStrategy: () => null,
    },
    defaultJobOptions: {
      attempts: SCRAPER_ATTEMPTS,
      backoff: { type: 'exponential', delay: options.backoffDelay ?? 1000 },
      // Keep IDs to deduplicate redelivery; terminal MongoDB jobs also guard
      // against replay after an operator explicitly removes queue history.
      removeOnComplete: false,
      removeOnFail: false,
    },
  });
  queue.on('error', (error) => options.onError?.(error));

  return {
    async enqueueScraperJob(payload: ScraperJobPayload): Promise<void> {
      validateScraperJobPayload(payload);
      await queue.waitUntilReady();
      const job = await queue.add(SCRAPER_JOB_NAME, payload, { jobId: payload.jobId });
      // BullMQ ignores duplicate IDs. Do not silently accept a different
      // date/region attached to an existing UUID.
      const stored = await queue.getJob(job.id!);
      if (!stored || stored.data.date !== payload.date || stored.data.country !== payload.country) {
        throw new Error('Queue job UUID already belongs to a different request.');
      }
    },
    async close(): Promise<void> {
      await queue.close();
    },
  };
}

let producer: ReturnType<typeof createScraperQueue> | undefined;

export async function enqueueScraperJob(payload: ScraperJobPayload): Promise<void> {
  validateScraperJobPayload(payload);
  producer ??= createScraperQueue({ redisUrl: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379' });
  const current = producer;
  try {
    await current.enqueueScraperJob(payload);
  } catch (error) {
    if (producer === current) producer = undefined;
    await current.close().catch(() => {});
    throw error;
  }
}

export async function closeScraperQueue(): Promise<void> {
  const current = producer;
  producer = undefined;
  await current?.close();
}
