import type { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

export async function corsPlugin(fastify: FastifyInstance): Promise<void> {
  const frontendUrl = process.env['FRONTEND_URL'];

  await fastify.register(cors, {
    origin: frontendUrl ? [frontendUrl, 'http://localhost:5173', 'http://localhost:3000', true] : true,
    credentials: true,
  });
}
