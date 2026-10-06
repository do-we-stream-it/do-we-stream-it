import type { ReleaseDto, ScraperJobMessage } from '../contracts.js';

const SAMPLES: Array<Pick<ReleaseDto, 'title' | 'type' | 'platform'>> = [
  { title: 'The Mock Chronicles', type: 'series', platform: 'Netflix' },
  { title: 'Placeholder Heights', type: 'movie', platform: 'Prime Video' },
  { title: 'Fixture Falls', type: 'series', platform: 'Disney+' },
];

/** Platzhalter für den echten Scraper (Ticket #2): liefert deterministische Fake-Releases. */
export async function mockScrape({ date, country }: ScraperJobMessage): Promise<ReleaseDto[]> {
  return SAMPLES.map((sample, index) => ({
    ...sample,
    id: `mock-${country}-${date}-${index}`,
    date,
    country,
  }));
}
