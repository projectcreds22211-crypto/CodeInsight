import { and, desc, eq } from 'drizzle-orm';
import fs from 'node:fs';
import path from 'node:path';
import {
  enhanceLogFindingsWithClaude,
  generateLogOptimizationsWithClaude,
  logAnalyzer,
  mapDbRowToFinding,
  mapFindingToDbMetadata,
  parseLogsInput,
  type LogAnalyzerInput,
  type LogAnalyzerResult,
  type LogRecord,
} from '../analyzers/logs/index.js';
import { getDb } from '../db/client.js';
import { analysisSessions, findings, projects, users, type Project } from '../db/schema.js';
import { UserNotFoundError } from './project.service.js';

export class ProjectNotFoundError extends Error {
  constructor(projectId: string) {
    super(`Project '${projectId}' not found or user is not authorized to access it.`);
    this.name = 'ProjectNotFoundError';
  }
}

export class InvalidInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidInputError';
  }
}

export class NoAnalysisSessionFoundError extends Error {
  constructor(projectId: string) {
    super(`No completed log analysis session found for project '${projectId}'.`);
    this.name = 'NoAnalysisSessionFoundError';
  }
}

/**
 * Load demo sample-logs.json as fallback for demo repository execution.
 */
function getDemoLogsInput(): string {
  try {
    const demoLogsPath = path.resolve(
      process.cwd(),
      '../codeinsight-demo-repo/logs/sample-logs.json'
    );
    if (fs.existsSync(demoLogsPath)) {
      return fs.readFileSync(demoLogsPath, 'utf-8');
    }
  } catch (err: unknown) {
    // Ignore fallback errors and return empty fallback
  }
  return '[]';
}

/**
 * Resolve internal user and verify project ownership for the given Clerk user ID and Project UUID.
 */
export async function resolveAuthorizedProject(
  clerkId: string,
  projectId: string
): Promise<{ userId: string; project: Project }> {
  const db = getDb();

  const userRows = await db.select().from(users).where(eq(users.clerkId, clerkId)).limit(1);
  const user = userRows[0];
  if (!user) {
    throw new UserNotFoundError(clerkId);
  }

  const projectRows = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.userId, user.id)))
    .limit(1);

  const project = projectRows[0];
  if (!project) {
    throw new ProjectNotFoundError(projectId);
  }

  return { userId: user.id, project };
}

/**
 * Execute full Log Analyzer workflow:
 * 1. Verify project ownership
 * 2. Resolve log payload (request body or demo repo fallback)
 * 3. Create analysis_sessions row (running)
 * 4. Run deterministic anomaly engine & time-window pattern rules (LogAnalyzer)
 * 5. Run Claude explanation/correlation prompt layer
 * 6. Persist findings to database
 * 7. Update analysis_sessions row (completed)
 * 8. Return structured LogAnalyzerResult
 */
