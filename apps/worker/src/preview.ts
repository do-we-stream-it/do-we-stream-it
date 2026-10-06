import { randomUUID } from 'node:crypto';
import { parseCli } from './cli.js';
import { scrapeNetflix } from './netflix.js';

try {
  const { date, country } = parseCli();
  const releases = await scrapeNetflix({ jobId: randomUUID(), date, country });
  console.log(JSON.stringify({ date, country, releases }, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
