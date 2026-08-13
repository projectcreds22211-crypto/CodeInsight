const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Project {
  id: string;
  userId: string;
  name: string;
  githubUrl: string | null;
  isDemoRepository: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectParams {
  name: string;
  githubUrl?: string | null;
  isDemoRepository?: boolean;
}

export class ApiError extends Error {
  status: number;
  details?: Record<string, string[]>;

  constructor(message: string, status: number, details?: Record<string, string[]>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  getToken?: () => Promise<string | null>
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  if (getToken) {
    const token = await getToken();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMessage = `HTTP Error ${response.status}`;
    let details: Record<string, string[]> | undefined;
    try {
      const errorJson = await response.json();
      if (errorJson.message) errorMessage = errorJson.message;
      if (errorJson.details) details = errorJson.details;
    } catch {
      // response body was not JSON
    }
    throw new ApiError(errorMessage, response.status, details);
  }

  return response.json() as Promise<T>;
}

export async function getProjects(getToken: () => Promise<string | null>): Promise<Project[]> {
  return request<Project[]>('/api/projects', { method: 'GET' }, getToken);
}

export async function createProject(
  params: CreateProjectParams,
  getToken: () => Promise<string | null>
): Promise<Project> {
  return request<Project>(
    '/api/projects',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    getToken
  );
}

export async function createDemoProject(getToken: () => Promise<string | null>): Promise<Project> {
  return request<Project>(
    '/api/projects/demo',
    {
      method: 'POST',
    },
    getToken
  );
}

// ====== Database Analyzer Types ======

export interface FindingEvidence {
  line?: number;
  lineStart?: number;
  lineEnd?: number;
  snippet?: string;
  source?: string;
  threshold?: string;
  column?: number;
}

export interface DatabaseFindingMetadata {
  queryIndex?: number;
  queryText?: string;
  table?: string;
  column?: string;
  ruleId?: string;
  suggestedIndex?: string;
  rewrittenQuery?: string;
  recommendation?: string;
  evidence?: FindingEvidence[];
}

export interface Finding {
  id: string;
  sessionId: string;
  analyzer?: 'code' | 'database' | 'logs';
  category: 'architecture' | 'tech_debt' | 'query_optimization' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  evidence?: FindingEvidence[];
  metadata: DatabaseFindingMetadata & Record<string, unknown>;
  createdAt?: string;
}

export interface AnalyzerSummary {
  totalFindings: number;
  severityCounts: Record<'low' | 'medium' | 'high' | 'critical', number>;
  categoryCounts: Record<'architecture' | 'tech_debt' | 'query_optimization' | 'anomaly', number>;
}

export interface AnalyzerMetrics {
  score: number;
  performanceMs: number;
  itemsAnalyzed: number;
  rulesEvaluated: number;
}

export interface DatabaseAnalyzerResult {
  sessionId: string;
  analyzerType: 'database';
  status: 'pending' | 'running' | 'completed' | 'failed';
  findings: Finding[];
  summary: AnalyzerSummary;
  metrics: AnalyzerMetrics;
  customData?: {
    ruleId?: string;
    recommendation?: string;
  };
}

export interface AnalyzeDatabaseParams {
  schemaSql?: string;
  queriesSql?: string[];
}

// ====== Database Analyzer API Methods ======

export async function analyzeDatabase(
  projectId: string,
  params: AnalyzeDatabaseParams,
  getToken: () => Promise<string | null>
): Promise<DatabaseAnalyzerResult> {
  return request<DatabaseAnalyzerResult>(
    `/api/projects/${projectId}/analyze/database`,
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    getToken
  );
}

export async function getDatabaseFindings(
  projectId: string,
  getToken: () => Promise<string | null>
): Promise<DatabaseAnalyzerResult> {
  return request<DatabaseAnalyzerResult>(
    `/api/projects/${projectId}/database/findings`,
    {
      method: 'GET',
    },
    getToken
  );
}

// ====== Log Analyzer Types ======

export interface LogAnomalyCorrelation {
  findingIds: string[];
  relationship: string;
  explanation: string;
  temporalEvidence?: string;
  likelyImpact: string;
  confidence: 'high' | 'medium' | 'low';
  recommendation?: string;
}

export interface LogFindingMetadata extends Record<string, unknown> {
  ruleId?: string;
  metricName?: string;
  observedValue?: number | string;
  baselineMean?: number;
  stdDev?: number;
  zScore?: number;
  threshold?: number | string;
  timestamp?: string;
  requestId?: string;
  service?: string;
  path?: string;
  logIndex?: number;
  recommendation?: string;
  evidence?: FindingEvidence[];

  // Phase 4.2 Temporal Pattern Metadata
  startTimestamp?: string;
  endTimestamp?: string;
  durationSeconds?: number;
  eventCount?: number;
  contributingFindingIds?: string[];
  windowMs?: number;
  correlations?: LogAnomalyCorrelation[];
}

export interface LogFinding {
  id: string;
  sessionId: string;
  analyzer: 'logs';
  category: 'architecture' | 'tech_debt' | 'query_optimization' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  evidence: FindingEvidence[];
  metadata: LogFindingMetadata;
  createdAt?: string;
}

export interface LogAnalyzerResult {
  sessionId: string;
  analyzerType: 'logs';
  status: 'pending' | 'running' | 'completed' | 'failed';
  findings: LogFinding[];
  summary: AnalyzerSummary;
  metrics: AnalyzerMetrics;
  customData?: {
    recommendation?: string;
  };
}

export interface AnalyzeLogsParams {
  logs?: unknown;
  logsJson?: unknown;
}

// ====== Log Analyzer API Methods ======

export async function analyzeLogs(
  projectId: string,
  params: AnalyzeLogsParams,
  getToken: () => Promise<string | null>
): Promise<LogAnalyzerResult> {
  return request<LogAnalyzerResult>(
    `/api/projects/${projectId}/analyze/logs`,
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    getToken
  );
}

export async function getLogFindings(
  projectId: string,
  getToken: () => Promise<string | null>
): Promise<LogAnalyzerResult> {
  return request<LogAnalyzerResult>(
    `/api/projects/${projectId}/logs/findings`,
    {
      method: 'GET',
    },
    getToken
  );
}

// ====== Code Analyzer Types ======

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

export interface CodeTechDebtPenalties {
  circularDependencies: number;
  longFunctions: number;
  duplicateLogic: number;
  potentiallyUnusedExports: number;
  commentDebt: number;
  testFileRatio: number;
  total: number;
}

export interface CodeTechDebtScore {
  score: number;
  band: 'healthy' | 'moderate' | 'concerning' | 'high-debt';
  isEmptyRepository: boolean;
  counts: CodeTechDebtCounts;
  penalties: CodeTechDebtPenalties;
  testFileRatio: number;
}

export interface CodeAiExplanation {
  observationId?: string;
  explanation?: string;
  likelyImpact?: string;
  recommendation?: string;
  refactorExample?: string;
  confidence?: 'high' | 'medium' | 'low';
}

export interface CodeFindingMetadata extends Record<string, unknown> {
  ruleId?: string;
  file?: string;
  startLine?: number;
  endLine?: number;
  cycleId?: string;
  nodes?: string[];
  cycleLength?: number;
  recommendation?: string;
  evidence?: FindingEvidence[];
  aiExplanation?: CodeAiExplanation;
  techDebtScore?: CodeTechDebtScore;
  summaryOverview?: string;
}

export interface CodeFinding {
  id: string;
  sessionId: string;
  analyzer: 'code';
  category: 'architecture' | 'tech_debt' | 'query_optimization' | 'anomaly';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  evidence: FindingEvidence[];
  metadata: CodeFindingMetadata;
  createdAt?: string;
}

export interface CodeAnalyzerResult {
  sessionId: string;
  analyzerType: 'code';
  status: 'pending' | 'running' | 'completed' | 'failed';
  findings: CodeFinding[];
  summary: AnalyzerSummary;
  metrics: AnalyzerMetrics;
  customData?: {
    techDebtScore?: CodeTechDebtScore;
    totalCycles?: number;
    totalObservations?: number;
    summaryOverview?: string;
  };
}

export interface AnalyzeCodeParams {
  githubUrl?: string;
}

// ====== Code Analyzer API Methods ======

export async function analyzeCode(
  projectId: string,
  params: AnalyzeCodeParams,
  getToken: () => Promise<string | null>
): Promise<CodeAnalyzerResult> {
  return request<CodeAnalyzerResult>(
    `/api/projects/${projectId}/analyze/code`,
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
    getToken
  );
}

export async function getCodeFindings(
  projectId: string,
  getToken: () => Promise<string | null>
): Promise<CodeAnalyzerResult> {
  return request<CodeAnalyzerResult>(
    `/api/projects/${projectId}/code/findings`,
    {
      method: 'GET',
    },
    getToken
  );
}

// ====== Correlation Engine API Methods & Types ======

export type CorrelationRelationship =
  'temporal' | 'code-to-query' | 'query-to-runtime' | 'code-to-runtime' | 'cross-layer';

export type CorrelationConfidence = 'high' | 'medium' | 'low';

export interface GroundedCorrelation {
  id: string;
  findingIds: string[];
  analyzers: Array<'code' | 'database' | 'logs'>;
  relationship: CorrelationRelationship;
  explanation: string;
  evidence: string;
  confidence: CorrelationConfidence;
  temporalEvidence?: string;
}

export interface CorrelationReportRow {
  id: string;
  sessionId: string;
  summary: string;
  actionPlan: GroundedCorrelation[];
  generatedAt: string;
}

export interface CorrelationReportResponse {
  projectId: string;
  report: CorrelationReportRow | null;
  sessionAvailability: {
    code: boolean;
    database: boolean;
    logs: boolean;
  };
  totalFindingsCount: number;
}

export async function getCorrelationReport(
  projectId: string,
  getToken: () => Promise<string | null>
): Promise<CorrelationReportResponse> {
  return request<CorrelationReportResponse>(
    `/api/projects/${projectId}/report`,
    {
      method: 'GET',
    },
    getToken
  );
}
