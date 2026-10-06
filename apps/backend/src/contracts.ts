// Vorläufiger gemeinsamer Vertrag (Ticket #1). Bei Integration durch das echte Paket ersetzen.

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface JobDto {
  id: string;
  date: string;
  country: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface ReleaseDto {
  id: string;
  title: string;
  type: 'movie' | 'series';
  platform: string;
  date: string;
  country: string;
}

export interface ScraperJobMessage {
  jobId: string;
  date: string;
  country: string;
}

export interface ReleaseQuery {
  date: string;
  country: string;
}

/** Persistenz (Ticket #1). */
export interface Repository {
  createJob(input: { id: string; date: string; country: string }): Promise<JobDto>;
  getJob(id: string): Promise<JobDto | null>;
  updateJobStatus(id: string, status: JobStatus, error?: string): Promise<void>;
  saveReleases(releases: ReleaseDto[]): Promise<void>;
  /** Exakter Filter auf Datum und Region, stabil nach Titel, dann ID sortiert. */
  listReleases(query: ReleaseQuery): Promise<ReleaseDto[]>;
  close(): Promise<void>;
}

/** Queue-Produzent (Ticket #2). Resolved erst nach bestätigtem Queue-Eintrag. */
export interface Queue {
  enqueueScraperJob(message: ScraperJobMessage): Promise<void>;
  close(): Promise<void>;
}

export interface Dependencies {
  repository: Repository;
  queue: Queue;
}
