import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Finding } from '@codeinsight/shared-contracts';
import { runCorrelationOrchestrator } from '../correlation/orchestrator.js';
import type { CorrelationSSEEvent } from '../correlation/types.js';
import { checkConcurrencyGuard, releaseConcurrencyLock } from '../middleware/concurrency-guard.js';
import { checkRateLimit } from '../middleware/rate-limiter.js';
import { requireAuth } from '../services/auth.js';
import {
  createCorrelationSession,
  failCorrelationSession,
  formatSSEEvent,
  getLatestCorrelationReport,
  InvalidGroundingError,
  loadProjectLatestSessionsAndFindings,
  persistCorrelationReport,
  ProjectNotFoundError,
} from '../services/correlation-service.js';
import { UserNotFoundError } from '../services/project.service.js';

interface ProjectParams {
  id: string;
}

interface CorrelateBody {
  query?: string;
}

/**
 * Retrieves the latest persisted correlation report and session availability for a project.
 */
async function handleGetLatestReport(
  request: FastifyRequest<{ Params: ProjectParams }>,
  reply: FastifyReply
): Promise<void> {
  const clerkId = request.user?.clerkId;
  if (!clerkId) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
  }

  const { id: projectId } = request.params;
  if (!projectId) {
    return reply.status(400).send({ error: 'Bad Request', message: 'Project ID is required' });
  }

  try {
    const loadedData = await loadProjectLatestSessionsAndFindings({ clerkId, projectId });
    const latestReportData = await getLatestCorrelationReport({ clerkId, projectId });

    const sessionAvailability = {
      code: loadedData.sessionFindings.code !== null,
      database: loadedData.sessionFindings.database !== null,
      logs: loadedData.sessionFindings.logs !== null,
    };

    const totalFindingsCount =
      (loadedData.sessionFindings.code?.length || 0) +
      (loadedData.sessionFindings.database?.length || 0) +
      (loadedData.sessionFindings.logs?.length || 0);

    return reply.status(200).send({
      projectId,
      report: latestReportData ? latestReportData.report : null,
      sessionAvailability,
      totalFindingsCount,
    });
  } catch (err: unknown) {
    if (err instanceof ProjectNotFoundError) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found or user is not authorized to access it.',
      });
    }

    if (err instanceof UserNotFoundError) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User is not synchronized in database. Please complete authentication sync.',
      });
    }

    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to retrieve correlation report.',
    });
  }
}

/**
 * Handles SSE correlation stream for both GET and POST endpoints, creating a correlation session,
 * validating grounded correlations, and transactionally persisting the final report.
 */
