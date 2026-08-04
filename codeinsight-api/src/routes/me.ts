import type { FastifyInstance } from 'fastify';
import { requireAuth } from '../services/auth.js';

export async function meRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/me', { onRequest: [requireAuth] }, async (request, reply) => {
    return reply.status(200).send({
      clerkId: request.user?.clerkId,
    });
  });
}
