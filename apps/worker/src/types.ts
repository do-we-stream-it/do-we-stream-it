import type { ScraperJobPayload } from '@do-we-stream-it/scraper-queue';

export interface ReleaseInput {
  provider: 'netflix';
  country: string;
  sourceId: string;
  title: string;
  type: 'movie' | 'series';
  releaseDate: string;
  sourceUrl: string;
}

export interface WorkerJob {
  id: string;
  date: string;
  country: string;
  status: 'queued' | 'running' | 'succeeded' | 'failed';
}

// Only the methods consumed by this worker; the implementation belongs to #1.
export interface WorkerRepositories {
  jobs: {
    findById(id: string): Promise<WorkerJob | null>;
    markRunning(id: string): Promise<WorkerJob | null>;
    markSucceeded(id: string, count: number): Promise<WorkerJob | null>;
    markFailed(id: string, error: { code: string; message: string }): Promise<WorkerJob | null>;
  };
  releases: {
    upsert(release: ReleaseInput): Promise<unknown>;
  };
}

export type Scrape = (payload: ScraperJobPayload) => Promise<ReleaseInput[]>;
export type Log = (entry: Record<string, unknown>) => void;
