import { and, desc, eq } from 'drizzle-orm';
import type {
  AnalyzerResult,
  Category,
  Evidence,
  Finding,
  Severity,
} from '@codeinsight/shared-contracts';
import type {
  CodeSmellObservation,
  CodeTechDebtScore,
  DependencyCycle,
} from '../analyzers/code/ast/types.js';
import { detectCircularDependencies } from '../analyzers/code/ast/cycle-detector.js';
import { buildModuleDependencyGraph } from '../analyzers/code/ast/graph-builder.js';
import { analyzeCodeSmells } from '../analyzers/code/ast/smell-engine.js';
import { calculateCodeTechDebtScore } from '../analyzers/code/ast/tech-debt-scorer.js';
import {
  enhanceCodeObservationsWithClaude,
  generateCodeOptimizationsWithClaude,
} from '../analyzers/code/prompt.js';
import {
  validateGitHubUrl,
  withClonedRepository,
} from '../analyzers/code/repository/repository-cloner.js';
import { inspectClonedRepositorySafety } from '../analyzers/code/repository/repository-safety.js';
import { DEMO_REPOSITORY_CONFIG } from '../config/demo-repository.js';
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
    super(`No completed code analysis session found for project '${projectId}'.`);
    this.name = 'NoAnalysisSessionFoundError';
  }
}

