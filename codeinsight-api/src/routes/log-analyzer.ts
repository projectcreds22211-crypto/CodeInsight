import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { SAFETY_LIMITS } from '../config/safety-limits.js';
import { checkConcurrencyGuard, releaseConcurrencyLock } from '../middleware/concurrency-guard.js';
import { checkRateLimit } from '../middleware/rate-limiter.js';
import { requireAuth } from '../services/auth.js';
import {
  getLatestLogAnalysis,
  InvalidInputError,
  NoAnalysisSessionFoundError,
  ProjectNotFoundError,
  runAndPersistLogAnalysis,
} from '../services/log-analysis.service.js';
import { UserNotFoundError } from '../services/project.service.js';

interface ProjectParams {
  id: string;
}

interface AnalyzeLogsBody {
  logs?: unknown;
  logsJson?: unknown;
}

export async function logAnalyzerRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/projects/:id/analyze/logs
  fastify.post<{ Params: ProjectParams; Body: AnalyzeLogsBody }>(
    '/api/projects/:id/analyze/logs',
    { onRequest: [requireAuth] },
    async (
      request: FastifyRequest<{ Params: ProjectParams; Body: AnalyzeLogsBody }>,
      reply: FastifyReply
    ) => {
      const clerkId = request.user?.clerkId;
      if (!clerkId) {
        return reply
          .status(401)
          .send({ error: 'Unauthorized', message: 'Authentication required' });
      }

      // Enforce user-scoped rate limiting (Phase 7.6)
      if (!checkRateLimit(request, reply, 'analyzer')) {
        return;
      }

      // Check payload size safety (Phase 7.6)
      const rawPayload = request.body?.logs || request.body?.logsJson;
      let totalPayloadBytes = 0;
      if (typeof rawPayload === 'string') {
        totalPayloadBytes = rawPayload.length;
      } else if (rawPayload) {
        try {
          totalPayloadBytes = JSON.stringify(rawPayload).length;
        } catch {
          totalPayloadBytes = 0;
        }
      }

      if (totalPayloadBytes > SAFETY_LIMITS.payloads.maxLogPayloadBytes) {
        return reply.status(413).send({
          error: 'PAYLOAD_TOO_LARGE',
          message: `Log payload of ${totalPayloadBytes} bytes exceeds maximum safety limit of ${SAFETY_LIMITS.payloads.maxLogPayloadBytes} bytes (5MB).`,
        });
      }

      // Enforce user-scoped concurrency guard (Phase 7.6)
      const lockKey = checkConcurrencyGuard(request, reply, 'analysis');
      if (!lockKey) {
        return;
      }

      const { id: projectId } = request.params;
      if (!projectId) {
        releaseConcurrencyLock(lockKey);
        return reply.status(400).send({ error: 'Bad Request', message: 'Project ID is required' });
      }

      try {
        const result = await runAndPersistLogAnalysis({
          clerkId,
          projectId,
          input: request.body,
        });

        return reply.status(200).send(result);
      } catch (err: unknown) {
        if (err instanceof ProjectNotFoundError) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Project not found or you are not authorized to analyze it',
          });
        }

        if (err instanceof UserNotFoundError) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'User is not synchronized in database. Please complete authentication sync.',
          });
        }

        if (err instanceof InvalidInputError) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: err.message,
          });
        }

        request.log.error(err);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'An error occurred while executing log analysis.',
        });
      } finally {
        releaseConcurrencyLock(lockKey);
      }
    }
  );

  // GET /api/projects/:id/logs/findings
  fastify.get<{ Params: ProjectParams }>(
    '/api/projects/:id/logs/findings',
    { onRequest: [requireAuth] },
    async (request: FastifyRequest<{ Params: ProjectParams }>, reply: FastifyReply) => {
      const clerkId = request.user?.clerkId;
      if (!clerkId) {
        return reply
          .status(401)
          .send({ error: 'Unauthorized', message: 'Authentication required' });
      }

      const { id: projectId } = request.params;
      if (!projectId) {
        return reply.status(400).send({ error: 'Bad Request', message: 'Project ID is required' });
      }

      try {
        const result = await getLatestLogAnalysis({
          clerkId,
          projectId,
        });

        return reply.status(200).send(result);
      } catch (err: unknown) {
        if (err instanceof ProjectNotFoundError) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Project not found or you are not authorized to view its findings',
          });
        }

        if (err instanceof NoAnalysisSessionFoundError) {
          return reply.status(404).send({
            error: 'Not Found',
            message:
              'No completed log analysis session found for this project. Please run an analysis first.',
          });
        }

        if (err instanceof UserNotFoundError) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'User is not synchronized in database. Please complete authentication sync.',
          });
        }

        request.log.error(err);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'An error occurred while retrieving log findings.',
        });
      }
    }
  );
}
