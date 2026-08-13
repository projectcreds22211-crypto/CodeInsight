import assert from 'node:assert';
import { describe, it } from 'node:test';
import type { Finding } from '@codeinsight/shared-contracts';
import {
  ALL_CORRELATION_TOOLS,
  dispatchCorrelationToolCall,
  executeGetCodeFindings,
  executeGetLogFindings,
  executeGetQueryFindings,
  GET_CODE_FINDINGS_TOOL,
  GET_LOG_FINDINGS_TOOL,
  GET_QUERY_FINDINGS_TOOL,
} from './tools.js';

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
    evidence: overrides.evidence || [{ source: 'src/app.ts', snippet: 'sample evidence snippet' }],
    metadata: overrides.metadata || { ruleId: 'circular-dependency' },
    createdAt: overrides.createdAt || new Date().toISOString(),
  };
}

describe('Correlation Engine Phase 6.1 — Claude Tool Schema & Grounding Contracts', () => {
  describe('Tool Schema Definitions', () => {
    it('1. exports all 3 required correlation tool definitions', () => {
      assert.strictEqual(ALL_CORRELATION_TOOLS.length, 3);
      assert.deepStrictEqual(
        ALL_CORRELATION_TOOLS.map((t) => t.name),
        ['get_code_findings', 'get_query_findings', 'get_log_findings']
      );
    });

    it('2. get_code_findings schema defines valid Anthropic input_schema', () => {
      assert.strictEqual(GET_CODE_FINDINGS_TOOL.name, 'get_code_findings');
      assert.ok(GET_CODE_FINDINGS_TOOL.description?.includes('Code Analyzer'));
      assert.strictEqual(GET_CODE_FINDINGS_TOOL.input_schema.type, 'object');
      const props = GET_CODE_FINDINGS_TOOL.input_schema.properties as Record<string, unknown>;
      assert.ok(props?.severity);
      assert.ok(props?.category);
      assert.ok(props?.ruleId);
    });

    it('3. get_query_findings schema defines valid Anthropic input_schema', () => {
      assert.strictEqual(GET_QUERY_FINDINGS_TOOL.name, 'get_query_findings');
      assert.ok(GET_QUERY_FINDINGS_TOOL.description?.includes('Database Analyzer'));
      assert.strictEqual(GET_QUERY_FINDINGS_TOOL.input_schema.type, 'object');
      const props = GET_QUERY_FINDINGS_TOOL.input_schema.properties as Record<string, unknown>;
      assert.ok(props?.severity);
      assert.ok(props?.queryHash);
    });

    it('4. get_log_findings schema defines valid Anthropic input_schema', () => {
      assert.strictEqual(GET_LOG_FINDINGS_TOOL.name, 'get_log_findings');
      assert.ok(GET_LOG_FINDINGS_TOOL.description?.includes('Log Analyzer'));
      assert.strictEqual(GET_LOG_FINDINGS_TOOL.input_schema.type, 'object');
      const props = GET_LOG_FINDINGS_TOOL.input_schema.properties as Record<string, unknown>;
      assert.ok(props?.severity);
      assert.ok(props?.anomalyType);
    });
  });

  describe('get_code_findings Tool Execution', () => {
    const mockCodeFindings: Finding[] = [
      mockFinding({
        id: 'code-1',
        analyzer: 'code',
        category: 'architecture',
        severity: 'high',
        metadata: { ruleId: 'circular-dependency' },
      }),
      mockFinding({
        id: 'code-2',
        analyzer: 'code',
        category: 'tech_debt',
        severity: 'medium',
        metadata: { ruleId: 'duplicate-logic' },
      }),
      mockFinding({
        id: 'code-3',
        analyzer: 'code',
        category: 'tech_debt',
        severity: 'low',
        metadata: { ruleId: 'comment-debt' },
      }),
    ];

    it('5. returns all code findings when no filters are specified', () => {
      const res = executeGetCodeFindings(mockCodeFindings);
      assert.strictEqual(res.totalAvailable, 3);
      assert.strictEqual(res.returnedCount, 3);
      assert.strictEqual(res.findings.length, 3);
    });

    it('6. filters code findings by severity', () => {
      const res = executeGetCodeFindings(mockCodeFindings, { severity: 'high' });
      assert.strictEqual(res.returnedCount, 1);
      assert.strictEqual(res.findings[0].id, 'code-1');
    });

    it('7. filters code findings by ruleId', () => {
      const res = executeGetCodeFindings(mockCodeFindings, { ruleId: 'duplicate-logic' });
      assert.strictEqual(res.returnedCount, 1);
      assert.strictEqual(res.findings[0].id, 'code-2');
    });

    it('8. applies limit parameter correctly', () => {
      const res = executeGetCodeFindings(mockCodeFindings, { limit: 2 });
      assert.strictEqual(res.returnedCount, 2);
    });
  });

  describe('get_query_findings Tool Execution', () => {
    const mockDbFindings: Finding[] = [
      mockFinding({
        id: 'db-1',
        analyzer: 'database',
        category: 'query_optimization',
        severity: 'high',
        metadata: { queryHash: 'hash-abc' },
      }),
      mockFinding({
        id: 'db-2',
        analyzer: 'database',
        category: 'query_optimization',
        severity: 'medium',
        metadata: { queryHash: 'hash-xyz' },
      }),
    ];

    it('9. filters query findings by queryHash', () => {
      const res = executeGetQueryFindings(mockDbFindings, { queryHash: 'hash-xyz' });
      assert.strictEqual(res.returnedCount, 1);
      assert.strictEqual(res.findings[0].id, 'db-2');
    });
  });

  describe('get_log_findings Tool Execution', () => {
    const mockLogFindings: Finding[] = [
      mockFinding({
        id: 'log-1',
        analyzer: 'logs',
        category: 'anomaly',
        severity: 'critical',
        metadata: { anomalyType: 'pool_exhaustion' },
      }),
      mockFinding({
        id: 'log-2',
        analyzer: 'logs',
        category: 'anomaly',
        severity: 'high',
        metadata: { anomalyType: 'latency_spike' },
      }),
    ];

    it('10. filters log findings by anomalyType', () => {
      const res = executeGetLogFindings(mockLogFindings, { anomalyType: 'pool_exhaustion' });
      assert.strictEqual(res.returnedCount, 1);
      assert.strictEqual(res.findings[0].id, 'log-1');
    });
  });

  describe('Unified Tool Dispatcher & Grounding Contracts', () => {
    const findingsMap = {
      code: [mockFinding({ id: 'code-f1', analyzer: 'code' })],
      database: [mockFinding({ id: 'db-f1', analyzer: 'database' })],
      logs: [mockFinding({ id: 'log-f1', analyzer: 'logs' })],
    };

    it('11. dispatches get_code_findings tool call', () => {
      const res = dispatchCorrelationToolCall('get_code_findings', {}, findingsMap);
      assert.strictEqual(res.toolName, 'get_code_findings');
      assert.strictEqual(res.findings[0].id, 'code-f1');
    });

    it('12. dispatches get_query_findings tool call', () => {
      const res = dispatchCorrelationToolCall('get_query_findings', {}, findingsMap);
      assert.strictEqual(res.toolName, 'get_query_findings');
      assert.strictEqual(res.findings[0].id, 'db-f1');
    });

    it('13. dispatches get_log_findings tool call', () => {
      const res = dispatchCorrelationToolCall('get_log_findings', {}, findingsMap);
      assert.strictEqual(res.toolName, 'get_log_findings');
      assert.strictEqual(res.findings[0].id, 'log-f1');
    });

    it('14. throws error for invalid tool name', () => {
      assert.throws(
        () => dispatchCorrelationToolCall('invalid_tool' as any, {}, findingsMap),
        /Unsupported correlation tool name/
      );
    });

    it('15. serializedOutput contains valid JSON string representation of tool result', () => {
      const res = dispatchCorrelationToolCall('get_code_findings', {}, findingsMap);
      const parsed = JSON.parse(res.serializedOutput);
      assert.strictEqual(parsed.tool, 'get_code_findings');
      assert.strictEqual(parsed.returnedCount, 1);
      assert.strictEqual(parsed.findings[0].id, 'code-f1');
    });
  });
});
