import type Anthropic from '@anthropic-ai/sdk';
import type { Category, Finding, Severity } from '@codeinsight/shared-contracts';

/**
 * Enumeration of available Correlation Engine Claude tool names
 */
export type CorrelationToolName = 'get_code_findings' | 'get_query_findings' | 'get_log_findings';

/**
 * Valid correlation relationship categories across architecture, database, and operational layers
 */
export type CorrelationRelationship =
  'temporal' | 'code-to-query' | 'query-to-runtime' | 'code-to-runtime' | 'cross-layer';

/**
 * Conservative confidence rating for cross-layer correlation inferences
 */
export type CorrelationConfidence = 'high' | 'medium' | 'low';

/**
 * Grounded correlation relationship linking 2 or more deterministic finding IDs
 */
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

/**
 * Top-level structured output of correlation reasoning
 */
export interface CorrelationAnalysisOutput {
  summaryOverview?: string;
  correlations: GroundedCorrelation[];
}

/**
 * Filter parameters for get_code_findings tool execution
 */
export interface CodeFindingsToolInput {
  severity?: Severity;
  category?: Category;
  ruleId?: string;
  limit?: number;
}

/**
 * Filter parameters for get_query_findings tool execution
 */
export interface QueryFindingsToolInput {
  severity?: Severity;
  category?: Category;
  queryHash?: string;
  limit?: number;
}

/**
 * Filter parameters for get_log_findings tool execution
 */
export interface LogFindingsToolInput {
  severity?: Severity;
  category?: Category;
  anomalyType?: string;
  limit?: number;
}

/**
 * Tool execution wrapper containing tool name, input, raw findings, and serialized payload
 */
export interface CorrelationToolExecutionResponse {
  toolName: CorrelationToolName;
  input: CodeFindingsToolInput | QueryFindingsToolInput | LogFindingsToolInput;
  totalAvailable: number;
  returnedCount: number;
  findings: Finding[];
  serializedOutput: string;
}

/**
 * Strong typing for Anthropic SDK tool definitions used by the Correlation Engine
 */
export type CorrelationToolDefinition = Anthropic.Tool;

/**
 * Record of an executed tool call within the orchestrator loop
 */
export interface ExecutedToolCall {
  toolName: CorrelationToolName;
  input: Record<string, unknown>;
  returnedCount: number;
  timestamp: string;
}

/**
 * Availability state of project's analyzer sessions
 */
export interface AnalyzerSessionAvailability {
  code: boolean;
  database: boolean;
  logs: boolean;
}

/**
 * Execution status of the correlation orchestrator
 */
export type CorrelationEngineStatus = 'completed' | 'offline' | 'failed' | 'limit_exceeded';

/**
 * Typed Server-Sent Event (SSE) payloads emitted by the Correlation Engine
 */
export type CorrelationSSEEvent =
  | { type: 'connection'; status: 'connected'; timestamp: string }
  | {
      type: 'started';
      projectId: string;
      sessionAvailability: AnalyzerSessionAvailability;
      timestamp: string;
    }
  | {
      type: 'tool_call';
      tool: CorrelationToolName;
      timestamp: string;
    }
  | {
      type: 'tool_result';
      tool: CorrelationToolName;
      findingCount: number;
      timestamp: string;
    }
  | {
      type: 'reasoning';
      text: string;
    }
  | {
      type: 'correlation';
      correlation: GroundedCorrelation;
    }
  | {
      type: 'completed';
      status: CorrelationEngineStatus;
      result: CorrelationEngineResult;
      timestamp: string;
    }
  | {
      type: 'error';
      error: string;
      message: string;
    };

/**
 * Typed result payload returned by runCorrelationOrchestrator
 */
export interface CorrelationEngineResult {
  status: CorrelationEngineStatus;
  response: string;
  toolCalls: ExecutedToolCall[];
  exposedFindings: Finding[];
  referencedFindingIds: string[];
  rejectedFindingIds: string[];
  sessionAvailability: AnalyzerSessionAvailability;
  parsedOutput?: CorrelationAnalysisOutput;
  reportId?: string;
}
