import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { RepositorySizeError } from '../analyzers/code/repository/repository-safety.js';
import { checkConcurrencyGuard, releaseConcurrencyLock } from '../middleware/concurrency-guard.js';
import { checkRateLimit } from '../middleware/rate-limiter.js';
import { requireAuth } from '../services/auth.js';
import {
  getLatestCodeAnalysis,
  InvalidInputError,
  NoAnalysisSessionFoundError,
  ProjectNotFoundError,
  runAndPersistCodeAnalysis,
} from '../services/code-analysis.service.js';
import { UserNotFoundError } from '../services/project.service.js';

interface ProjectParams {
  id: string;
}

interface AnalyzeCodeBody {
  githubUrl?: string;
}

export async function codeAnalyzerRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/projects/:id/analyze/code
  fastify.post<{ Params: ProjectParams; Body: AnalyzeCodeBody }>(
    '/api/projects/:id/analyze/code',
    { onRequest: [requireAuth] },
    async (
      request: FastifyRequest<{ Params: ProjectParams; Body: AnalyzeCodeBody }>,
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
        const result = await runAndPersistCodeAnalysis({
          clerkId,
          projectId,
          input: request.body,
        });

        return reply.status(200).send(result);
      } catch (err: unknown) {
        if (err instanceof RepositorySizeError) {
          return reply.status(413).send({
            error: err.code,
            message: err.message,
            limits: err.limits,
          });
        }

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
          message: 'An error occurred while executing code analysis.',
        });
      } finally {
        releaseConcurrencyLock(lockKey);
      }
    }
  );

  // GET /api/projects/:id/code/findings
  fastify.get<{ Params: ProjectParams }>(
    '/api/projects/:id/code/findings',
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
        const result = await getLatestCodeAnalysis({
          clerkId,
          projectId,
        });

        return reply.status(200).send(result);
      } catch (err: unknown) {
        if (err instanceof ProjectNotFoundError) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Project not found or you are not authorized to access its code findings',
          });
        }

        if (err instanceof UserNotFoundError) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'User is not synchronized in database. Please complete authentication sync.',
          });
        }

        if (err instanceof NoAnalysisSessionFoundError) {
          return reply.status(404).send({
            error: 'Not Found',
            message: err.message,
          });
        }

        request.log.error(err);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'An error occurred while retrieving code findings.',
        });
      }
    }
  );
}
