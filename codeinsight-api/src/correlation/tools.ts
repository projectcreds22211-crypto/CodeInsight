import type { Finding } from '@codeinsight/shared-contracts';
import type {
  CodeFindingsToolInput,
  CorrelationToolDefinition,
  CorrelationToolExecutionResponse,
  CorrelationToolName,
  LogFindingsToolInput,
  QueryFindingsToolInput,
} from './types.js';

/**
 * Claude function-calling tool schema definition for get_code_findings()
 */
export const GET_CODE_FINDINGS_TOOL: CorrelationToolDefinition = {
  name: 'get_code_findings',
  description:
    'Retrieves deterministic Code Analyzer findings for the project session, including architecture circular dependencies, code smell observations (long functions, duplicate logic, unused exports, comment debt), file line bounds, and tech-debt score metrics.',
  input_schema: {
    type: 'object',
    properties: {
      severity: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        description: 'Optional filter by finding severity level',
      },
      category: {
        type: 'string',
        enum: ['architecture', 'tech_debt'],
        description: 'Optional filter by code finding category',
      },
      ruleId: {
        type: 'string',
        description:
          'Optional filter by specific static rule ID (e.g. "circular-dependency", "duplicate-logic", "long-function", "potentially-unused-export", "comment-debt")',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of findings to return (default: all matching findings)',
      },
    },
    required: [],
  },
};

/**
 * Claude function-calling tool schema definition for get_query_findings()
 */
export const GET_QUERY_FINDINGS_TOOL: CorrelationToolDefinition = {
  name: 'get_query_findings',
  description:
    'Retrieves deterministic Database Analyzer findings for the project session, including SQL query anti-patterns (missing index, SELECT *, N+1, unbounded LIMIT), query hash, recommendations, before/after SQL diffs, and health metrics.',
  input_schema: {
    type: 'object',
    properties: {
      severity: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        description: 'Optional filter by finding severity level',
      },
      category: {
        type: 'string',
        enum: ['query_optimization'],
        description: 'Optional filter by database finding category',
      },
      queryHash: {
        type: 'string',
        description: 'Optional filter by specific SQL query hash fingerprint',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of findings to return (default: all matching findings)',
      },
    },
    required: [],
  },
};

/**
 * Claude function-calling tool schema definition for get_log_findings()
 */
export const GET_LOG_FINDINGS_TOOL: CorrelationToolDefinition = {
  name: 'get_log_findings',
  description:
    'Retrieves deterministic Log Analyzer findings for the project session, including statistical baseline anomalies, time-windowed sustained patterns (connection pool exhaustion, latency spikes, error rate spikes, memory leak trends), log timestamps, and temporal evidence.',
  input_schema: {
    type: 'object',
    properties: {
      severity: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'critical'],
        description: 'Optional filter by finding severity level',
      },
      category: {
        type: 'string',
        enum: ['anomaly'],
        description: 'Optional filter by log finding category',
      },
      anomalyType: {
        type: 'string',
        description:
          'Optional filter by specific anomaly pattern type (e.g. "pool_exhaustion", "latency_spike", "error_rate_spike", "memory_leak")',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of findings to return (default: all matching findings)',
      },
    },
    required: [],
  },
};

/**
 * Array of all Claude tool definitions exposed to the Correlation Engine prompt boundary
 */
export const ALL_CORRELATION_TOOLS: CorrelationToolDefinition[] = [
  GET_CODE_FINDINGS_TOOL,
  GET_QUERY_FINDINGS_TOOL,
  GET_LOG_FINDINGS_TOOL,
];

/**
 * Executes get_code_findings tool query over persisted code findings
 */
