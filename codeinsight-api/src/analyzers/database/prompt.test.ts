import assert from 'node:assert';
import { describe, it } from 'node:test';
import type { Finding } from '@codeinsight/shared-contracts';
import { DEMO_DATABASE_INPUT } from './fixtures/demo-database-fixture.js';
import {
  buildDatabaseAnalysisPrompt,
  DATABASE_ANALYZER_SYSTEM_PROMPT,
  enhanceFindingsWithClaude,
  generateDatabaseOptimizationsWithClaude,
  parseClaudeDatabaseResponse,
} from './prompt.js';
import { runDatabaseRules } from './rules.js';

describe('Database Analyzer Phase 3.4 — Claude Prompt & Orchestration Boundary', () => {
  const sampleFindings: Finding[] = runDatabaseRules(DEMO_DATABASE_INPUT, 'session-test-3-4');

  describe('Prompt Construction (buildDatabaseAnalysisPrompt)', () => {
    it('1. includes deterministic finding information, rule IDs, and query references', () => {
      const { systemPrompt, userPrompt } = buildDatabaseAnalysisPrompt({
        schemaSql: DEMO_DATABASE_INPUT.schemaSql,
        queriesSql: DEMO_DATABASE_INPUT.queriesSql,
        findings: sampleFindings,
      });

      assert.ok(systemPrompt.includes('Principal Database Performance Engineer'));
      assert.ok(systemPrompt.includes('GROUNDING MANDATE'));
      assert.ok(systemPrompt.includes('SEMANTIC PRESERVATION'));

      assert.ok(userPrompt.includes('SCHEMA DDL:'));
      assert.ok(userPrompt.includes('tasks'));
      assert.ok(userPrompt.includes('select-star'));
      assert.ok(userPrompt.includes('unindexed-order-by'));
      assert.ok(userPrompt.includes('missing-limit'));
      assert.ok(userPrompt.includes('REQUIRED OUTPUT FORMAT:'));
    });

    it('2. does not leak secrets, API keys, or sensitive credentials in prompts', () => {
      const { systemPrompt, userPrompt } = buildDatabaseAnalysisPrompt({
        schemaSql: DEMO_DATABASE_INPUT.schemaSql,
        queriesSql: DEMO_DATABASE_INPUT.queriesSql,
        findings: sampleFindings,
      });

      assert.strictEqual(systemPrompt.includes('sk-ant-'), false);
      assert.strictEqual(userPrompt.includes('sk-ant-'), false);
      assert.strictEqual(userPrompt.includes('password'), false);
    });

    it('3. handles empty findings and queries safely without crashing', () => {
      const { userPrompt } = buildDatabaseAnalysisPrompt({
        schemaSql: '',
        queriesSql: [],
        findings: [],
      });

      assert.ok(userPrompt.includes('No deterministic findings detected.'));
    });
  });

  describe('Response Parsing (parseClaudeDatabaseResponse)', () => {
    it('1. parses clean JSON response payloads correctly', () => {
      const rawJson = JSON.stringify({
        summaryOverview: 'Test DB optimization overview',
        optimizations: [
          {
            findingId: 'sql-select-star-1',
            ruleId: 'select-star',
            explanation: 'Avoid SELECT * on high column count tables.',
            rewrittenQuery: 'SELECT id, email FROM users;',
            rationale: 'Reduces IO overhead.',
          },
        ],
      });

      const res = parseClaudeDatabaseResponse(rawJson);
      assert.strictEqual(res.summaryOverview, 'Test DB optimization overview');
      assert.strictEqual(res.optimizations.length, 1);
      assert.strictEqual(res.optimizations[0].findingId, 'sql-select-star-1');
      assert.strictEqual(res.optimizations[0].rewrittenQuery, 'SELECT id, email FROM users;');
    });

    it('2. strips markdown code block wrappers (```json ... ```) cleanly', () => {
      const markdownJson = `\`\`\`json
{
  "summaryOverview": "Wrapped in codeblock",
  "optimizations": [
    {
      "findingId": "sql-missing-index-1",
      "ruleId": "unindexed-order-by",
      "explanation": "Add index on hourly_rate column.",
      "suggestedIndex": "CREATE INDEX idx_tasks_hourly_rate ON tasks(hourly_rate DESC);",
      "rationale": "Accelerates ORDER BY sorting."
    }
  ]
}
\`\`\``;

      const res = parseClaudeDatabaseResponse(markdownJson);
      assert.strictEqual(res.summaryOverview, 'Wrapped in codeblock');
      assert.strictEqual(res.optimizations.length, 1);
      assert.strictEqual(res.optimizations[0].ruleId, 'unindexed-order-by');
    });

    it('3. handles malformed JSON gracefully returning error summary without throwing', () => {
      const malformedText = 'This is not valid JSON content {{{ ...';
      const res = parseClaudeDatabaseResponse(malformedText);

      assert.strictEqual(res.optimizations.length, 0);
      assert.ok(res.summaryOverview?.includes('Failed to parse structured JSON'));
    });
  });

  describe('Finding Enhancement (enhanceFindingsWithClaude)', () => {
    it('merges Claude explanations and rewritten queries into Finding.recommendation and metadata', () => {
      const targetFinding = sampleFindings[0];
      const mockClaudeResponse = {
        summaryOverview: 'Enhanced overview',
        optimizations: [
          {
            findingId: targetFinding.id,
            ruleId: 'select-star',
            explanation: 'Claude enhanced explanation: specify column names.',
            rewrittenQuery: 'SELECT id, name FROM tasks;',
            rationale: 'Eliminates unneeded columns.',
          },
        ],
      };

      const enhanced = enhanceFindingsWithClaude(sampleFindings, mockClaudeResponse);
      const updated = enhanced.find((f) => f.id === targetFinding.id);

      assert.ok(updated);
      assert.ok(updated.recommendation.includes('Claude enhanced explanation'));
      assert.strictEqual(updated.metadata?.rewrittenQuery, 'SELECT id, name FROM tasks;');
    });
  });

  describe('Orchestration & Offline Fallback (generateDatabaseOptimizationsWithClaude)', () => {
    it('executes in offline mode when ANTHROPIC_API_KEY is unconfigured without making live network calls', async () => {
      const originalKey = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      try {
        const res = await generateDatabaseOptimizationsWithClaude({
          schemaSql: DEMO_DATABASE_INPUT.schemaSql,
          queriesSql: DEMO_DATABASE_INPUT.queriesSql,
          findings: sampleFindings,
        });

        assert.ok(res.summaryOverview?.includes('offline mode'));
        assert.strictEqual(res.optimizations.length, sampleFindings.length);
        assert.strictEqual(res.optimizations[0].findingId, sampleFindings[0].id);
      } finally {
        if (originalKey) process.env.ANTHROPIC_API_KEY = originalKey;
      }
    });

    it('executes with mock Anthropic SDK client without live network calls', async () => {
      const mockAnthropicClient: any = {
        messages: {
          create: async () => ({
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  summaryOverview: 'Mock Claude response',
                  optimizations: [
                    {
                      findingId: sampleFindings[0].id,
                      ruleId: 'select-star',
                      explanation: 'Mocked explanation.',
                      rationale: 'Mocked rationale.',
                    },
                  ],
                }),
              },
            ],
          }),
        },
      };

      const originalKey = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'sk-ant-mock-key-for-testing';

      try {
        const res = await generateDatabaseOptimizationsWithClaude(
          {
            schemaSql: DEMO_DATABASE_INPUT.schemaSql,
            queriesSql: DEMO_DATABASE_INPUT.queriesSql,
            findings: sampleFindings,
          },
          mockAnthropicClient
        );

        assert.strictEqual(res.summaryOverview, 'Mock Claude response');
        assert.strictEqual(res.optimizations.length, 1);
        assert.strictEqual(res.optimizations[0].findingId, sampleFindings[0].id);
      } finally {
        if (originalKey) {
          process.env.ANTHROPIC_API_KEY = originalKey;
        } else {
          delete process.env.ANTHROPIC_API_KEY;
        }
      }
    });
  });
});
