import fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { clerkPlugin } from '@clerk/fastify';
import { corsPlugin } from './plugins/cors.js';
import { healthRoutes } from './routes/health.js';
import { meRoutes } from './routes/me.js';
import { projectRoutes } from './routes/projects.js';
import { webhookRoutes } from './routes/webhook.js';
import { validateAuthConfig } from './services/auth.js';

export function buildApp(opts: FastifyServerOptions = {}): FastifyInstance {
  const { publishableKey, secretKey } = validateAuthConfig();

  const app = fastify(opts);

  app.register(corsPlugin);
  app.register(clerkPlugin, {
    publishableKey,
    secretKey,
  });
  app.register(healthRoutes);
  app.register(meRoutes);
  app.register(projectRoutes);
  app.register(webhookRoutes);

  return app;
}
