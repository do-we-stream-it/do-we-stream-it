import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import type { Dependencies } from './contracts.js';
import { HttpError } from './errors.js';
import { parseDateAndCountry, parseUuid, ValidationError } from './validation.js';

export function registerRoutes(app: FastifyInstance, { repository, queue }: Dependencies) {
  app.post('/api/scraper/jobs', async (request, reply) => {
    const body = request.body ?? {};
    if (typeof body !== 'object' || Array.isArray(body)) {
      throw new ValidationError('Request body must be a JSON object.');
    }
    const { date, country } = parseDateAndCountry(body as Record<string, unknown>);

    const jobId = randomUUID();
    const job = await repository.createJob({ id: jobId, date, country });

    try {
      await queue.enqueueScraperJob({ jobId, date, country });
    } catch (error) {
      request.log.error({ err: error, jobId }, 'Enqueue failed');
      await repository
        .updateJobStatus(jobId, 'failed', 'Could not enqueue scraper job.')
        .catch((err: unknown) => request.log.error({ err, jobId }, 'Could not mark job as failed'));
      throw new HttpError(503, 'ENQUEUE_FAILED', 'Scraper job could not be queued.', jobId);
    }

    return reply.code(202).send({ job });
  });

  app.get('/api/releases', async (request) => {
    const query = (request.query ?? {}) as Record<string, unknown>;
    const { date, country } = parseDateAndCountry(query);
    const jobId = query.jobId === undefined ? undefined : parseUuid(query.jobId);

    let job = null;
    if (jobId !== undefined) {
      job = await repository.getJob(jobId);
      if (!job) throw new HttpError(404, 'JOB_NOT_FOUND', 'Job not found.', jobId);
      if (job.date !== date || job.country !== country) {
        throw new HttpError(400, 'JOB_MISMATCH', 'Job does not match the requested date and country.', jobId);
      }
    }

    const releases = await repository.listReleases({ date, country });
    return { date, country, job, releases };
  });
}
