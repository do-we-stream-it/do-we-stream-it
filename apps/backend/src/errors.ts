import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ValidationError } from './validation.js';

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
    readonly jobId?: string,
  ) {
    super(message);
  }
}

function send(reply: FastifyReply, status: number, code: string, message: string, jobId?: string) {
  return reply.code(status).send({ error: { code, message, ...(jobId ? { jobId } : {}) } });
}

export function errorHandler(error: FastifyError | Error, request: FastifyRequest, reply: FastifyReply) {
  if (error instanceof HttpError) return send(reply, error.statusCode, error.code, error.message, error.jobId);
  if (error instanceof ValidationError) return send(reply, 400, 'VALIDATION_ERROR', error.message);

  const statusCode = (error as FastifyError).statusCode;
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return send(reply, 400, 'BAD_REQUEST', 'Malformed request.');
  }

  request.log.error({ err: error }, 'Unhandled error');
  return send(reply, 500, 'INTERNAL_ERROR', 'Internal server error.');
}

export function notFoundHandler(_request: FastifyRequest, reply: FastifyReply) {
  return send(reply, 404, 'NOT_FOUND', 'Route not found.');
}
