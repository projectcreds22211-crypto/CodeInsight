import assert from 'node:assert';
import { describe, it } from 'node:test';
import type { Finding } from '@codeinsight/shared-contracts';
import {
  CORRELATION_LIMITS,
  extractAndValidateReferencedFindingIds,
  runCorrelationOrchestrator,
  validateToolInput,
} from './orchestrator.js';

function mockFinding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: overrides.id || 'finding-101',
    sessionId: overrides.sessionId || 'session-909',
    analyzer: overrides.analyzer || 'code',
    category: overrides.category || 'tech_debt',
    severity: overrides.severity || 'high',
    title: overrides.title || 'Sample Finding Title',
    description: overrides.description || 'Sample finding description detailing issue',
    recommendation: overrides.recommendation || 'Sample recommendation fix',
    evidence: overrides.evidence || [{ source: 'src/app.ts', snippet: 'sample snippet' }],
    metadata: overrides.metadata || { ruleId: 'circular-dependency' },
    createdAt: overrides.createdAt || new Date().toISOString(),
  };
}

function createMockClaudeClient(
  responses: Array<{
    stop_reason: 'end_turn' | 'tool_use';
    content: Array<any>;
  }>
) {
  let callCount = 0;
  return {
    messages: {
      create: async (params: any) => {
        const res = responses[callCount] || responses[responses.length - 1];
        callCount++;
        return {
          id: `msg_${callCount}`,
          type: 'message',
          role: 'assistant',
          model: params.model,
          stop_reason: res.stop_reason,
          content: res.content,
          usage: { input_tokens: 10, output_tokens: 10 },
        };
      },
    },
  } as any;
}

