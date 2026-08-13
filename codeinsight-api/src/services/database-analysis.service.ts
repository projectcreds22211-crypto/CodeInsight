import { and, desc, eq } from 'drizzle-orm';
import {
  databaseAnalyzer,
  DEMO_DATABASE_INPUT,
  enhanceFindingsWithClaude,
  generateDatabaseOptimizationsWithClaude,
  mapDbRowToFinding,
  mapFindingToDbMetadata,
  type DatabaseAnalyzerInput,
  type DatabaseAnalyzerResult,
  type DatabaseFindingMetadata,
} from '../analyzers/database/index.js';
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
    super(`No completed database analysis session found for project '${projectId}'.`);
    this.name = 'NoAnalysisSessionFoundError';
  }
}

/**
 * Resolve internal user and verify project ownership for the given Clerk user ID and Project UUID.
 * Returns both the User and Project records if authorized, or throws appropriate errors.
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
 * Execute full Database Analyzer workflow:
 * 1. Verify project ownership
 * 2. Resolve input (request payload or demo repo fallback)
 * 3. Create analysis_sessions row (running)
 * 4. Run deterministic rules engine (DatabaseAnalyzer)
 * 5. Run Claude prompt enhancement layer
 * 6. Persist findings to database
 * 7. Update analysis_sessions row (completed)
 * 8. Return structured DatabaseAnalyzerResult
 */
export async function runAndPersistDatabaseAnalysis(params: {
  clerkId: string;
  projectId: string;
  input?: { schemaSql?: string; queriesSql?: string[] };
}): Promise<DatabaseAnalyzerResult> {
  const db = getDb();
  const { project } = await resolveAuthorizedProject(params.clerkId, params.projectId);

  // Input resolution: custom payload or demo repository fallback
  let schemaSql = params.input?.schemaSql;
  let queriesSql = params.input?.queriesSql;

  if ((!schemaSql || !queriesSql || queriesSql.length === 0) && project.isDemoRepository) {
    schemaSql = DEMO_DATABASE_INPUT.schemaSql;
    queriesSql = DEMO_DATABASE_INPUT.queriesSql;
  }

  if (!schemaSql || typeof schemaSql !== 'string' || schemaSql.trim().length === 0) {
    throw new InvalidInputError('schemaSql is required for database analysis');
  }

  if (!Array.isArray(queriesSql) || queriesSql.length === 0) {
    throw new InvalidInputError('queriesSql must be a non-empty array of SQL queries');
  }

  const analyzerInput: DatabaseAnalyzerInput = {
    schemaSql: schemaSql.trim(),
    queriesSql: queriesSql.map((q) => q.trim()),
  };

  // 1. Create analysis session record in 'running' status
  const insertedSessions = await db
    .insert(analysisSessions)
    .values({
      projectId: project.id,
      type: 'database',
      status: 'running',
      startedAt: new Date(),
    })
    .returning();

  const session = insertedSessions[0];
  if (!session) {
    throw new Error('Failed to create analysis_session database record.');
  }

  try {
    // 2. Execute deterministic database analyzer
    const deterministicResult = await databaseAnalyzer.analyze(analyzerInput, {
      sessionId: session.id,
    });

    if (deterministicResult.status === 'failed') {
      await db
        .update(analysisSessions)
        .set({ status: 'failed', completedAt: new Date() })
        .where(eq(analysisSessions.id, session.id));

      return deterministicResult;
    }

    // 3. Run Claude prompt enhancement layer
    const claudeResponse = await generateDatabaseOptimizationsWithClaude({
      schemaSql: analyzerInput.schemaSql,
      queriesSql: analyzerInput.queriesSql,
      findings: deterministicResult.findings,
    });

    // 4. Enhance findings with Claude explanations & query rewrites
    const enhancedFindings = enhanceFindingsWithClaude(
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

    // Re-calculate summary to reflect enhanced findings
    const severityCounts = { low: 0, medium: 0, high: 0, critical: 0 };
    const categoryCounts = { architecture: 0, tech_debt: 0, query_optimization: 0, anomaly: 0 };

    for (const f of enhancedFindings) {
      if (f.severity in severityCounts) severityCounts[f.severity]++;
      if (f.category in categoryCounts) categoryCounts[f.category]++;
    }

    return {
      sessionId: session.id,
      analyzerType: 'database',
      status: 'completed',
      findings: enhancedFindings,
      summary: {
        totalFindings: enhancedFindings.length,
        severityCounts,
        categoryCounts,
      },
      metrics: deterministicResult.metrics,
      customData: {
        ruleId: 'select-star',
        recommendation: claudeResponse.summaryOverview || 'Analysis completed successfully.',
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
 * Retrieve latest completed database analysis session and findings for a project.
 */
export async function getLatestDatabaseAnalysis(params: {
  clerkId: string;
  projectId: string;
}): Promise<DatabaseAnalyzerResult> {
  const db = getDb();
  const { project } = await resolveAuthorizedProject(params.clerkId, params.projectId);

  // Find latest completed database analysis session
  const sessionRows = await db
    .select()
    .from(analysisSessions)
    .where(
      and(
        eq(analysisSessions.projectId, project.id),
        eq(analysisSessions.type, 'database'),
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
    if (f.severity in severityCounts) severityCounts[f.severity]++;
    if (f.category in categoryCounts) categoryCounts[f.category]++;
  }

  return {
    sessionId: session.id,
    analyzerType: 'database',
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
      rulesEvaluated: 7,
    },
  };
}
