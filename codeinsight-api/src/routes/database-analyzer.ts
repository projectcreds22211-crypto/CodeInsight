import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { SAFETY_LIMITS } from '../config/safety-limits.js';
import { checkConcurrencyGuard, releaseConcurrencyLock } from '../middleware/concurrency-guard.js';
import { checkRateLimit } from '../middleware/rate-limiter.js';
import { requireAuth } from '../services/auth.js';
import {
  getLatestDatabaseAnalysis,
  InvalidInputError,
  NoAnalysisSessionFoundError,
  ProjectNotFoundError,
  runAndPersistDatabaseAnalysis,
} from '../services/database-analysis.service.js';
import { UserNotFoundError } from '../services/project.service.js';

interface ProjectParams {
  id: string;
}

interface AnalyzeDatabaseBody {
  schemaSql?: string;
  queriesSql?: string[];
}

export async function databaseAnalyzerRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/projects/:id/analyze/database
  fastify.post<{ Params: ProjectParams; Body: AnalyzeDatabaseBody }>(
    '/api/projects/:id/analyze/database',
    { onRequest: [requireAuth] },
    async (
      request: FastifyRequest<{ Params: ProjectParams; Body: AnalyzeDatabaseBody }>,
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
      const schemaSize = request.body?.schemaSql?.length || 0;
      const queriesSize = (request.body?.queriesSql || []).reduce(
        (acc, q) => acc + (q?.length || 0),
        0
      );
      const totalPayloadBytes = schemaSize + queriesSize;

      if (totalPayloadBytes > SAFETY_LIMITS.payloads.maxSqlPayloadBytes) {
        return reply.status(413).send({
          error: 'PAYLOAD_TOO_LARGE',
          message: `Database SQL payload of ${totalPayloadBytes} bytes exceeds maximum safety limit of ${SAFETY_LIMITS.payloads.maxSqlPayloadBytes} bytes (1MB).`,
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
        const result = await runAndPersistDatabaseAnalysis({
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
          message: 'An error occurred while executing database analysis.',
        });
      } finally {
        releaseConcurrencyLock(lockKey);
      }
    }
  );

  // GET /api/projects/:id/database/findings
  fastify.get<{ Params: ProjectParams }>(
    '/api/projects/:id/database/findings',
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
        const result = await getLatestDatabaseAnalysis({
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
              'No completed database analysis session found for this project. Please run an analysis first.',
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
          message: 'An error occurred while retrieving database findings.',
        });
      }
    }
  );
}
