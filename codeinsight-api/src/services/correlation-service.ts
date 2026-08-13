import { and, desc, eq } from 'drizzle-orm';
import type { Finding } from '@codeinsight/shared-contracts';
import type { CorrelationSSEEvent, GroundedCorrelation } from '../correlation/types.js';
import { getDb } from '../db/client.js';
import {
  analysisSessions,
  findings,
  reports,
  type AnalysisSession,
  type Report,
} from '../db/schema.js';
import { mapDbRowToFinding, ProjectNotFoundError } from './code-analysis.service.js';
import { resolveAuthorizedProject } from './code-analysis.service.js';

export { ProjectNotFoundError };

export class InvalidGroundingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidGroundingError';
  }
}

export interface LoadedProjectCorrelationData {
  projectId: string;
  sessionFindings: {
    code: Finding[] | null;
    database: Finding[] | null;
    logs: Finding[] | null;
  };
}

/**
 * Resolves authorized project and loads latest completed findings for code, database, and log analyzers.
 * Returns null for an analyzer if no completed session exists for that analyzer type.
 */
export async function loadProjectLatestSessionsAndFindings(params: {
  clerkId: string;
  projectId: string;
}): Promise<LoadedProjectCorrelationData> {
  const db = getDb();
  const { project } = await resolveAuthorizedProject(params.clerkId, params.projectId);

  const analyzerTypes: Array<'code' | 'database' | 'logs'> = ['code', 'database', 'logs'];
  const sessionFindings: LoadedProjectCorrelationData['sessionFindings'] = {
    code: null,
    database: null,
    logs: null,
  };

  for (const type of analyzerTypes) {
    const sessionRows = await db
      .select()
      .from(analysisSessions)
      .where(
        and(
          eq(analysisSessions.projectId, project.id),
          eq(analysisSessions.type, type),
          eq(analysisSessions.status, 'completed')
        )
      )
      .orderBy(desc(analysisSessions.startedAt))
      .limit(1);

    const session = sessionRows[0];
    if (session) {
      const findingRows = await db
        .select()
        .from(findings)
        .where(eq(findings.sessionId, session.id))
        .orderBy(desc(findings.createdAt));

      sessionFindings[type] = findingRows.map((row) => mapDbRowToFinding(row));
    }
  }

  return {
    projectId: project.id,
    sessionFindings,
  };
}

/**
 * Creates a new analysis_sessions row with type 'correlation' and status 'running' for a project.
 */
export async function createCorrelationSession(projectId: string): Promise<AnalysisSession> {
  const db = getDb();
  const [session] = await db
    .insert(analysisSessions)
    .values({
      projectId,
      type: 'correlation',
      status: 'running',
    })
    .returning();

  return session;
}

/**
 * Validates that every referenced finding ID in every correlation/actionPlan item
 * strictly exists within the available exposed findings set for this project correlation run.
 * Fails closed if any unexposed or invalid finding ID is referenced.
 */
export function validateReportGrounding(
  correlations: GroundedCorrelation[],
  availableFindingsMap: Map<string, Finding>
): void {
  for (const corr of correlations) {
    if (!Array.isArray(corr.findingIds) || corr.findingIds.length === 0) {
      throw new InvalidGroundingError(
        `Action plan item '${corr.id}' contains no referenced finding IDs.`
      );
    }

    for (const fid of corr.findingIds) {
      if (!availableFindingsMap.has(fid)) {
        throw new InvalidGroundingError(
          `Action plan item '${corr.id}' references unexposed finding ID '${fid}' which does not exist in available session findings.`
        );
      }
    }
  }
}

/**
 * Validates report grounding and transactionally persists the report row while updating
 * the correlation analysis_sessions status to 'completed'.
 */
export async function persistCorrelationReport(params: {
  sessionId: string;
  projectId: string;
  summary: string;
  correlations: GroundedCorrelation[];
  availableFindingsMap: Map<string, Finding>;
}): Promise<{ report: Report; session: AnalysisSession }> {
  const { sessionId, summary, correlations, availableFindingsMap } = params;

  // 1. Server-side grounding boundary check
  validateReportGrounding(correlations, availableFindingsMap);

  const db = getDb();

  // 2. Transactional persistence: insert report + update correlation session status
  const result = await db.transaction(async (tx) => {
    const [reportRow] = await tx
      .insert(reports)
      .values({
        sessionId,
        summary: summary || 'Correlation analysis completed successfully.',
        actionPlan: correlations as unknown as Record<string, unknown>[],
        generatedAt: new Date(),
      })
      .returning();

    const [sessionRow] = await tx
      .update(analysisSessions)
      .set({
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(analysisSessions.id, sessionId))
      .returning();

    return { report: reportRow, session: sessionRow };
  });

  return result;
}

/**
 * Updates a correlation session status to 'failed'.
 */
export async function failCorrelationSession(sessionId: string): Promise<void> {
  const db = getDb();
  await db
    .update(analysisSessions)
    .set({
      status: 'failed',
      completedAt: new Date(),
    })
    .where(eq(analysisSessions.id, sessionId));
}

/**
 * Retrieves the latest completed correlation report for a project.
 */
export async function getLatestCorrelationReport(params: {
  clerkId: string;
  projectId: string;
}): Promise<{ report: Report; session: AnalysisSession } | null> {
  const db = getDb();
  const { project } = await resolveAuthorizedProject(params.clerkId, params.projectId);

  const sessionRows = await db
    .select()
    .from(analysisSessions)
    .where(
      and(
        eq(analysisSessions.projectId, project.id),
        eq(analysisSessions.type, 'correlation'),
        eq(analysisSessions.status, 'completed')
      )
    )
    .orderBy(desc(analysisSessions.startedAt))
    .limit(1);

  const session = sessionRows[0];
  if (!session) {
    return null;
  }

  const reportRows = await db
    .select()
    .from(reports)
    .where(eq(reports.sessionId, session.id))
    .limit(1);

  const report = reportRows[0];
  if (!report) {
    return null;
  }

  return { report, session };
}

/**
 * Formats a typed CorrelationSSEEvent into standard Server-Sent Event format string.
 */
export function formatSSEEvent(event: CorrelationSSEEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
