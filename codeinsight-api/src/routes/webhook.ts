import type { FastifyInstance } from 'fastify';
import { verifyClerkWebhook, processClerkWebhook } from '../services/webhook.service.js';

export async function webhookRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/webhooks/clerk', async (request, reply) => {
    const rawPayload = typeof request.body === 'string'
      ? request.body
      : JSON.stringify(request.body);

    let event;
    try {
      event = verifyClerkWebhook(rawPayload, request.headers);
    } catch (err) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: err instanceof Error ? err.message : 'Invalid webhook signature',
      });
    }

    try {
      const result = await processClerkWebhook(event);
      return reply.status(200).send({
        success: true,
        action: result.action,
        status: result.status,
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to process webhook event',
      });
    }
  });
}
