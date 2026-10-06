import { closeScraperQueue, enqueueScraperJob } from '@do-we-stream-it/scraper-queue';
import { parseCli } from './cli.js';

try {
  const { date, country, jobId } = parseCli(true);
  await enqueueScraperJob({ jobId: jobId!, date, country });
  console.log(JSON.stringify({ jobId, date, country, enqueued: true }));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await closeScraperQueue();
}
