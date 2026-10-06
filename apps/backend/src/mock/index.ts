import type { Dependencies } from '../contracts.js';
import { InMemoryRepository } from './memory-repository.js';
import { MockQueue } from './mock-queue.js';

export function createMockDependencies(): Dependencies {
  const repository = new InMemoryRepository();
  return { repository, queue: new MockQueue(repository) };
}