export async function runAndPersistLogAnalysis(params: {
  clerkId: string;
  projectId: string;
  input?: { logs?: unknown; logsJson?: unknown };
}): Promise<LogAnalyzerResult> {
  const db = getDb();
  const { project } = await resolveAuthorizedProject(params.clerkId, params.projectId);

  // Payload extraction: accept { logs: [...] }, { logsJson: [...] }, or raw payload
  let rawLogs: unknown = params.input?.logs ?? params.input?.logsJson;

  if (rawLogs === undefined && params.input && typeof params.input === 'object') {
    if (Array.isArray(params.input)) {
      rawLogs = params.input;
    }
  }

  // Demo repo fallback if payload is missing or empty
  if ((!rawLogs || (Array.isArray(rawLogs) && rawLogs.length === 0)) && project.isDemoRepository) {
    rawLogs = getDemoLogsInput();
  }

  if (!rawLogs) {
    throw new InvalidInputError('logs payload is required for log analysis');
  }

  let logsJsonPayload: string | LogRecord[];
  if (typeof rawLogs === 'string') {
    if (!rawLogs.trim()) {
      throw new InvalidInputError('logs string payload cannot be empty');
    }
    logsJsonPayload = rawLogs.trim();
  } else if (Array.isArray(rawLogs) || typeof rawLogs === 'object') {
    if (Array.isArray(rawLogs) && rawLogs.length === 0) {
      throw new InvalidInputError('logs payload array cannot be empty');
    }
    logsJsonPayload = rawLogs as LogRecord[];
  } else {
    throw new InvalidInputError('Invalid logs payload format');
  }

  // Validate parsing before creating session row
  const parseCheck = parseLogsInput(logsJsonPayload);
  if (!parseCheck.success || parseCheck.records.length === 0) {
    throw new InvalidInputError(parseCheck.error || 'Log payload contains no valid log records');
  }

  const analyzerInput: LogAnalyzerInput = {
    logsJson: logsJsonPayload,
  };

  // 1. Create analysis session record in 'running' status
  const insertedSessions = await db
    .insert(analysisSessions)
    .values({
      projectId: project.id,
      type: 'logs',
      status: 'running',
      startedAt: new Date(),
    })
    .returning();

  const session = insertedSessions[0];
  if (!session) {
    throw new Error('Failed to create analysis_session database record.');
  }

  try {
    // 2. Execute deterministic Log Analyzer (Phase 4.1 point anomalies + Phase 4.2 time-window pattern rules)
    const deterministicResult = await logAnalyzer.analyze(analyzerInput, {
      sessionId: session.id,
    });

    if (deterministicResult.status === 'failed') {
      await db
        .update(analysisSessions)
        .set({ status: 'failed', completedAt: new Date() })
        .where(eq(analysisSessions.id, session.id));

      return deterministicResult;
    }

    // 3. Run Claude explanation & correlation prompt layer (Phase 4.3)
    const claudeResponse = await generateLogOptimizationsWithClaude({
      records: parseCheck.records,
      findings: deterministicResult.findings,
    });

    // 4. Enhance findings with Claude explanations & correlation information
    const enhancedFindings = enhanceLogFindingsWithClaude(
      deterministicResult.findings,
      claudeResponse
    );

    // 5. Persist enhanced findings to 'findings' table
    if (enhancedFindings.length > 0) {
      const dbFindingRows = enhancedFindings.map((f) => ({
        sessionId: session.id,
        category: f.category,
        severity: f.severity,
        title: f.title,
        description: f.description,
        metadata: mapFindingToDbMetadata(f),
        createdAt: new Date(),
      }));

      await db.insert(findings).values(dbFindingRows);
    }

    // 6. Update analysis session status to 'completed'
    await db
      .update(analysisSessions)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(analysisSessions.id, session.id));

    // Re-calculate summary counts
    const severityCounts = { low: 0, medium: 0, high: 0, critical: 0 };
    const categoryCounts = { architecture: 0, tech_debt: 0, query_optimization: 0, anomaly: 0 };

    for (const f of enhancedFindings) {
      if (f.severity in severityCounts) severityCounts[f.severity as keyof typeof severityCounts]++;
      if (f.category in categoryCounts) categoryCounts[f.category as keyof typeof categoryCounts]++;
    }

    return {
      sessionId: session.id,
      analyzerType: 'logs',
      status: 'completed',
      findings: enhancedFindings,
      summary: {
        totalFindings: enhancedFindings.length,
        severityCounts,
        categoryCounts,
      },
      metrics: deterministicResult.metrics,
      customData: {
        recommendation: claudeResponse.summaryOverview || 'Log analysis completed successfully.',
      },
    };
  } catch (err: unknown) {
    await db
      .update(analysisSessions)
      .set({ status: 'failed', completedAt: new Date() })
      .where(eq(analysisSessions.id, session.id));

    throw err;
  }
}

/**
 * Retrieve latest completed log analysis session and findings for a project.
 */
export async function getLatestLogAnalysis(params: {
  clerkId: string;
  projectId: string;
}): Promise<LogAnalyzerResult> {
  const db = getDb();
  const { project } = await resolveAuthorizedProject(params.clerkId, params.projectId);

  // Find latest completed log analysis session
  const sessionRows = await db
    .select()
    .from(analysisSessions)
    .where(
      and(
        eq(analysisSessions.projectId, project.id),
        eq(analysisSessions.type, 'logs'),
        eq(analysisSessions.status, 'completed')
      )
    )
    .orderBy(desc(analysisSessions.startedAt))
    .limit(1);

  const session = sessionRows[0];
  if (!session) {
    throw new NoAnalysisSessionFoundError(project.id);
  }

  // Load findings for session
  const findingRows = await db
    .select()
    .from(findings)
    .where(eq(findings.sessionId, session.id))
    .orderBy(desc(findings.createdAt));

  const mappedFindings = findingRows.map((row) => mapDbRowToFinding(row));

  const severityCounts = { low: 0, medium: 0, high: 0, critical: 0 };
  const categoryCounts = { architecture: 0, tech_debt: 0, query_optimization: 0, anomaly: 0 };

  for (const f of mappedFindings) {
    if (f.severity in severityCounts) severityCounts[f.severity as keyof typeof severityCounts]++;
    if (f.category in categoryCounts) categoryCounts[f.category as keyof typeof categoryCounts]++;
  }

  return {
    sessionId: session.id,
    analyzerType: 'logs',
    status: 'completed',
    findings: mappedFindings,
    summary: {
      totalFindings: mappedFindings.length,
      severityCounts,
      categoryCounts,
    },
    metrics: {
      score: Math.max(
        0,
        100 -
          (severityCounts.critical * 25 +
            severityCounts.high * 15 +
            severityCounts.medium * 8 +
            severityCounts.low * 3)
      ),
      performanceMs: 0,
      itemsAnalyzed: mappedFindings.length,
      rulesEvaluated: 8,
    },
  };
}
