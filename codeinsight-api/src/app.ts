import fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';
import { clerkPlugin } from '@clerk/fastify';
import { corsPlugin } from './plugins/cors.js';
import { codeAnalyzerRoutes } from './routes/code-analyzer.js';
import { correlationRoutes } from './routes/correlation.js';
import { databaseAnalyzerRoutes } from './routes/database-analyzer.js';
import { healthRoutes } from './routes/health.js';
import { logAnalyzerRoutes } from './routes/log-analyzer.js';
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
  app.register(codeAnalyzerRoutes);
  app.register(databaseAnalyzerRoutes);
  app.register(logAnalyzerRoutes);
  app.register(correlationRoutes);
  app.register(webhookRoutes);

  return app;
}
