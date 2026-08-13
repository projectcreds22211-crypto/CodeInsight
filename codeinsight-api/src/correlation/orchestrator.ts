import Anthropic from '@anthropic-ai/sdk';
import type { Finding } from '@codeinsight/shared-contracts';
import { createClaudeClient } from '../services/claude-client.js';
import { buildCorrelationPrompt, parseClaudeCorrelationResponse } from './prompt.js';
import { ALL_CORRELATION_TOOLS, dispatchCorrelationToolCall } from './tools.js';
import type {
  AnalyzerSessionAvailability,
  CodeFindingsToolInput,
  CorrelationEngineResult,
  CorrelationSSEEvent,
  CorrelationToolExecutionResponse,
  CorrelationToolName,
  ExecutedToolCall,
  LogFindingsToolInput,
  QueryFindingsToolInput,
} from './types.js';

/**
 * Constants governing tool-loop bounds, safety caps, and payload limits
 */
export const CORRELATION_LIMITS = {
  MAX_CLAUDE_TURNS: 5,
  MAX_TOOL_CALLS: 10,
  MAX_FINDINGS_PER_TOOL_CALL: 50,
  MAX_TOTAL_EXPOSED_FINDINGS: 150,
  MAX_TOOL_RESULT_BYTES: 100_000,
} as const;

/**
 * Input parameters required to execute runCorrelationOrchestrator
 */
export interface RunCorrelationOrchestratorParams {
  projectId: string;
  sessionFindings: {
    code?: Finding[] | null;
    database?: Finding[] | null;
    logs?: Finding[] | null;
  };
  claudeClient?: Anthropic;
  systemPrompt?: string;
  userPrompt?: string;
  onProgress?: (event: CorrelationSSEEvent) => void;
}

const ALLOWED_TOOL_NAMES: Set<CorrelationToolName> = new Set([
  'get_code_findings',
  'get_query_findings',
  'get_log_findings',
]);

const ALLOWED_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const ALLOWED_CATEGORIES = new Set(['architecture', 'tech_debt', 'query_optimization', 'anomaly']);

interface ToolValidationResult {
  valid: boolean;
  reason?: string;
  toolName: CorrelationToolName;
  validatedInput: Record<string, unknown>;
}

/**
 * Validates tool call name, arguments, filters, and limit parameter
 */
export function validateToolInput(rawName: string, rawInput: any): ToolValidationResult {
  if (!ALLOWED_TOOL_NAMES.has(rawName as CorrelationToolName)) {
    return {
      valid: false,
      reason: `Unknown tool name '${rawName}'`,
      toolName: rawName as CorrelationToolName,
      validatedInput: {},
    };
  }

  const toolName = rawName as CorrelationToolName;
  const input =
    typeof rawInput === 'object' && rawInput !== null && !Array.isArray(rawInput) ? rawInput : {};
  const validatedInput: Record<string, unknown> = {};

  // Validate and clamp limit
  if (typeof input.limit === 'number' && Number.isFinite(input.limit)) {
    const clamped = Math.min(
      Math.max(1, Math.floor(input.limit)),
      CORRELATION_LIMITS.MAX_FINDINGS_PER_TOOL_CALL
    );
    validatedInput.limit = clamped;
  }

  // Validate severity enum
  if (typeof input.severity === 'string') {
    if (ALLOWED_SEVERITIES.has(input.severity)) {
      validatedInput.severity = input.severity;
    } else {
      return {
        valid: false,
        reason: `Invalid severity filter '${input.severity}'`,
        toolName,
        validatedInput: {},
      };
    }
  }

  // Validate category enum
  if (typeof input.category === 'string') {
    if (ALLOWED_CATEGORIES.has(input.category)) {
      validatedInput.category = input.category;
    } else {
      return {
        valid: false,
        reason: `Invalid category filter '${input.category}'`,
        toolName,
        validatedInput: {},
      };
    }
  }

  // Validate tool-specific string parameters
  if (toolName === 'get_code_findings' && typeof input.ruleId === 'string') {
    validatedInput.ruleId = input.ruleId.trim();
  }
  if (toolName === 'get_query_findings' && typeof input.queryHash === 'string') {
    validatedInput.queryHash = input.queryHash.trim();
  }
  if (toolName === 'get_log_findings' && typeof input.anomalyType === 'string') {
    validatedInput.anomalyType = input.anomalyType.trim();
  }

  return {
    valid: true,
    toolName,
    validatedInput,
  };
}

/**
 * Extracts and validates finding IDs referenced in Claude's output against exposed findings
 */
