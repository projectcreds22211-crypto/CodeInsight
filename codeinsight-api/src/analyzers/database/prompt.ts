import type Anthropic from '@anthropic-ai/sdk';
import type { Finding } from '@codeinsight/shared-contracts';
import { createClaudeClient } from '../../services/claude-client.js';
import type { DatabaseFindingMetadata } from './types.js';

/**
 * Structured optimization recommendation generated for a specific database finding.
 */
export interface DatabaseQueryOptimization {
  findingId: string;
  ruleId: string;
  explanation: string;
  rewrittenQuery?: string;
  rationale: string;
  suggestedIndex?: string;
  assumptions?: string;
  confidenceNotes?: string;
}

/**
 * Top-level structured response payload returned by the Database Analyzer Claude prompt.
 */
export interface DatabaseOptimizationResponse {
  optimizations: DatabaseQueryOptimization[];
  summaryOverview?: string;
}

/**
 * Input payload supplied to the prompt builder.
 */
export interface DatabaseOptimizationRequest {
  schemaSql: string;
  queriesSql: string[];
  findings: Finding[];
}

/**
 * System prompt instructing Claude on deterministic database analysis grounding,
 * semantic preservation, and structured JSON output.
 */
export const DATABASE_ANALYZER_SYSTEM_PROMPT = `You are a Principal Database Performance Engineer for CodeInsight.
Your task is to analyze deterministic database performance findings and generate plain-English explanations, semantic-preserving query rewrites, and index recommendations.

STRICT OPERATIONAL CONSTRAINTS:
1. GROUNDING MANDATE: You MUST accept the provided deterministic rule findings as absolute ground truth. Do NOT invent new issues, modify finding severities, or omit findings.
2. SEMANTIC PRESERVATION: Any rewritten SQL query MUST preserve 100% of the original query's logic, filter semantics, and result set structure.
3. ADVISORY SAFETY: Treat queries and schemas as read-only. Never suggest destructive DDL/DML mutations (e.g. DROP TABLE, TRUNCATE, DELETE).
4. SCHEMA GROUNDING: Recommend CREATE INDEX statements ONLY on tables and columns that exist in the provided schema DDL.
5. STRUCTURED JSON OUTPUT: You MUST respond ONLY with a valid JSON object conforming strictly to the requested schema. Do NOT surround your response with conversational commentary.`;

/**
 * Build system and user prompt strings for Claude given the schema, queries, and deterministic findings.
 */
export function buildDatabaseAnalysisPrompt(input: DatabaseOptimizationRequest): {
  systemPrompt: string;
  userPrompt: string;
} {
  const sanitizedSchema = (input.schemaSql || '').trim();
  const sanitizedQueries = (input.queriesSql || [])
    .map((q, idx) => `[Query ${idx + 1}]: ${q.trim()}`)
    .join('\n\n');

  const findingsSummary = input.findings
    .map((f, idx) => {
      const meta = (f.metadata || {}) as DatabaseFindingMetadata;
      return `Finding #${idx + 1}:
- ID: ${f.id}
- Rule ID: ${meta.ruleId || 'unknown'}
- Severity: ${f.severity}
- Category: ${f.category}
- Title: ${f.title}
- Description: ${f.description}
- Target Table: ${meta.table || 'N/A'}
- Target Column: ${meta.column || 'N/A'}
- Query Index: ${typeof meta.queryIndex === 'number' ? meta.queryIndex + 1 : 'N/A'}
- Query Text: ${meta.queryText || 'N/A'}`;
    })
    .join('\n\n');

  const userPrompt = `### SCHEMA DDL:
\`\`\`sql
${sanitizedSchema}
\`\`\`

### INPUT QUERIES:
\`\`\`sql
${sanitizedQueries}
\`\`\`

### DETERMINISTIC FINDINGS TO ENHANCE:
${findingsSummary || 'No deterministic findings detected.'}

### REQUIRED OUTPUT FORMAT:
Return a single JSON object with the following structure:
{
  "summaryOverview": "Executive summary of database performance optimizations.",
  "optimizations": [
    {
      "findingId": "<finding.id>",
      "ruleId": "<ruleId>",
      "explanation": "Clear, plain-English explanation of why this query pattern creates performance overhead.",
      "rewrittenQuery": "Optimized SQL query preserving 100% of original logic (if applicable, otherwise omit)",
      "rationale": "Technical rationale explaining why the rewritten query or index improves database performance.",
      "suggestedIndex": "Exact CREATE INDEX statement (if applicable, otherwise omit)",
      "assumptions": "Key schema or data volume assumptions",
      "confidenceNotes": "High/Medium confidence notes"
    }
  ]
}`;

  return {
    systemPrompt: DATABASE_ANALYZER_SYSTEM_PROMPT,
    userPrompt,
  };
}

/**
 * Safely parse raw Claude response text into a typed DatabaseOptimizationResponse object.
 * Fails gracefully returning offline fallbacks if the response is malformed or invalid JSON.
 */
