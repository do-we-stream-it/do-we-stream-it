import Fastify from 'fastify';
import type { Dependencies } from './contracts.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { registerRoutes } from './routes.js';

export interface BuildAppOptions {
  dependencies: Dependencies;
  logger?: boolean;
}

export function buildApp({ dependencies, logger = true }: BuildAppOptions) {
  const app = Fastify({ logger });

  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler(notFoundHandler);

  app.addHook('onClose', async () => {
    await dependencies.queue.close();
    await dependencies.repository.close();
  });

  app.get('/api/health', async () => ({
    status: 'ok',
    service: 'backend',
  }));

  registerRoutes(app, dependencies);

  return app;
}