export function extractAndValidateReferencedFindingIds(
  responseText: string,
  exposedFindingsMap: Map<string, Finding>
): { referencedFindingIds: string[]; rejectedFindingIds: string[] } {
  if (!responseText) {
    return { referencedFindingIds: [], rejectedFindingIds: [] };
  }

  // Match identifier tokens (UUIDs, prefixed IDs, or kebab/snake case finding identifiers)
  const regex = /\b[a-zA-Z0-9_-]{4,64}\b/g;
  const matches = responseText.match(regex) || [];
  const uniqueMatches = Array.from(new Set(matches));

  const referencedFindingIds: string[] = [];
  const rejectedFindingIds: string[] = [];

  for (const matchId of uniqueMatches) {
    if (exposedFindingsMap.has(matchId)) {
      referencedFindingIds.push(matchId);
    } else if (
      /^(?:code|db|query|log|finding)[-_]/i.test(matchId) ||
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(matchId)
    ) {
      rejectedFindingIds.push(matchId);
    }
  }

  return { referencedFindingIds, rejectedFindingIds };
}

/**
 * Core Correlation Engine Orchestrator
 * Establishes project context, executes bounded Claude tool loop, enforces provenance & budgets
 */
export async function runCorrelationOrchestrator(
  params: RunCorrelationOrchestratorParams
): Promise<CorrelationEngineResult> {
  const { projectId, sessionFindings, claudeClient, systemPrompt, userPrompt, onProgress } = params;

  const sessionAvailability: AnalyzerSessionAvailability = {
    code: sessionFindings.code !== null && sessionFindings.code !== undefined,
    database: sessionFindings.database !== null && sessionFindings.database !== undefined,
    logs: sessionFindings.logs !== null && sessionFindings.logs !== undefined,
  };

  onProgress?.({
    type: 'started',
    projectId,
    sessionAvailability,
    timestamp: new Date().toISOString(),
  });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const isKeyUnconfigured = !apiKey || apiKey === 'unconfigured_key';

  // Check offline state
  if (isKeyUnconfigured && !claudeClient) {
    const offlineResult: CorrelationEngineResult = {
      status: 'offline',
      response:
        'Correlation analysis unavailable; ANTHROPIC_API_KEY is not configured. Deterministic analyzer findings remain available.',
      toolCalls: [],
      exposedFindings: [],
      referencedFindingIds: [],
      rejectedFindingIds: [],
      sessionAvailability,
    };

    onProgress?.({
      type: 'completed',
      status: 'offline',
      result: offlineResult,
      timestamp: new Date().toISOString(),
    });

    return offlineResult;
  }

  const client = claudeClient || createClaudeClient(apiKey);
  const totalFindingsAvailable =
    (sessionFindings.code?.length || 0) +
    (sessionFindings.database?.length || 0) +
    (sessionFindings.logs?.length || 0);

  const defaultPrompts = buildCorrelationPrompt({
    projectId,
    sessionAvailability,
    findingsCount: totalFindingsAvailable,
  });

  const activeSystemPrompt = systemPrompt || defaultPrompts.systemPrompt;
  const activeUserPrompt = userPrompt || defaultPrompts.userPrompt;

  const messages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: activeUserPrompt,
    },
  ];

  const executedToolCalls: ExecutedToolCall[] = [];
  const exposedFindingsMap = new Map<string, Finding>();

  let turn = 0;
  let totalToolCalls = 0;
  let finalResponseText = '';

  while (turn < CORRELATION_LIMITS.MAX_CLAUDE_TURNS) {
    turn++;
    let response: Anthropic.Message;

    try {
      response = await client.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: activeSystemPrompt,
        messages,
        tools: ALL_CORRELATION_TOOLS,
      });
    } catch (err: any) {
      const failedResult: CorrelationEngineResult = {
        status: 'failed',
        response: `Correlation analysis failed: ${err?.message || 'Claude API request error'}. Deterministic analyzer findings remain available.`,
        toolCalls: executedToolCalls,
        exposedFindings: Array.from(exposedFindingsMap.values()),
        referencedFindingIds: [],
        rejectedFindingIds: [],
        sessionAvailability,
      };

      onProgress?.({
        type: 'error',
        error: 'Claude API Failure',
        message: failedResult.response,
      });

      return failedResult;
    }

    // Record assistant message in conversation history
    messages.push({
      role: 'assistant',
      content: response.content,
    });

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (b) => b.type === 'tool_use'
      ) as Anthropic.ToolUseBlock[];

      const toolResultContentBlocks: Anthropic.ToolResultBlockParam[] = [];

      for (const block of toolUseBlocks) {
        totalToolCalls++;
        if (totalToolCalls > CORRELATION_LIMITS.MAX_TOOL_CALLS) {
          const limitResult: CorrelationEngineResult = {
            status: 'limit_exceeded',
            response: `Correlation tool call limit exceeded (${CORRELATION_LIMITS.MAX_TOOL_CALLS} max tool calls). Deterministic analyzer findings remain available.`,
            toolCalls: executedToolCalls,
            exposedFindings: Array.from(exposedFindingsMap.values()),
            referencedFindingIds: [],
            rejectedFindingIds: [],
            sessionAvailability,
          };

          onProgress?.({
            type: 'completed',
            status: 'limit_exceeded',
            result: limitResult,
            timestamp: new Date().toISOString(),
          });

          return limitResult;
        }

        const validation = validateToolInput(block.name, block.input);

        if (!validation.valid) {
          toolResultContentBlocks.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({ error: `Tool validation failed: ${validation.reason}` }),
            is_error: true,
          });
          continue;
        }

        onProgress?.({
          type: 'tool_call',
          tool: validation.toolName,
          timestamp: new Date().toISOString(),
        });

        let toolExecution: CorrelationToolExecutionResponse;
        try {
          toolExecution = dispatchCorrelationToolCall(
            validation.toolName,
            validation.validatedInput,
            {
              code: sessionFindings.code || [],
              database: sessionFindings.database || [],
              logs: sessionFindings.logs || [],
            }
          );
        } catch (err: any) {
          toolResultContentBlocks.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify({
              error: `Tool execution failed: ${err?.message || 'unknown error'}`,
            }),
            is_error: true,
          });
          continue;
        }

        onProgress?.({
          type: 'tool_result',
          tool: validation.toolName,
          findingCount: toolExecution.returnedCount,
          timestamp: new Date().toISOString(),
        });

        // Add returned findings to exposed set, maintaining exact finding provenance
        for (const f of toolExecution.findings) {
          if (exposedFindingsMap.size < CORRELATION_LIMITS.MAX_TOTAL_EXPOSED_FINDINGS) {
            exposedFindingsMap.set(f.id, f);
          }
        }

        executedToolCalls.push({
          toolName: validation.toolName,
          input: validation.validatedInput,
          returnedCount: toolExecution.returnedCount,
          timestamp: new Date().toISOString(),
        });

        let outputStr = toolExecution.serializedOutput;
        if (outputStr.length > CORRELATION_LIMITS.MAX_TOOL_RESULT_BYTES) {
          outputStr =
            outputStr.slice(0, CORRELATION_LIMITS.MAX_TOOL_RESULT_BYTES) + '\n... [truncated]';
        }

        toolResultContentBlocks.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: outputStr,
        });
      }

      // Record user tool execution results in conversation history
      messages.push({
        role: 'user',
        content: toolResultContentBlocks,
      });
    } else {
      // Extract natural language response text
      const textBlocks = response.content.filter((b) => b.type === 'text') as Anthropic.TextBlock[];
      finalResponseText = textBlocks
        .map((b) => b.text)
        .join('\n')
        .trim();
      break;
    }
  }

  // Handle turn budget exceeded without text break
  if (!finalResponseText && turn >= CORRELATION_LIMITS.MAX_CLAUDE_TURNS) {
    const limitResult: CorrelationEngineResult = {
      status: 'limit_exceeded',
      response: `Correlation analysis turn limit reached (${CORRELATION_LIMITS.MAX_CLAUDE_TURNS} turns). Deterministic analyzer findings remain available.`,
      toolCalls: executedToolCalls,
      exposedFindings: Array.from(exposedFindingsMap.values()),
      referencedFindingIds: [],
      rejectedFindingIds: [],
      sessionAvailability,
    };

    onProgress?.({
      type: 'completed',
      status: 'limit_exceeded',
      result: limitResult,
      timestamp: new Date().toISOString(),
    });

    return limitResult;
  }

  if (finalResponseText) {
    onProgress?.({
      type: 'reasoning',
      text: finalResponseText,
    });
  }

  const { referencedFindingIds, rejectedFindingIds } = extractAndValidateReferencedFindingIds(
    finalResponseText,
    exposedFindingsMap
  );

  const parsedOutput = parseClaudeCorrelationResponse(finalResponseText, exposedFindingsMap);

  for (const corr of parsedOutput.correlations) {
    onProgress?.({
      type: 'correlation',
      correlation: corr,
    });
  }

  const completedResult: CorrelationEngineResult = {
    status: 'completed',
    response: finalResponseText || 'Correlation analysis complete.',
    toolCalls: executedToolCalls,
    exposedFindings: Array.from(exposedFindingsMap.values()),
    referencedFindingIds,
    rejectedFindingIds,
    sessionAvailability,
    parsedOutput,
  };

  onProgress?.({
    type: 'completed',
    status: 'completed',
    result: completedResult,
    timestamp: new Date().toISOString(),
  });

  return completedResult;
}