export function executeGetCodeFindings(
  codeFindings: Finding[] = [],
  input: CodeFindingsToolInput = {}
): CorrelationToolExecutionResponse {
  let filtered = [...codeFindings];

  if (input.severity) {
    filtered = filtered.filter((f) => f.severity === input.severity);
  }
  if (input.category) {
    filtered = filtered.filter((f) => f.category === input.category);
  }
  if (input.ruleId) {
    filtered = filtered.filter((f) => {
      const rule = (f.metadata?.ruleId as string) || (f.metadata?.rule as string);
      return rule === input.ruleId || f.id.includes(input.ruleId!);
    });
  }
  if (input.limit && input.limit > 0) {
    filtered = filtered.slice(0, input.limit);
  }

  const serializedOutput = JSON.stringify(
    {
      tool: 'get_code_findings',
      totalAvailable: codeFindings.length,
      returnedCount: filtered.length,
      findings: filtered,
    },
    null,
    2
  );

  return {
    toolName: 'get_code_findings',
    input,
    totalAvailable: codeFindings.length,
    returnedCount: filtered.length,
    findings: filtered,
    serializedOutput,
  };
}

/**
 * Executes get_query_findings tool query over persisted database findings
 */
export function executeGetQueryFindings(
  databaseFindings: Finding[] = [],
  input: QueryFindingsToolInput = {}
): CorrelationToolExecutionResponse {
  let filtered = [...databaseFindings];

  if (input.severity) {
    filtered = filtered.filter((f) => f.severity === input.severity);
  }
  if (input.category) {
    filtered = filtered.filter((f) => f.category === input.category);
  }
  if (input.queryHash) {
    filtered = filtered.filter((f) => {
      const hash = (f.metadata?.queryHash as string) || (f.metadata?.hash as string);
      return hash === input.queryHash || f.id.includes(input.queryHash!);
    });
  }
  if (input.limit && input.limit > 0) {
    filtered = filtered.slice(0, input.limit);
  }

  const serializedOutput = JSON.stringify(
    {
      tool: 'get_query_findings',
      totalAvailable: databaseFindings.length,
      returnedCount: filtered.length,
      findings: filtered,
    },
    null,
    2
  );

  return {
    toolName: 'get_query_findings',
    input,
    totalAvailable: databaseFindings.length,
    returnedCount: filtered.length,
    findings: filtered,
    serializedOutput,
  };
}

/**
 * Executes get_log_findings tool query over persisted log findings
 */
export function executeGetLogFindings(
  logFindings: Finding[] = [],
  input: LogFindingsToolInput = {}
): CorrelationToolExecutionResponse {
  let filtered = [...logFindings];

  if (input.severity) {
    filtered = filtered.filter((f) => f.severity === input.severity);
  }
  if (input.category) {
    filtered = filtered.filter((f) => f.category === input.category);
  }
  if (input.anomalyType) {
    filtered = filtered.filter((f) => {
      const anomaly = (f.metadata?.anomalyType as string) || (f.metadata?.patternType as string);
      return anomaly === input.anomalyType || f.id.includes(input.anomalyType!);
    });
  }
  if (input.limit && input.limit > 0) {
    filtered = filtered.slice(0, input.limit);
  }

  const serializedOutput = JSON.stringify(
    {
      tool: 'get_log_findings',
      totalAvailable: logFindings.length,
      returnedCount: filtered.length,
      findings: filtered,
    },
    null,
    2
  );

  return {
    toolName: 'get_log_findings',
    input,
    totalAvailable: logFindings.length,
    returnedCount: filtered.length,
    findings: filtered,
    serializedOutput,
  };
}

/**
 * Unified dispatcher for executing any of the 3 correlation tool calls
 */
export function dispatchCorrelationToolCall(
  toolName: CorrelationToolName,
  input: any = {},
  sessionFindings: {
    code?: Finding[];
    database?: Finding[];
    logs?: Finding[];
  }
): CorrelationToolExecutionResponse {
  switch (toolName) {
    case 'get_code_findings':
      return executeGetCodeFindings(sessionFindings.code || [], input);
    case 'get_query_findings':
      return executeGetQueryFindings(sessionFindings.database || [], input);
    case 'get_log_findings':
      return executeGetLogFindings(sessionFindings.logs || [], input);
    default:
      throw new Error(`Unsupported correlation tool name: '${toolName}'`);
  }
}