export function parseClaudeDatabaseResponse(rawText: string): DatabaseOptimizationResponse {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return { optimizations: [], summaryOverview: 'No response received from Claude.' };
  }

  try {
    let cleanJson = rawText.trim();
    // Strip markdown code block wrappers if present (e.g. ```json ... ```)
    const codeBlockMatch = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(cleanJson);
    if (codeBlockMatch) {
      cleanJson = codeBlockMatch[1].trim();
    }

    const parsed = JSON.parse(cleanJson);
    const optimizations: DatabaseQueryOptimization[] = Array.isArray(parsed.optimizations)
      ? parsed.optimizations.map((opt: any) => ({
          findingId: String(opt.findingId || ''),
          ruleId: String(opt.ruleId || ''),
          explanation: String(opt.explanation || ''),
          rewrittenQuery: typeof opt.rewrittenQuery === 'string' ? opt.rewrittenQuery : undefined,
          rationale: String(opt.rationale || ''),
          suggestedIndex: typeof opt.suggestedIndex === 'string' ? opt.suggestedIndex : undefined,
          assumptions: typeof opt.assumptions === 'string' ? opt.assumptions : undefined,
          confidenceNotes:
            typeof opt.confidenceNotes === 'string' ? opt.confidenceNotes : undefined,
        }))
      : [];

    return {
      summaryOverview:
        typeof parsed.summaryOverview === 'string' ? parsed.summaryOverview : undefined,
      optimizations,
    };
  } catch (err: unknown) {
    return {
      summaryOverview: 'Failed to parse structured JSON from Claude response.',
      optimizations: [],
    };
  }
}

/**
 * Enhance deterministic Finding models by merging Claude-generated explanations,
 * rewritten queries, and rationales into Finding.recommendation and Finding.metadata.
 */
export function enhanceFindingsWithClaude(
  findings: Finding[],
  claudeResponse: DatabaseOptimizationResponse
): Finding[] {
  const optMap = new Map<string, DatabaseQueryOptimization>();
  for (const opt of claudeResponse.optimizations) {
    if (opt.findingId) {
      optMap.set(opt.findingId, opt);
    }
  }

  return findings.map((finding) => {
    const opt = optMap.get(finding.id);
    if (!opt) return finding;

    const existingMeta = (finding.metadata || {}) as DatabaseFindingMetadata;
    const updatedMeta: DatabaseFindingMetadata = {
      ...existingMeta,
      rewrittenQuery: opt.rewrittenQuery || existingMeta.rewrittenQuery,
      suggestedIndex: opt.suggestedIndex || existingMeta.suggestedIndex,
      recommendation: opt.explanation
        ? `${opt.explanation}\n\nRationale: ${opt.rationale}`
        : finding.recommendation,
    };

    return {
      ...finding,
      description: opt.explanation || finding.description,
      recommendation: opt.explanation
        ? `${opt.explanation} ${opt.rationale}`
        : finding.recommendation,
      metadata: updatedMeta,
    };
  });
}

/**
 * Orchestration entry point: Invokes Anthropic Claude API to generate query optimizations
 * for deterministic findings, returning structured DatabaseOptimizationResponse.
 * Fails gracefully returning offline fallbacks if the API key is unconfigured or call fails.
 */
export async function generateDatabaseOptimizationsWithClaude(
  input: DatabaseOptimizationRequest,
  client?: Anthropic
): Promise<DatabaseOptimizationResponse> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'unconfigured_key') {
    // Generate deterministic offline fallback optimizations without network calls
    const fallbackOptimizations: DatabaseQueryOptimization[] = input.findings.map((f) => {
      const meta = (f.metadata || {}) as DatabaseFindingMetadata;
      return {
        findingId: f.id,
        ruleId: String(meta.ruleId || 'unknown'),
        explanation: f.description,
        rewrittenQuery: meta.rewrittenQuery,
        suggestedIndex: meta.suggestedIndex,
        rationale: f.recommendation,
        confidenceNotes: 'Deterministic rule fallback recommendation (offline mode)',
      };
    });

    return {
      summaryOverview: 'Deterministic database analysis completed in offline mode.',
      optimizations: fallbackOptimizations,
    };
  }

  const claude = client || createClaudeClient(apiKey);
  const { systemPrompt, userPrompt } = buildDatabaseAnalysisPrompt(input);

  try {
    const message = await claude.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2000,
      temperature: 0.1,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const responseText =
      message.content && message.content.length > 0 && message.content[0].type === 'text'
        ? message.content[0].text
        : '';

    return parseClaudeDatabaseResponse(responseText);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    // Return deterministic offline fallbacks on API errors
    const fallbackOptimizations: DatabaseQueryOptimization[] = input.findings.map((f) => {
      const meta = (f.metadata || {}) as DatabaseFindingMetadata;
      return {
        findingId: f.id,
        ruleId: String(meta.ruleId || 'unknown'),
        explanation: f.description,
        rewrittenQuery: meta.rewrittenQuery,
        suggestedIndex: meta.suggestedIndex,
        rationale: f.recommendation,
        confidenceNotes: `API Fallback: ${errorMsg}`,
      };
    });

    return {
      summaryOverview: `Claude API execution error. Falling back to deterministic rule metadata. (${errorMsg})`,
      optimizations: fallbackOptimizations,
    };
  }
}
