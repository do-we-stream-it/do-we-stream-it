import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { COLLECTIONS, parseReleasePage, scrapeNetflix } from '../src/netflix.js';

const films = JSON.parse(await readFile(new URL('./fixtures/netflix-de-films.json', import.meta.url), 'utf8'));
const series = JSON.parse(await readFile(new URL('./fixtures/netflix-de-series.json', import.meta.url), 'utf8'));
const payload = { jobId: randomUUID(), date: '2026-10-02', country: 'DE' };
const snapshotFetch: typeof fetch = async (input) => {
  const url = new URL(String(input));
  assert.equal(url.searchParams.get('country'), 'DE');
  return Response.json(url.searchParams.get('collection') === String(COLLECTIONS.movie) ? films : series);
};

test('recorded Netflix fixture preserves identity, release date, title and classification', async () => {
  const releases = await scrapeNetflix(payload, { fetch: snapshotFetch });
  assert.deepEqual(releases, [{
    provider: 'netflix', country: 'DE', sourceId: '82023496', title: 'Doing Life',
    type: 'movie', releaseDate: '2026-10-02', sourceUrl: 'https://www.netflix.com/title/82023496',
  }]);
  assert.equal((await scrapeNetflix({ ...payload, date: '2026-10-06' }, { fetch: snapshotFetch }))[0]?.type, 'series');
});

test('German regional date uses Europe/Berlin, including dates crossing UTC midnight', () => {
  const page = structuredClone(films);
  page.data[0].startTime = Date.parse('2026-10-01T23:30:00Z');
  assert.equal(parseReleasePage(page, 'DE', 'movie').releases[0]?.releaseDate, '2026-10-02');
});

test('every page is requested and counted, including later-page results', async () => {
  const calls: string[] = [];
  const fetchPages: typeof fetch = async (input) => {
    const url = new URL(String(input));
    const raw = url.searchParams.get('collection') === String(COLLECTIONS.movie) ? films : series;
    const page = Number(url.searchParams.get('page'));
    calls.push(`${url.searchParams.get('collection')}:${page}`);
    return Response.json({ ...raw, perPage: 2, totalPages: Math.ceil(raw.totalItems / 2), current: page, data: raw.data.slice((page - 1) * 2, page * 2) });
  };
  const releases = await scrapeNetflix({ ...payload, date: '2026-10-30' }, { fetch: fetchPages });
  assert.equal(calls.length, Math.ceil(films.totalItems / 2) + Math.ceil(series.totalItems / 2));
  assert.ok(releases.some((release) => release.sourceId === '82059675'));
});

test('a date without releases in the advertised month succeeds, historical months fail', async () => {
  assert.deepEqual(await scrapeNetflix({ ...payload, date: '2026-10-05' }, { fetch: snapshotFetch }), []);
  await assert.rejects(scrapeNetflix({ ...payload, date: '2026-09-01' }, { fetch: snapshotFetch }), /SOURCE_DATE_UNAVAILABLE/);
  await assert.rejects(scrapeNetflix({ ...payload, country: 'US' }, { fetch: snapshotFetch }), /UNSUPPORTED_COUNTRY/);
});

test('schema, country and collection mismatches fail instead of inventing empty results', () => {
  for (const field of ['country', 'collection', 'title1', 'startTime', 'videoID']) {
    const page = structuredClone(films);
    page.data[0][field] = null;
    assert.throws(() => parseReleasePage(page, 'DE', 'movie'), /SOURCE_PARSE_FAILED/);
  }
  assert.throws(() => parseReleasePage('<html>blocked</html>', 'DE', 'movie'), /SOURCE_PARSE_FAILED/);
  assert.throws(() => parseReleasePage({ ...films, totalItems: 100 }, 'DE', 'movie'), /SOURCE_PARSE_FAILED/);
});

test('HTTP failures, malformed responses, and truncated pages surface as failures', async () => {
  await assert.rejects(scrapeNetflix(payload, { fetch: async () => new Response('no', { status: 503 }) }), /SOURCE_UNAVAILABLE/);
  await assert.rejects(scrapeNetflix(payload, { fetch: async () => new Response('<html>blocked</html>') }), /SOURCE_PARSE_FAILED/);
  await assert.rejects(scrapeNetflix(payload, { fetch: async () => Response.json({ ...films, data: [] }) }), /SOURCE_PARSE_FAILED/);
});

test('timeouts abort pending requests', async () => {
  const slowFetch: typeof fetch = async (_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
  });
  // AbortSignal.timeout is unrefed; keep the event loop alive for this mock.
  const keepAlive = setTimeout(() => {}, 500);
  try { await assert.rejects(scrapeNetflix(payload, { fetch: slowFetch, requestTimeoutMs: 10 }), /SOURCE_UNAVAILABLE/); }
  finally { clearTimeout(keepAlive); }
});