async function handleCorrelationSSEStream(
  request: FastifyRequest<{ Params: ProjectParams; Body?: CorrelateBody }>,
  reply: FastifyReply
): Promise<void> {
  const clerkId = request.user?.clerkId;
  if (!clerkId) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
  }

  // Enforce user-scoped rate limiting for SSE correlation (Phase 7.6)
  if (!checkRateLimit(request, reply, 'correlation')) {
    return;
  }

  // Enforce user-scoped concurrency guard for SSE correlation (Phase 7.6)
  const lockKey = checkConcurrencyGuard(request, reply, 'correlation');
  if (!lockKey) {
    return;
  }

  const { id: projectId } = request.params;
  if (!projectId) {
    releaseConcurrencyLock(lockKey);
    return reply.status(400).send({ error: 'Bad Request', message: 'Project ID is required' });
  }

  let isLockReleased = false;
  const releaseLockOnce = () => {
    if (!isLockReleased) {
      isLockReleased = true;
      releaseConcurrencyLock(lockKey);
    }
  };

  // Authorize project ownership and load latest completed findings
  let loadedData;
  try {
    loadedData = await loadProjectLatestSessionsAndFindings({ clerkId, projectId });
  } catch (err: unknown) {
    releaseLockOnce();
    if (err instanceof ProjectNotFoundError) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Project not found or user is not authorized to access it.',
      });
    }

    if (err instanceof UserNotFoundError) {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'User is not synchronized in database. Please complete authentication sync.',
      });
    }

    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to authorize project context.',
    });
  }

  // Create new correlation analysis session in running state
  let session;
  try {
    session = await createCorrelationSession(loadedData.projectId);
  } catch (err: unknown) {
    releaseLockOnce();
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to initialize correlation session in database.',
    });
  }

  // Configure Server-Sent Events headers
  reply.raw.setHeader('Content-Type', 'text/event-stream');
  reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
  reply.raw.setHeader('Connection', 'keep-alive');
  reply.raw.setHeader('X-Accel-Buffering', 'no');
  reply.raw.flushHeaders();

  let isClientDisconnected = false;
  const cleanup = () => {
    isClientDisconnected = true;
    releaseLockOnce();
  };
  request.raw.on('close', cleanup);
  reply.raw.on('close', cleanup);

  const safeWrite = (event: CorrelationSSEEvent) => {
    if (!isClientDisconnected && !reply.raw.writableEnded) {
      reply.raw.write(formatSSEEvent(event));
    }
  };

  // Emit connection established event
  safeWrite({
    type: 'connection',
    status: 'connected',
    timestamp: new Date().toISOString(),
  });

  const customUserQuery =
    request.body && typeof request.body.query === 'string' && request.body.query.trim()
      ? request.body.query.trim().slice(0, 1000)
      : undefined;

  // Map of all exposed findings for server-side grounding validation
  const availableFindingsMap = new Map<string, Finding>();
  for (const f of [
    ...(loadedData.sessionFindings.code || []),
    ...(loadedData.sessionFindings.database || []),
    ...(loadedData.sessionFindings.logs || []),
  ]) {
    availableFindingsMap.set(f.id, f);
  }

  try {
    const orchestratorResult = await runCorrelationOrchestrator({
      projectId: loadedData.projectId,
      sessionFindings: loadedData.sessionFindings,
      userPrompt: customUserQuery,
      onProgress: (event) => {
        // Stream intermediate progress events, withholding final completed event until persistence succeeds
        if (event.type !== 'completed') {
          safeWrite(event);
        }
      },
    });

    if (orchestratorResult.status === 'completed' && orchestratorResult.parsedOutput) {
      let report;
      try {
        // Transactionally persist report and mark session completed
        const res = await persistCorrelationReport({
          sessionId: session.id,
          projectId: loadedData.projectId,
          summary: orchestratorResult.parsedOutput.summaryOverview || orchestratorResult.response,
          correlations: orchestratorResult.parsedOutput.correlations,
          availableFindingsMap,
        });
        report = res.report;
      } catch (pErr: unknown) {
        await failCorrelationSession(session.id).catch(() => {});
        const msg =
          pErr instanceof InvalidGroundingError
            ? pErr.message
            : 'Failed to persist correlation report in database.';

        safeWrite({
          type: 'error',
          error: 'Report Persistence Failure',
          message: msg,
        });
        return;
      }

      // Emit completed SSE event with persisted reportId
      safeWrite({
        type: 'completed',
        status: 'completed',
        result: {
          ...orchestratorResult,
          reportId: report.id,
        },
        timestamp: new Date().toISOString(),
      });
    } else if (orchestratorResult.status === 'offline') {
      await failCorrelationSession(session.id).catch(() => {});
      safeWrite({
        type: 'completed',
        status: 'offline',
        result: orchestratorResult,
        timestamp: new Date().toISOString(),
      });
    } else {
      await failCorrelationSession(session.id).catch(() => {});
      safeWrite({
        type: 'error',
        error: 'Correlation Failed',
        message: orchestratorResult.response || 'Correlation orchestrator failed to complete.',
      });
    }
  } catch (err: any) {
    await failCorrelationSession(session.id).catch(() => {});
    safeWrite({
      type: 'error',
      error: 'Orchestration Error',
      message: err?.message || 'An unexpected error occurred during correlation execution.',
    });
  } finally {
    releaseLockOnce();
    if (!reply.raw.writableEnded) {
      reply.raw.end();
    }
  }
}

export async function correlationRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/projects/:id/report — Latest persisted correlation report
  fastify.get<{ Params: ProjectParams }>(
    '/api/projects/:id/report',
    { onRequest: [requireAuth] },
    handleGetLatestReport
  );

  // GET /api/projects/:id/correlate — Standard EventSource endpoint
  fastify.get<{ Params: ProjectParams }>(
    '/api/projects/:id/correlate',
    { onRequest: [requireAuth] },
    handleCorrelationSSEStream
  );

  // POST /api/projects/:id/correlate — Optional query-scoped SSE stream endpoint
  fastify.post<{ Params: ProjectParams; Body: CorrelateBody }>(
    '/api/projects/:id/correlate',
    { onRequest: [requireAuth] },
    handleCorrelationSSEStream
  );
}
