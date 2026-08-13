import type {
  AnalyzerResult,
  Category,
  Evidence,
  Finding,
  Severity,
} from '@codeinsight/shared-contracts';

/**
 * Input contract consumed by the Database Analyzer service.
 * Standardized across API route payloads and benchmark fixtures.
 */
export interface DatabaseAnalyzerInput {
  schemaSql: string;
  queriesSql: string[];
}

/**
 * Deterministic database rule identifiers evaluated by the analyzer.
 */
export type DatabaseRuleId =
  | 'select-star'
  | 'missing-limit'
  | 'unindexed-order-by'
  | 'correlated-subquery'
  | 'unnecessary-distinct'
  | 'duplicate-query'
  | 'repeated-where-clause'
  | 'missing-index';

/**
 * Type-safe metadata structure stored inside `Finding.metadata` and persisted to DB JSONB.
 */
export interface DatabaseFindingMetadata extends Record<string, unknown> {
  ruleId: DatabaseRuleId;
  queryIndex?: number;
  queryIndices?: number[];
  queryText?: string;
  table?: string;
  column?: string;
  suggestedIndex?: string;
  rewrittenQuery?: string;
  recommendation?: string;
  evidence?: Evidence[];
}

/**
 * Specialized type alias for Database Analyzer outputs.
 */
export type DatabaseAnalyzerResult = AnalyzerResult<DatabaseFindingMetadata>;

/**
 * Helper utility mapping a shared Finding model to database persistence metadata structure.
 * Respects Phase 3.1 schema boundary (persisting recommendation & evidence in JSONB metadata).
 */
export function mapFindingToDbMetadata(finding: Finding): Record<string, unknown> {
  return {
    ...(finding.metadata || {}),
    recommendation: finding.recommendation,
    evidence: finding.evidence,
  };
}

/**
 * Helper utility restoring a shared Finding model from persisted DB finding row.
 */
export function mapDbRowToFinding(row: {
  id: string;
  sessionId: string;
  category: Category;
  severity: Severity;
  title: string;
  description: string;
  metadata: unknown;
  createdAt: Date | string;
}): Finding {
  const meta = (row.metadata && typeof row.metadata === 'object' ? row.metadata : {}) as Record<
    string,
    unknown
  >;
  const recommendation = typeof meta['recommendation'] === 'string' ? meta['recommendation'] : '';
  const evidence = Array.isArray(meta['evidence']) ? (meta['evidence'] as Evidence[]) : [];

  return {
    id: row.id,
    sessionId: row.sessionId,
    analyzer: 'database',
    category: row.category,
    severity: row.severity,
    title: row.title,
    description: row.description,
    recommendation,
    evidence,
    metadata: meta,
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt),
  };
}