describe('Correlation Engine Phase 6.2 — Orchestrator & Evidence Collection', () => {
  describe('Basic Execution & Tool Loop', () => {
    it('1. Claude returns final response directly without tool calls', async () => {
      const mockClient = createMockClaudeClient([
        {
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'No cross-layer issues found.' }],
        },
      ]);

      const result = await runCorrelationOrchestrator({
        projectId: 'proj-1',
        sessionFindings: { code: [], database: [], logs: [] },
        claudeClient: mockClient,
      });

      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.response, 'No cross-layer issues found.');
      assert.strictEqual(result.toolCalls.length, 0);
      assert.strictEqual(result.exposedFindings.length, 0);
    });

    it('2. Claude requests one tool call then returns final response', async () => {
      const codeFindings = [mockFinding({ id: 'code-f1', analyzer: 'code' })];
      const mockClient = createMockClaudeClient([
        {
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'tu_1',
              name: 'get_code_findings',
              input: { severity: 'high' },
            },
          ],
        },
        {
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Analyzed code finding code-f1.' }],
        },
      ]);

      const result = await runCorrelationOrchestrator({
        projectId: 'proj-1',
        sessionFindings: { code: codeFindings, database: [], logs: [] },
        claudeClient: mockClient,
      });

      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.toolCalls.length, 1);
      assert.strictEqual(result.toolCalls[0].toolName, 'get_code_findings');
      assert.strictEqual(result.exposedFindings.length, 1);
      assert.strictEqual(result.exposedFindings[0].id, 'code-f1');
    });

    it('3. Claude requests multiple tools sequentially', async () => {
      const codeFindings = [mockFinding({ id: 'code-f1', analyzer: 'code' })];
      const dbFindings = [mockFinding({ id: 'db-f1', analyzer: 'database' })];

      const mockClient = createMockClaudeClient([
        {
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'tu_1',
              name: 'get_code_findings',
              input: {},
            },
          ],
        },
        {
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'tu_2',
              name: 'get_query_findings',
              input: {},
            },
          ],
        },
        {
          stop_reason: 'end_turn',
          content: [
            { type: 'text', text: 'Correlation analysis complete referencing code-f1 and db-f1.' },
          ],
        },
      ]);

      const result = await runCorrelationOrchestrator({
        projectId: 'proj-1',
        sessionFindings: { code: codeFindings, database: dbFindings, logs: [] },
        claudeClient: mockClient,
      });

      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.toolCalls.length, 2);
      assert.strictEqual(result.exposedFindings.length, 2);
      assert.deepStrictEqual(result.referencedFindingIds, ['code-f1', 'db-f1']);
    });

    it('4. Claude requests all 3 analyzer tools simultaneously or sequentially', async () => {
      const codeFindings = [mockFinding({ id: 'code-f1', analyzer: 'code' })];
      const dbFindings = [mockFinding({ id: 'db-f1', analyzer: 'database' })];
      const logFindings = [mockFinding({ id: 'log-f1', analyzer: 'logs' })];

      const mockClient = createMockClaudeClient([
        {
          stop_reason: 'tool_use',
          content: [
            { type: 'tool_use', id: 'tu_1', name: 'get_code_findings', input: {} },
            { type: 'tool_use', id: 'tu_2', name: 'get_query_findings', input: {} },
            { type: 'tool_use', id: 'tu_3', name: 'get_log_findings', input: {} },
          ],
        },
        {
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'All layers inspected: code-f1, db-f1, log-f1.' }],
        },
      ]);

      const result = await runCorrelationOrchestrator({
        projectId: 'proj-1',
        sessionFindings: { code: codeFindings, database: dbFindings, logs: logFindings },
        claudeClient: mockClient,
      });

      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.toolCalls.length, 3);
      assert.strictEqual(result.exposedFindings.length, 3);
      assert.deepStrictEqual(result.referencedFindingIds, ['code-f1', 'db-f1', 'log-f1']);
    });
  });

  describe('Tool Call Validation', () => {
    it('5. unknown tool name is rejected cleanly', () => {
      const val = validateToolInput('unknown_tool', {});
      assert.strictEqual(val.valid, false);
      assert.ok(val.reason?.includes('Unknown tool name'));
    });

    it('6. malformed non-object input is normalized safely', () => {
      const val = validateToolInput('get_code_findings', 'invalid-json-str' as any);
      assert.strictEqual(val.valid, true);
      assert.deepStrictEqual(val.validatedInput, {});
    });

    it('7. invalid filter enum is rejected cleanly', () => {
      const val = validateToolInput('get_code_findings', { severity: 'super-critical' });
      assert.strictEqual(val.valid, false);
      assert.ok(val.reason?.includes('Invalid severity filter'));
    });

    it('8. excessive limit is clamped to MAX_FINDINGS_PER_TOOL_CALL', () => {
      const val = validateToolInput('get_code_findings', { limit: 9999 });
      assert.strictEqual(val.valid, true);
      assert.strictEqual(val.validatedInput.limit, CORRELATION_LIMITS.MAX_FINDINGS_PER_TOOL_CALL);
    });

    it('9. server project binding cannot be overridden by tool input', async () => {
      const codeFindings = [mockFinding({ id: 'code-f1', analyzer: 'code' })];
      const mockClient = createMockClaudeClient([
        {
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'tu_1',
              name: 'get_code_findings',
              input: { projectId: 'other-user-project-id' }, // malicious client injection attempt
            },
          ],
        },
        {
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Done' }],
        },
      ]);

      const result = await runCorrelationOrchestrator({
        projectId: 'trusted-user-project',
        sessionFindings: { code: codeFindings, database: [], logs: [] },
        claudeClient: mockClient,
      });

      assert.strictEqual(result.status, 'completed');
      // Verify returned finding is strictly from trusted server sessionFindings
      assert.strictEqual(result.exposedFindings[0].id, 'code-f1');
    });
  });

  describe('Tool Loop Safety & Limits', () => {
    it('10. turn limit is enforced', async () => {
      // Return tool_use on every turn endlessly
      const mockClient = createMockClaudeClient([
        {
          stop_reason: 'tool_use',
          content: [{ type: 'tool_use', id: 'tu_loop', name: 'get_code_findings', input: {} }],
        },
      ]);

      const result = await runCorrelationOrchestrator({
        projectId: 'proj-1',
        sessionFindings: { code: [mockFinding()], database: [], logs: [] },
        claudeClient: mockClient,
      });

      assert.strictEqual(result.status, 'limit_exceeded');
      assert.ok(result.response.includes('limit reached'));
    });

    it('11. maximum tool-call count limit is enforced', async () => {
      // Request 12 tools in single turn
      const toolUseBlocks = Array.from({ length: 12 }, (_, i) => ({
        type: 'tool_use',
        id: `tu_${i}`,
        name: 'get_code_findings',
        input: {},
      }));

      const mockClient = createMockClaudeClient([
        { stop_reason: 'tool_use', content: toolUseBlocks },
      ]);

      const result = await runCorrelationOrchestrator({
        projectId: 'proj-1',
        sessionFindings: { code: [mockFinding()], database: [], logs: [] },
        claudeClient: mockClient,
      });

      assert.strictEqual(result.status, 'limit_exceeded');
      assert.ok(result.response.includes('limit exceeded'));
    });

    it('12. maximum finding budget is capped safely', async () => {
      const codeFindings = Array.from({ length: 200 }, (_, i) => mockFinding({ id: `code-${i}` }));
      const mockClient = createMockClaudeClient([
        {
          stop_reason: 'tool_use',
          content: [
            { type: 'tool_use', id: 'tu_1', name: 'get_code_findings', input: { limit: 50 } },
          ],
        },
        { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done' }] },
      ]);

      const result = await runCorrelationOrchestrator({
        projectId: 'proj-1',
        sessionFindings: { code: codeFindings, database: [], logs: [] },
        claudeClient: mockClient,
      });

      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.exposedFindings.length, 50);
    });
  });

  describe('Finding Provenance & Reference Validation', () => {
    it('13. finding IDs, session IDs, and analyzer identity are preserved with 100% provenance', async () => {
      const originalFinding = mockFinding({
        id: 'orig-id-101',
        sessionId: 'sess-888',
        analyzer: 'code',
        severity: 'critical',
      });
      const mockClient = createMockClaudeClient([
        {
          stop_reason: 'tool_use',
          content: [{ type: 'tool_use', id: 'tu_1', name: 'get_code_findings', input: {} }],
        },
        { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Found orig-id-101.' }] },
      ]);

      const result = await runCorrelationOrchestrator({
        projectId: 'proj-1',
        sessionFindings: { code: [originalFinding], database: [], logs: [] },
        claudeClient: mockClient,
      });

      assert.strictEqual(result.exposedFindings[0].id, 'orig-id-101');
      assert.strictEqual(result.exposedFindings[0].sessionId, 'sess-888');
      assert.strictEqual(result.exposedFindings[0].analyzer, 'code');
      assert.strictEqual(result.exposedFindings[0].severity, 'critical');
    });

    it('16. unknown/unexposed final finding references are detected and rejected', () => {
      const exposedMap = new Map<string, Finding>([['code-f1', mockFinding({ id: 'code-f1' })]]);

      const responseText = 'Found relationships between code-f1 and finding-fake-999.';
      const { referencedFindingIds, rejectedFindingIds } = extractAndValidateReferencedFindingIds(
        responseText,
        exposedMap
      );

      assert.deepStrictEqual(referencedFindingIds, ['code-f1']);
      assert.deepStrictEqual(rejectedFindingIds, ['finding-fake-999']);
    });
  });

  describe('Failure Isolation & Offline State', () => {
    it('17. missing Anthropic API key returns explicit offline result', async () => {
      const originalEnv = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      const result = await runCorrelationOrchestrator({
        projectId: 'proj-1',
        sessionFindings: { code: [], database: [], logs: [] },
      });

      process.env.ANTHROPIC_API_KEY = originalEnv;

      assert.strictEqual(result.status, 'offline');
      assert.ok(result.response.includes('ANTHROPIC_API_KEY is not configured'));
    });

    it('18. Claude API error returns controlled failure state without crashing', async () => {
      const mockFailingClient = {
        messages: {
          create: async () => {
            throw new Error('API Rate Limit Exceeded');
          },
        },
      } as any;

      const result = await runCorrelationOrchestrator({
        projectId: 'proj-1',
        sessionFindings: { code: [], database: [], logs: [] },
        claudeClient: mockFailingClient,
      });

      assert.strictEqual(result.status, 'failed');
      assert.ok(result.response.includes('API Rate Limit Exceeded'));
    });

    it('19. individual tool failure returns tool error block without crashing process', async () => {
      const mockClient = createMockClaudeClient([
        {
          stop_reason: 'tool_use',
          content: [
            {
              type: 'tool_use',
              id: 'tu_err',
              name: 'invalid_tool_name',
              input: {},
            },
          ],
        },
        {
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'Recovered from tool error.' }],
        },
      ]);

      const result = await runCorrelationOrchestrator({
        projectId: 'proj-1',
        sessionFindings: { code: [], database: [], logs: [] },
        claudeClient: mockClient,
      });

      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.response, 'Recovered from tool error.');
    });
  });

  describe('Empty Analyzers & Session Availability', () => {
    it('21. handles zero code findings safely', async () => {
      const mockClient = createMockClaudeClient([
        { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Zero code findings.' }] },
      ]);

      const result = await runCorrelationOrchestrator({
        projectId: 'proj-1',
        sessionFindings: { code: [], database: [mockFinding({ id: 'db-1' })], logs: null },
        claudeClient: mockClient,
      });

      assert.strictEqual(result.status, 'completed');
      assert.strictEqual(result.sessionAvailability.code, true);
      assert.strictEqual(result.sessionAvailability.database, true);
      assert.strictEqual(result.sessionAvailability.logs, false); // null session distinguished from empty array
    });
  });

  describe('Deterministic Portions', () => {
    it('25. tool result ordering is stable across runs', async () => {
      const codeFindings = [mockFinding({ id: 'code-1' }), mockFinding({ id: 'code-2' })];
      const mockClient1 = createMockClaudeClient([
        {
          stop_reason: 'tool_use',
          content: [{ type: 'tool_use', id: 'tu_1', name: 'get_code_findings', input: {} }],
        },
        { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done' }] },
      ]);
      const mockClient2 = createMockClaudeClient([
        {
          stop_reason: 'tool_use',
          content: [{ type: 'tool_use', id: 'tu_1', name: 'get_code_findings', input: {} }],
        },
        { stop_reason: 'end_turn', content: [{ type: 'text', text: 'Done' }] },
      ]);

      const res1 = await runCorrelationOrchestrator({
        projectId: 'p1',
        sessionFindings: { code: codeFindings },
        claudeClient: mockClient1,
      });
      const res2 = await runCorrelationOrchestrator({
        projectId: 'p1',
        sessionFindings: { code: codeFindings },
        claudeClient: mockClient2,
      });

      assert.deepStrictEqual(
        res1.exposedFindings.map((f) => f.id),
        res2.exposedFindings.map((f) => f.id)
      );
    });
  });
});
