import { startWorker } from '../../../src/runtime.js';
import { fakeStore } from '../../helpers.js';

const store = fakeStore();
const payload = JSON.parse(process.env.JOB_PAYLOAD!);
Object.assign(store.payload, payload);
Object.assign(store.stored, { id: payload.jobId, date: payload.date, country: payload.country });
await startWorker({
  redisUrl: process.env.REDIS_TEST_URL!, queueName: process.env.TEST_QUEUE_NAME!,
  repositories: store.repositories, log: () => {},
  workerOptions: { lockDuration: 500, stalledInterval: 500 },
  scrape: async () => {
    process.send?.('active');
    return new Promise(() => {});
  },
});