export interface CodeAnalyzerCustomData {
  techDebtScore?: CodeTechDebtScore;
  totalCycles?: number;
  totalObservations?: number;
  summaryOverview?: string;
  [key: string]: unknown;
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
 * Maps DB finding row back to shared Finding contract for Code Analyzer findings.
 */
export function mapDbRowToFinding(row: typeof findings.$inferSelect): Finding {
  const meta = (row.metadata || {}) as Record<string, unknown>;
  const evidenceList = Array.isArray(meta.evidence) ? (meta.evidence as Evidence[]) : [];

  return {
    id: row.id,
    sessionId: row.sessionId,
    analyzer: 'code',
    category: row.category as Category,
    severity: row.severity as Severity,
    title: row.title,
    description: row.description,
    recommendation:
      typeof meta.recommendation === 'string'
        ? meta.recommendation
        : 'Refactor code to resolve architectural or quality finding.',
    evidence: evidenceList,
    metadata: meta,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Converts a DependencyCycle object into a standardized Finding model.
 */
function createCycleFinding(
  c: DependencyCycle,
  sessionId: string,
  techDebtScore: CodeTechDebtScore,
  summaryOverview?: string
): Finding {
  const nodeSummary = c.nodes.slice(0, 4).join(' → ');
  const title = `Circular Dependency: ${c.nodes[0] || 'Module'} ↔ ${c.nodes[1] || 'Module'}`;
  const description = `Discovered a circular dependency cycle of length ${c.length} participating modules: ${c.nodes.join(' → ')}`;
  const recommendation = `Refactor dependencies between ${c.nodes[0] || 'modules'} to break the cycle using interface abstraction, dependency injection, or extracting shared utility logic.`;

  const evidence: Evidence[] = [
    {
      source: c.nodes[0] || 'module-graph',
      snippet: c.nodes.join(' → '),
    },
  ];

  return {
    id: c.id,
    sessionId,
    analyzer: 'code',
    category: 'architecture',
    severity: 'high',
    title,
    description,
    recommendation,
    evidence,
    metadata: {
      ruleId: 'circular-dependency',
      cycleId: c.id,
      nodes: c.nodes,
      cycleLength: c.length,
      techDebtScore,
      summaryOverview,
      evidence,
      recommendation,
    },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Converts a CodeSmellObservation object into a standardized Finding model.
 */
function createSmellFinding(
  obs: CodeSmellObservation,
  sessionId: string,
  techDebtScore: CodeTechDebtScore,
  summaryOverview?: string
): Finding {
  const aiExplanation = obs.metadata?.aiExplanation as Record<string, unknown> | undefined;
  const recommendation =
    typeof aiExplanation?.recommendation === 'string' && aiExplanation.recommendation.trim()
      ? aiExplanation.recommendation.trim()
      : `Refactor source file '${obs.file}' to address ${obs.ruleId} code smell.`;

  const evidence: Evidence[] = [
    {
      source: obs.file,
      lineStart: obs.startLine,
      lineEnd: obs.endLine,
      snippet: obs.message,
    },
  ];

  return {
    id: obs.id,
    sessionId,
    analyzer: 'code',
    category: 'tech_debt',
    severity: obs.severity as Severity,
    title: `Code Smell (${obs.ruleId}): ${obs.file}`,
    description: obs.message,
    recommendation,
    evidence,
    metadata: {
      ruleId: obs.ruleId,
      file: obs.file,
      startLine: obs.startLine,
      endLine: obs.endLine,
      smellMetadata: obs.metadata,
      aiExplanation,
      techDebtScore,
      summaryOverview,
      evidence,
      recommendation,
    },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Execute full Code Analyzer pipeline:
 * 1. Verify project ownership & authenticate user
 * 2. Validate repository URL
 * 3. Create analysis_session (running)
 * 4. Acquire shallow repository clone (guaranteed temp dir cleanup)
 * 5. Build module dependency graph (ts-morph)
 * 6. Detect circular dependencies (Tarjan SCC)
 * 7. Run code smell heuristics engine
 * 8. Calculate composite tech-debt score
 * 9. Run Claude explanation & refactoring prompt layer (advisory fallback)
 * 10. Persist findings to database
 * 11. Update session status (completed)
 * 12. Return structured AnalyzerResult payload
 */
export async function runAndPersistCodeAnalysis(params: {
  clerkId: string;
  projectId: string;
  input?: { githubUrl?: string };
}): Promise<AnalyzerResult<CodeAnalyzerCustomData>> {
  const db = getDb();
  const startTime = Date.now();
  const { project } = await resolveAuthorizedProject(params.clerkId, params.projectId);

  // Input URL resolution: request body, project githubUrl, or demo repo fallback
  let rawUrl = params.input?.githubUrl || project.githubUrl;
  if ((!rawUrl || rawUrl.trim().length === 0) && project.isDemoRepository) {
    rawUrl = DEMO_REPOSITORY_CONFIG.githubUrl;
  }

  if (!rawUrl || typeof rawUrl !== 'string' || rawUrl.trim().length === 0) {
    throw new InvalidInputError('githubUrl is required for code repository analysis');
  }

  const urlValidation = validateGitHubUrl(rawUrl);
  if (!urlValidation.valid || !urlValidation.normalizedUrl) {
    throw new InvalidInputError(urlValidation.error || 'Invalid GitHub repository URL');
  }

  const normalizedUrl = urlValidation.normalizedUrl;

  // 1. Create analysis session record in 'running' status
  const insertedSessions = await db
    .insert(analysisSessions)
    .values({
      projectId: project.id,
      type: 'code',
      status: 'running',
      startedAt: new Date(),
    })
    .returning();

  const session = insertedSessions[0];
  if (!session) {
    throw new Error('Failed to create analysis_session database record for code analysis.');
  }

  try {
    // 2. Clone repository & run pipeline inside guaranteed cleanup block
    const result = await withClonedRepository(normalizedUrl, async (cloneCtx) => {
      // Safety Check: Verify repository file counts and size bounds (Phase 7.6)
      await inspectClonedRepositorySafety(cloneCtx.tempDir);

      // Step A: Build module dependency graph (Phase 5.2)
      const graph = await buildModuleDependencyGraph(cloneCtx.tempDir);

      // Step B: Detect circular dependencies (Phase 5.3)
      const cyclesResult = detectCircularDependencies(graph);

      // Step C: Run code smell heuristics engine (Phase 5.4)
      const smellsResult = await analyzeCodeSmells(cloneCtx.tempDir, graph);

      // Step D: Calculate composite tech-debt score (Phase 5.5)
      const techDebtScore = calculateCodeTechDebtScore(cyclesResult, smellsResult);

      // Step E: Run Claude explanation & refactor prompt layer (Phase 5.6)
      const claudeResponse = await generateCodeOptimizationsWithClaude({
        cyclesResult,
        smellsResult,
        techDebtScore,
        rootDir: cloneCtx.tempDir,
      });

      // Step F: Enhance smell observations with Claude advice
      const enhancedSmells = enhanceCodeObservationsWithClaude(smellsResult, claudeResponse);

      // Step G: Map cycles & smells to unified Finding models
      const cycleFindings = (cyclesResult.cycles || []).map((c) =>
        createCycleFinding(c, session.id, techDebtScore, claudeResponse.summaryOverview)
      );
      const smellFindings = (enhancedSmells.observations || []).map((obs) =>
        createSmellFinding(obs, session.id, techDebtScore, claudeResponse.summaryOverview)
      );

      const allFindings: Finding[] = [...cycleFindings, ...smellFindings];

      // Step H: Persist findings to database
      if (allFindings.length > 0) {
        const dbFindingRows = allFindings.map((f) => ({
          sessionId: session.id,
          category: f.category,
          severity: f.severity,
          title: f.title,
          description: f.description,
          metadata: {
            ...(f.metadata || {}),
            recommendation: f.recommendation,
            evidence: f.evidence,
          },
          createdAt: new Date(),
        }));

        await db.insert(findings).values(dbFindingRows);
      }

      // Step I: Update session status to completed
      await db
        .update(analysisSessions)
        .set({ status: 'completed', completedAt: new Date() })
        .where(eq(analysisSessions.id, session.id));

      const executionMs = Date.now() - startTime;
      const severityCounts = { low: 0, medium: 0, high: 0, critical: 0 };
      const categoryCounts = { architecture: 0, tech_debt: 0, query_optimization: 0, anomaly: 0 };

      for (const f of allFindings) {
        if (f.severity in severityCounts) severityCounts[f.severity]++;
        if (f.category in categoryCounts) categoryCounts[f.category]++;
      }

      return {
        sessionId: session.id,
        analyzerType: 'code' as const,
        status: 'completed' as const,
        findings: allFindings,
        summary: {
          totalFindings: allFindings.length,
          severityCounts,
          categoryCounts,
        },
        metrics: {
          score: techDebtScore.score,
          performanceMs: executionMs,
          itemsAnalyzed: smellsResult.metrics?.totalSourceFiles || graph.nodes.length,
          rulesEvaluated: 5,
        },
        customData: {
          techDebtScore,
          totalCycles: cyclesResult.totalCycles,
          totalObservations: smellsResult.summary.totalObservations,
          summaryOverview:
            claudeResponse.summaryOverview || 'Code analysis completed successfully.',
        },
      };
    });

    return result;
  } catch (err: unknown) {
    // Ensure session is marked failed if clone or analysis pipeline throws
    await db
      .update(analysisSessions)
      .set({ status: 'failed', completedAt: new Date() })
      .where(eq(analysisSessions.id, session.id));

    throw err;
  }
}

/**
 * Retrieve latest completed Code Analyzer session and findings for a project.
 */
export async function getLatestCodeAnalysis(params: {
  clerkId: string;
  projectId: string;
}): Promise<AnalyzerResult<CodeAnalyzerCustomData>> {
  const db = getDb();
  const { project } = await resolveAuthorizedProject(params.clerkId, params.projectId);

  // Find latest completed code analysis session
  const sessionRows = await db
    .select()
    .from(analysisSessions)
    .where(
      and(
        eq(analysisSessions.projectId, project.id),
        eq(analysisSessions.type, 'code'),
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

  const firstMeta = mappedFindings[0]?.metadata as Record<string, unknown> | undefined;
  const techDebtScore = (firstMeta?.techDebtScore as CodeTechDebtScore) || {
    score: 100,
    band: 'healthy',
    isEmptyRepository: mappedFindings.length === 0,
    counts: {
      circularDependencies: 0,
      longFunctions: 0,
      highSeverityLongFunctions: 0,
      duplicateLogic: 0,
      potentiallyUnusedExports: 0,
      todoMarkers: 0,
      fixmeMarkers: 0,
      hackMarkers: 0,
      xxxMarkers: 0,
      productionFiles: 0,
      testFiles: 0,
    },
    penalties: {
      circularDependencies: 0,
      longFunctions: 0,
      duplicateLogic: 0,
      potentiallyUnusedExports: 0,
      commentDebt: 0,
      testFileRatio: 0,
      total: 0,
    },
    testFileRatio: 1.0,
  };

  const summaryOverview =
    (firstMeta?.summaryOverview as string) || 'Retrieved latest completed code analysis.';

  return {
    sessionId: session.id,
    analyzerType: 'code',
    status: 'completed',
    findings: mappedFindings,
    summary: {
      totalFindings: mappedFindings.length,
      severityCounts,
      categoryCounts,
    },
    metrics: {
      score: techDebtScore.score,
      performanceMs: 0,
      itemsAnalyzed: mappedFindings.length,
      rulesEvaluated: 5,
    },
    customData: {
      techDebtScore,
      totalCycles: categoryCounts.architecture,
      totalObservations: categoryCounts.tech_debt,
      summaryOverview,
    },
  };
}
