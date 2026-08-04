import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

export async function corsPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(cors, {
    origin: true,
  });
}
