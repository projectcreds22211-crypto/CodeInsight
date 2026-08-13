/**
 * Represents a source file node in the module dependency graph
 */
export interface DependencyNode {
  /** Stable repository-relative file path (e.g., "src/services/user.ts") */
  id: string;
  /** Repository-relative file path */
  path: string;
}

/**
 * Edge relationship type: internal local file import vs external npm package dependency
 */
export type DependencyEdgeKind = 'internal' | 'external';

/**
 * Represents a dependency edge between modules or package dependencies
 */
export interface DependencyEdge {
  /** Repository-relative path of importing module */
  source: string;
  /** Target module path (internal) or package name (external) */
  target: string;
  /** Kind of dependency relationship */
  kind: DependencyEdgeKind;
  /** Raw import specifier string in code (e.g., "./utils", "react") */
  specifier: string;
}

/**
 * Complete normalized module dependency graph
 */
export interface ModuleDependencyGraph {
  /** Discovered source file nodes */
  nodes: DependencyNode[];
  /** Dependency edges between modules */
  edges: DependencyEdge[];
  /** Entrypoint modules (internal nodes with 0 incoming internal dependencies) */
  entrypoints: string[];
}

/**
 * Represents a circular dependency cycle discovered in the module graph
 */
export interface DependencyCycle {
  /** Deterministic cycle identifier */
  id: string;
  /** Sequence of module IDs in cycle order, starting and ending with canonical start node */
  nodes: string[];
  /** Sequence of internal dependency edges forming the cycle */
  edges: DependencyEdge[];
  /** Number of unique participating modules in the cycle */
  length: number;
}

/**
 * Result payload from circular dependency detection analysis
 */
export interface CycleDetectionResult {
  /** List of canonical circular dependency cycles */
  cycles: DependencyCycle[];
  /** Total number of unique cycles detected */
  totalCycles: number;
  /** Total number of unique nodes involved in at least one cycle */
  cyclicNodeCount: number;
}

/**
 * Supported rule identifiers for Code Smell Heuristics Engine
 */
export type CodeSmellRuleId =
  | 'long-function'
  | 'duplicate-logic'
  | 'potentially-unused-export'
  | 'comment-debt'
  | 'low-test-file-ratio';

/**
 * Severity level for code smell observations
 */
export type CodeSmellSeverity = 'critical' | 'high' | 'medium' | 'low';

/**
 * Individual code smell observation emitted by heuristics engine
 */
export interface CodeSmellObservation {
  /** Deterministic observation identifier */
  id: string;
  /** Rule identifier */
  ruleId: CodeSmellRuleId;
  /** Severity level */
  severity: CodeSmellSeverity;
  /** Repository-relative file path */
  file: string;
  /** Human-readable explanation */
  message: string;
  /** Start line number (1-indexed) if applicable */
  startLine?: number;
  /** End line number (1-indexed) if applicable */
  endLine?: number;
  /** Additional smell-specific metadata */
  metadata: Record<string, unknown>;
}

/**
 * Configuration options for Code Smell Engine heuristics
 */
export interface CodeSmellConfig {
  /** Maximum allowed line count for a function before triggering long-function smell (default: 50) */
  longFunctionThresholdLines?: number;
  /** Minimum test file to production file ratio threshold (default: 0.20) */
  lowTestFileRatioThreshold?: number;
  /** Minimum statement block size for duplicate code detection (default: 4) */
  minDuplicateStatements?: number;
}

/**
 * Aggregate result returned by Code Smell Engine
 */
export interface CodeSmellAnalysisResult {
  /** List of detected code smell observations */
  observations: CodeSmellObservation[];
  /** Categorized count summary */
  summary: {
    totalObservations: number;
    longFunctionCount: number;
    duplicateLogicCount: number;
    unusedExportCount: number;
    commentDebtCount: number;
    lowTestRatioCount: number;
  };
  /** Repository metrics proxy */
  metrics: {
    totalSourceFiles: number;
    totalTestFiles: number;
    testFileRatio: number;
  };
}

/**
 * Score classification bands for repository tech debt score
 */
export type CodeTechDebtBand = 'healthy' | 'moderate' | 'concerning' | 'high-debt';

/**
 * Raw finding and marker counts used for tech debt scoring calculation
 */
export interface CodeTechDebtCounts {
  circularDependencies: number;
  longFunctions: number;
  highSeverityLongFunctions: number;
  duplicateLogic: number;
  potentiallyUnusedExports: number;
  todoMarkers: number;
  fixmeMarkers: number;
  hackMarkers: number;
  xxxMarkers: number;
  productionFiles: number;
  testFiles: number;
}

/**
 * Categorized penalty points breakdown per component
 */
export interface CodeTechDebtPenalties {
  circularDependencies: number;
  longFunctions: number;
  duplicateLogic: number;
  potentiallyUnusedExports: number;
  commentDebt: number;
  testFileRatio: number;
  total: number;
}

/**
 * Bounded, explainable composite tech debt score result
 */
export interface CodeTechDebtScore {
  /** Overall score bounded 0 to 100 */
  score: number;
  /** Categorical score band */
  band: CodeTechDebtBand;
  /** Flag indicating whether repository contains zero production source files */
  isEmptyRepository: boolean;
  /** Raw signal counts */
  counts: CodeTechDebtCounts;
  /** Individual component penalties and capped total penalty */
  penalties: CodeTechDebtPenalties;
  /** Computed test file ratio */
  testFileRatio: number;
}
