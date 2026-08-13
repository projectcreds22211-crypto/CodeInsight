import type {
  Analyzer,
  AnalyzerMetrics,
  AnalyzerResult,
  AnalyzerSummary,
  AnalyzerType,
  Category,
  Finding,
  Result,
  Severity,
} from '@codeinsight/shared-contracts';
import { runDatabaseRules } from './rules.js';
import type { DatabaseAnalyzerInput, DatabaseFindingMetadata } from './types.js';

export class DatabaseAnalyzer implements Analyzer<
  DatabaseAnalyzerInput,
  AnalyzerResult<DatabaseFindingMetadata>
> {
  readonly id: AnalyzerType = 'database';
  readonly displayName = 'Database Analyzer';

  /**
   * Validate that input contains valid schema and query collections before execution.
   */
  validateInput(input: DatabaseAnalyzerInput): Result<void> {
    if (!input) {
      return {
        success: false,
        error: 'DatabaseAnalyzerInput payload is required',
        retryable: false,
      };
    }
    if (typeof input.schemaSql !== 'string' || input.schemaSql.trim().length === 0) {
      return { success: false, error: 'schemaSql must be a non-empty string', retryable: false };
    }
    if (!Array.isArray(input.queriesSql) || input.queriesSql.length === 0) {
      return {
        success: false,
        error: 'queriesSql must be a non-empty array of SQL queries',
        retryable: false,
      };
    }
    return { success: true, data: undefined };
  }

  /**
   * Execute deterministic SQL AST rules and return a typed AnalyzerResult container payload.
   */
  async analyze(
    input: DatabaseAnalyzerInput,
    options: { sessionId?: string } = {}
  ): Promise<AnalyzerResult<DatabaseFindingMetadata>> {
    const startTime = Date.now();
    const sessionId = options.sessionId || 'session-db-default';

    const validation = this.validateInput(input);
    if (!validation.success) {
      return {
        sessionId,
        analyzerType: 'database',
        status: 'failed',
        findings: [],
        summary: {
          totalFindings: 0,
          severityCounts: { low: 0, medium: 0, high: 0, critical: 0 },
          categoryCounts: { architecture: 0, tech_debt: 0, query_optimization: 0, anomaly: 0 },
        },
        metrics: {
          score: 100,
          performanceMs: Date.now() - startTime,
          itemsAnalyzed: 0,
          rulesEvaluated: 7,
        },
        customData: {
          ruleId: 'select-star',
          recommendation: validation.error,
        },
      };
    }

    try {
      const findings = runDatabaseRules(input, sessionId);
      const executionMs = Date.now() - startTime;

      const summary = this.buildSummary(findings);
      const metrics = this.buildMetrics(input, findings, executionMs);

      return {
        sessionId,
        analyzerType: 'database',
        status: 'completed',
        findings,
        summary,
        metrics,
      };
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      return {
        sessionId,
        analyzerType: 'database',
        status: 'failed',
        findings: [],
        summary: {
          totalFindings: 0,
          severityCounts: { low: 0, medium: 0, high: 0, critical: 0 },
          categoryCounts: { architecture: 0, tech_debt: 0, query_optimization: 0, anomaly: 0 },
        },
        metrics: {
          score: 0,
          performanceMs: Date.now() - startTime,
          itemsAnalyzed: input.queriesSql.length,
          rulesEvaluated: 7,
        },
        customData: {
          ruleId: 'select-star',
          recommendation: `Analyzer Execution Error: ${errorMessage}`,
        },
      };
    }
  }

  private buildSummary(findings: Finding[]): AnalyzerSummary {
    const severityCounts: Record<Severity, number> = { low: 0, medium: 0, high: 0, critical: 0 };
    const categoryCounts: Record<Category, number> = {
      architecture: 0,
      tech_debt: 0,
      query_optimization: 0,
      anomaly: 0,
    };

    for (const f of findings) {
      if (f.severity in severityCounts) {
        severityCounts[f.severity]++;
      }
      if (f.category in categoryCounts) {
        categoryCounts[f.category]++;
      }
    }

    return {
      totalFindings: findings.length,
      severityCounts,
      categoryCounts,
    };
  }

  private buildMetrics(
    input: DatabaseAnalyzerInput,
    findings: Finding[],
    performanceMs: number
  ): AnalyzerMetrics {
    // Composite database score (100 base score minus severity deductions)
    let penalty = 0;
    for (const f of findings) {
      if (f.severity === 'critical') penalty += 25;
      else if (f.severity === 'high') penalty += 15;
      else if (f.severity === 'medium') penalty += 8;
      else if (f.severity === 'low') penalty += 3;
    }

    const score = Math.max(0, 100 - penalty);

    return {
      score,
      performanceMs,
      itemsAnalyzed: input.queriesSql.length,
      rulesEvaluated: 7,
    };
  }
}

export const databaseAnalyzer = new DatabaseAnalyzer();
