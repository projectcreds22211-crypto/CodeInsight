import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import { getEnvConfig } from '../config/env.js';

export async function corsPlugin(fastify: FastifyInstance): Promise<void> {
  const env = getEnvConfig();

  await fastify.register(cors, {
    origin: (origin, cb) => {
      // Allow requests with no origin (like mobile apps, curl, server-to-server)
      if (!origin) {
        return cb(null, true);
      }

      if (env.allowedOrigins.includes(origin) || !env.isProduction) {
        return cb(null, true);
      }

      cb(new Error(`CORS origin '${origin}' is not allowed by policy`), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'Cache-Control',
    ],
    exposedHeaders: [
      'Retry-After',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],
  });
}
