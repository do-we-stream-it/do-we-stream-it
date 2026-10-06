export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface Job {
  id: string;
  date: string;
  country: string;
  status: JobStatus;
  error?: string;
}

// Mirrors ReleaseDto in apps/backend/src/contracts.ts (provisional until #1's shared package).
export interface Release {
  id: string;
  title: string;
  type: 'movie' | 'series';
  platform: string;
  date: string;
  country: string;
}

export interface ReleasesResponse {
  date: string;
  country: string;
  job: Job | null;
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
  }).then((r) => json<{ job: Job }>(r));

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
