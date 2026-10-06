import type { Queue, Repository, ScraperJobMessage } from '../contracts.js';
import { mockScrape } from './mock-scraper.js';

/** Queue-Ersatz: bestätigt den Enqueue sofort und verarbeitet den Job asynchron im selben Prozess. */
export class MockQueue implements Queue {
  private readonly pending = new Set<NodeJS.Timeout>();

  constructor(
    private readonly repository: Repository,
    private readonly delayMs = 500,
  ) {}

  async enqueueScraperJob(message: ScraperJobMessage): Promise<void> {
    const timer = setTimeout(() => {
      this.pending.delete(timer);
      void this.process(message);
    }, this.delayMs);
    this.pending.add(timer);
  }

  private async process(message: ScraperJobMessage): Promise<void> {
    try {
      await this.repository.updateJobStatus(message.jobId, 'running');
      await this.repository.saveReleases(await mockScrape(message));
      await this.repository.updateJobStatus(message.jobId, 'succeeded');
    } catch (error) {
      await this.repository
        .updateJobStatus(message.jobId, 'failed', error instanceof Error ? error.message : 'Unknown error')
        .catch(() => undefined);
    }
  }

  async close(): Promise<void> {
    for (const timer of this.pending) clearTimeout(timer);
    this.pending.clear();
  }
}
