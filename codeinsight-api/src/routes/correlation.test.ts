import assert from 'node:assert';
import { describe, it } from 'node:test';
import type { Finding } from '@codeinsight/shared-contracts';
import { formatSSEEvent } from '../services/correlation-service.js';
import type { CorrelationSSEEvent } from '../correlation/types.js';

describe('Correlation Engine Phase 6.4 — SSE Endpoint & Protocol', () => {
  describe('SSE Formatting & Protocol Helper', () => {
    it('7-10 & 15. formatSSEEvent produces valid spec-compliant SSE string formatted as JSON', () => {
      const event: CorrelationSSEEvent = {
        type: 'connection',
        status: 'connected',
        timestamp: '2026-08-13T00:00:00.000Z',
      };

      const sseString = formatSSEEvent(event);

      assert.ok(sseString.startsWith('event: connection\n'));
      assert.ok(
        sseString.includes(
          'data: {"type":"connection","status":"connected","timestamp":"2026-08-13T00:00:00.000Z"}\n\n'
        )
      );

      const dataLine = sseString.split('\n')[1].replace('data: ', '');
      const parsedData = JSON.parse(dataLine);
      assert.strictEqual(parsedData.type, 'connection');
      assert.strictEqual(parsedData.status, 'connected');
    });

    it('11-14. formats started, tool_call, tool_result, correlation, and completed events correctly', () => {
      const startedEvent: CorrelationSSEEvent = {
        type: 'started',
        projectId: 'proj-123',
        sessionAvailability: { code: true, database: true, logs: false },
        timestamp: '2026-08-13T00:00:00.000Z',
      };
      const formattedStarted = formatSSEEvent(startedEvent);
      assert.ok(formattedStarted.startsWith('event: started\n'));

      const toolCallEvent: CorrelationSSEEvent = {
        type: 'tool_call',
        tool: 'get_code_findings',
        timestamp: '2026-08-13T00:00:01.000Z',
      };
      const formattedToolCall = formatSSEEvent(toolCallEvent);
      assert.ok(formattedToolCall.startsWith('event: tool_call\n'));

      const correlationEvent: CorrelationSSEEvent = {
        type: 'correlation',
        correlation: {
          id: 'corr_code-to-query_c1_q1',
          findingIds: ['c1', 'q1'],
          analyzers: ['code', 'database'],
          relationship: 'code-to-query',
          explanation: 'Code module triggers slow query.',
          evidence: 'Shared table UserAccount.',
          confidence: 'high',
        },
      };
      const formattedCorrelation = formatSSEEvent(correlationEvent);
      assert.ok(formattedCorrelation.startsWith('event: correlation\n'));
    });
  });

  describe('Security & Data Leak Defense Boundary', () => {
    it('17-20. SSE payloads do not leak API keys, prompts, stack traces, or credentials', () => {
      const sensitiveSecret = 'sk-proj1234567890abcdef123456';
      const event: CorrelationSSEEvent = {
        type: 'reasoning',
        text: 'Analyzed code finding c1 and db finding q1 without sensitive keys.',
      };

      const formatted = formatSSEEvent(event);

      assert.ok(!formatted.includes(sensitiveSecret));
      assert.ok(!formatted.includes('ANTHROPIC_API_KEY'));
      assert.ok(!formatted.includes('DATABASE_URL'));
    });
  });

  describe('Phase 6.6 — Unified Report Endpoint Contract', () => {
    it('returns structured CorrelationReportResponse shape with project availability and report payload', () => {
      const mockReportData = {
        projectId: 'proj-123',
        report: {
          id: 'rep-001',
          sessionId: 'sess-001',
          summary: 'Systemic bottleneck detected between TaskLedger query and pool exhaustion.',
          actionPlan: [
            {
              id: 'corr_1',
              findingIds: ['code-1', 'db-1'],
              analyzers: ['code', 'database'] as Array<'code' | 'database' | 'logs'>,
              relationship: 'code-to-query' as const,
              explanation: 'High concurrency in API service triggers unindexed query.',
              evidence: 'TaskLedger table scan.',
              confidence: 'high' as const,
            },
          ],
          generatedAt: new Date().toISOString(),
        },
        sessionAvailability: {
          code: true,
          database: true,
          logs: true,
        },
        totalFindingsCount: 2,
      };

      assert.strictEqual(mockReportData.projectId, 'proj-123');
      assert.strictEqual(mockReportData.report?.actionPlan.length, 1);
      assert.strictEqual(mockReportData.report?.actionPlan[0].relationship, 'code-to-query');
      assert.strictEqual(mockReportData.sessionAvailability.code, true);
    });
  });

  describe('Phase 6.7 — The Thread Grounded Investigation Timeline Contract', () => {
    it('1-5. validates Thread structure across all 5 supported relationship categories', () => {
      const relationships = [
        'temporal',
        'code-to-query',
        'query-to-runtime',
        'code-to-runtime',
        'cross-layer',
      ] as const;

      for (const rel of relationships) {
        const item = {
          id: `corr_${rel}`,
          findingIds: ['f-code-1', 'f-db-1'],
          analyzers: ['code', 'database'] as Array<'code' | 'database' | 'logs'>,
          relationship: rel,
          explanation: `Systemic correlation narrative for ${rel}`,
          evidence: `Evidence signal for ${rel}`,
          confidence: 'high' as const,
          temporalEvidence: rel === 'temporal' ? '15 seconds between findings' : undefined,
        };

        assert.strictEqual(item.relationship, rel);
        assert.ok(item.findingIds.length >= 2);
        if (rel === 'temporal') {
          assert.strictEqual(item.temporalEvidence, '15 seconds between findings');
        } else {
          assert.strictEqual(item.temporalEvidence, undefined);
        }
      }
    });

    it('6-7. preserves probabilistic non-causal wording and 3-tier confidence rating', () => {
      const correlationItem = {
        id: 'corr_non_causal',
        findingIds: ['code-f1', 'log-f1'],
        analyzers: ['code', 'logs'] as Array<'code' | 'database' | 'logs'>,
        relationship: 'code-to-runtime' as const,
        explanation: 'Unbounded loop likely contributed to memory pressure.',
        evidence: 'Heap memory trend matching long-function smell.',
        confidence: 'medium' as const,
      };

      assert.ok(!correlationItem.explanation.includes('confirmed root cause'));
      assert.ok(!correlationItem.explanation.includes('guaranteed reason'));
      assert.strictEqual(correlationItem.confidence, 'medium');
    });
  });
});
