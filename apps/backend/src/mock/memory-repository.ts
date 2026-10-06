import type { JobDto, JobStatus, ReleaseDto, ReleaseQuery, Repository } from '../contracts.js';

export class InMemoryRepository implements Repository {
  private readonly jobs = new Map<string, JobDto>();
  private releases = new Map<string, ReleaseDto>();

  async createJob(input: { id: string; date: string; country: string }): Promise<JobDto> {
    const now = new Date().toISOString();
    const job: JobDto = { ...input, status: 'queued', createdAt: now, updatedAt: now };
    this.jobs.set(job.id, job);
    return { ...job };
  }

  async getJob(id: string): Promise<JobDto | null> {
    const job = this.jobs.get(id);
    return job ? { ...job } : null;
  }

  async updateJobStatus(id: string, status: JobStatus, error?: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;
    job.status = status;
    job.updatedAt = new Date().toISOString();
    if (error === undefined) delete job.error;
    else job.error = error;
  }

  async saveReleases(releases: ReleaseDto[]): Promise<void> {
    for (const release of releases) this.releases.set(release.id, release);
  }

  async listReleases({ date, country }: ReleaseQuery): Promise<ReleaseDto[]> {
    return [...this.releases.values()]
      .filter((r) => r.date === date && r.country === country)
      .sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id));
  }

  async close(): Promise<void> {
    this.releases = new Map();
    this.jobs.clear();
  }
}
