import { validateScraperJobPayload } from '@do-we-stream-it/scraper-queue';
import type { ScraperJobPayload } from '@do-we-stream-it/scraper-queue';
import { ScraperError } from './errors.js';
import type { ReleaseInput } from './types.js';

export const NETFLIX_RELEASES_URL = 'https://about.netflix.com/api/data/releases';
export const COLLECTIONS = { movie: 2694103, series: 2170013 } as const;

interface ReleasePage {
  current: number;
  totalItems: number;
  totalPages: number;
  perPage: number;
  releases: ReleaseInput[];
}

function record(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new ScraperError('SOURCE_PARSE_FAILED');
  }
  return value as Record<string, unknown>;
}

function integer(value: unknown, minimum: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) {
    throw new ScraperError('SOURCE_PARSE_FAILED');
  }
  return value;
}

function regionalDate(timestamp: number): string {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) throw new ScraperError('SOURCE_PARSE_FAILED');
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Europe/Berlin', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function parseReleasePage(value: unknown, country: string, type: 'movie' | 'series'): ReleasePage {
  const page = record(value);
  const current = integer(page.current, 1);
  const totalItems = integer(page.totalItems, 0);
  const totalPages = integer(page.totalPages, 0);
  const perPage = integer(page.perPage, 1);
  if (
    perPage > 200 || totalPages > 25 ||
    (totalItems > 0 && totalPages !== Math.ceil(totalItems / perPage)) ||
    (totalItems === 0 && totalPages > 1) ||
    !Array.isArray(page.data) || page.data.length > perPage ||
    (totalItems === 0 && page.data.length !== 0)
  ) throw new ScraperError('SOURCE_PARSE_FAILED');

  const releases = page.data.map((value: unknown): ReleaseInput => {
    const item = record(value);
    if (
      item.country !== country || item.collection !== COLLECTIONS[type] ||
      typeof item.title1 !== 'string' || !item.title1.trim()
    ) throw new ScraperError('SOURCE_PARSE_FAILED');
    const sourceId = String(integer(item.videoID, 1));
    const releaseDate = regionalDate(integer(item.startTime, 0));
    return {
      provider: 'netflix', country, sourceId, title: item.title1.trim(), type,
      releaseDate, sourceUrl: `https://www.netflix.com/title/${sourceId}`,
    };
  });
  return { current, totalItems, totalPages, perPage, releases };
}

export interface NetflixSourceOptions {
  fetch?: typeof globalThis.fetch;
  now?: () => Date;
  requestTimeoutMs?: number;
  totalTimeoutMs?: number;
}

export async function scrapeNetflix(
  payload: ScraperJobPayload,
  options: NetflixSourceOptions = {},
): Promise<ReleaseInput[]> {
  validateScraperJobPayload(payload);
  if (payload.country !== 'DE') throw new ScraperError('UNSUPPORTED_COUNTRY');
  const fetchPage = options.fetch ?? globalThis.fetch;
  const deadline = AbortSignal.timeout(options.totalTimeoutMs ?? 60000);
  const allReleases: ReleaseInput[] = [];

  for (const type of ['movie', 'series'] as const) {
    let expected: ReleasePage | undefined;
    const collectionReleases: ReleaseInput[] = [];
    for (let pageNumber = 1; pageNumber <= (expected?.totalPages ?? 1); pageNumber++) {
      const url = new URL(NETFLIX_RELEASES_URL);
      url.search = new URLSearchParams({
        country: payload.country, language: 'de', page: String(pageNumber),
        collection: String(COLLECTIONS[type]),
      }).toString();
      let value: unknown;
      try {
        const response = await fetchPage(url, {
          signal: AbortSignal.any([deadline, AbortSignal.timeout(options.requestTimeoutMs ?? 10000)]),
          headers: { Accept: 'application/json', 'User-Agent': 'do-we-stream-it/0.1' },
        });
        if (!response.ok) throw new ScraperError('SOURCE_UNAVAILABLE');
        const text = await response.text();
        if (text.length > 2_000_000) throw new ScraperError('SOURCE_PARSE_FAILED');
        try { value = JSON.parse(text); }
        catch (cause) { throw new ScraperError('SOURCE_PARSE_FAILED', { cause }); }
      } catch (cause) {
        if (cause instanceof ScraperError) throw cause;
        throw new ScraperError('SOURCE_UNAVAILABLE', { cause });
      }
      const page = parseReleasePage(value, payload.country, type);
      if (
        page.current !== pageNumber ||
        (expected && (page.totalItems !== expected.totalItems || page.totalPages !== expected.totalPages || page.perPage !== expected.perPage))
      ) throw new ScraperError('SOURCE_PARSE_FAILED');
      expected ??= page;
      collectionReleases.push(...page.releases);
    }
    if (!expected || collectionReleases.length !== expected.totalItems) {
      throw new ScraperError('SOURCE_PARSE_FAILED');
    }
    allReleases.push(...collectionReleases);
  }

  // The public calendar is a rolling snapshot, not a historical catalogue.
  // Never turn an unavailable month into an apparently successful empty run.
  const availableMonths = new Set(allReleases.map((release) => release.releaseDate.slice(0, 7)));
  if (!availableMonths.size) availableMonths.add((options.now?.() ?? new Date()).toISOString().slice(0, 7));
  if (!availableMonths.has(payload.date.slice(0, 7))) throw new ScraperError('SOURCE_DATE_UNAVAILABLE');
  const unique = new Map<string, ReleaseInput>();
  for (const release of allReleases) {
    if (release.releaseDate === payload.date) unique.set(`${release.sourceId}:${release.releaseDate}`, release);
  }
  return [...unique.values()];
}
