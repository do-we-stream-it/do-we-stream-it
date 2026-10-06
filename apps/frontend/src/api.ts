// ponytail: local DTOs until the shared contracts from #1 land; swap these imports then.
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface Release {
  id: string;
  title: string;
  type: 'movie' | 'series';
  releaseDate: string;
  country: string;
  sourceUrl: string;
}

export interface ReleasesResponse {
  job?: { id: string; status: JobStatus; error?: string };
  releases: Release[];
}

async function json<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return (await response.json()) as T;
}

export const startJob = (date: string, country: string, signal: AbortSignal | null = null) =>
  fetch('/api/scraper/jobs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ date, country }),
    signal,
  }).then((r) => json<{ jobId: string }>(r));

export const getReleases = (
  date: string,
  country: string,
  jobId?: string,
  signal: AbortSignal | null = null,
) => {
  const params = new URLSearchParams({ date, country });
  if (jobId) params.set('jobId', jobId);
  return fetch(`/api/releases?${params}`, { signal }).then((r) =>
    json<ReleasesResponse>(r),
  );
};
