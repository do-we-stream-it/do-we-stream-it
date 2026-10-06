import { parseArgs } from 'node:util';
import { isCalendarDate } from '@do-we-stream-it/scraper-queue';

export function parseCli(requireJobId = false) {
  const { values } = parseArgs({
    options: {
      date: { type: 'string' }, country: { type: 'string' },
      ...(requireJobId ? { 'job-id': { type: 'string' as const } } : {}),
    },
  });
  const date = values.date ?? new Date().toISOString().slice(0, 10);
  const country = values.country ?? 'DE';
  if (!isCalendarDate(date) || !/^[A-Z]{2}$/.test(country)) throw new Error('Provide --date YYYY-MM-DD and an uppercase --country code.');
  const jobId = typeof values['job-id'] === 'string' ? values['job-id'] : undefined;
  if (requireJobId && !jobId) throw new Error('--job-id must be the UUID of an existing queued database job.');
  return { date, country, jobId };
}
