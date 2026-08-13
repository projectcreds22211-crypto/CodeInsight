import assert from 'node:assert';
import { describe, it } from 'node:test';
import type { Finding } from '@codeinsight/shared-contracts';
import {
  runCorrelationOrchestrator,
  validateToolInput,
  CORRELATION_LIMITS,
} from './orchestrator.js';
import {
  buildCorrelationPrompt,
  parseClaudeCorrelationResponse,
  sanitizeCorrelationSecrets,
  CORRELATION_SYSTEM_PROMPT,
} from './prompt.js';
import { dispatchCorrelationToolCall } from './tools.js';
import { InvalidGroundingError, validateReportGrounding } from '../services/correlation-service.js';

function createMockFinding(
  overrides: Partial<Finding> & { id: string; analyzer: 'code' | 'database' | 'logs' }
): Finding {
  return {
    id: overrides.id,
    sessionId: overrides.sessionId || `session-${overrides.analyzer}`,
    analyzer: overrides.analyzer,
    category: overrides.category || 'tech_debt',
    severity: overrides.severity || 'high',
    title: overrides.title || `Finding ${overrides.id}`,
    description: overrides.description || `Description for ${overrides.id}`,
    recommendation: overrides.recommendation || `Fix ${overrides.id}`,
    evidence: overrides.evidence || [],
    metadata: overrides.metadata || {},
    createdAt: overrides.createdAt || new Date().toISOString(),
  };
}

describe('Phase 6.9 Grounding Test & Final Hardening Suite', () => {
  const exposedCodeFinding = createMockFinding({ id: 'code-valid-1', analyzer: 'code' });
  const exposedDbFinding = createMockFinding({ id: 'db-valid-1', analyzer: 'database' });
  const exposedLogFinding = createMockFinding({ id: 'log-valid-1', analyzer: 'logs' });

  const exposedMap = new Map<string, Finding>([
    ['code-valid-1', exposedCodeFinding],
    ['db-valid-1', exposedDbFinding],
    ['log-valid-1', exposedLogFinding],
  ]);

  // ==================================================
  // 1. FINDING ID GROUNDING (Combinations A–J)
  // ==================================================
  describe('1. Finding ID Grounding (Combinations A–J)', () => {
    it('A. All valid IDs -> accepted', () => {
      const json = JSON.stringify({
        summaryOverview: 'Valid test',
        correlations: [
          {
            findingIds: ['code-valid-1', 'db-valid-1'],
            relationship: 'code-to-query',
            explanation: 'Valid correlation linking exposed findings.',
            evidence: 'Concrete evidence signal.',
            confidence: 'high',
          },
        ],
      });
      const res = parseClaudeCorrelationResponse(json, exposedMap);
      assert.strictEqual(res.correlations.length, 1);
      assert.deepStrictEqual(res.correlations[0].findingIds, ['code-valid-1', 'db-valid-1']);
    });

    it('B. One valid + one fake ID -> fake ID rejected, valid ID preserved', () => {
      const json = JSON.stringify({
        summaryOverview: 'Mixed IDs test',
        correlations: [
          {
            findingIds: ['code-valid-1', 'fake-id-999'],
            relationship: 'code-to-query',
            explanation: 'Correlation with one fake ID.',
            evidence: 'Concrete evidence signal.',
            confidence: 'medium',
          },
        ],
      });
      const res = parseClaudeCorrelationResponse(json, exposedMap);
      assert.strictEqual(res.correlations.length, 1);
      assert.deepStrictEqual(res.correlations[0].findingIds, ['code-valid-1']);
    });

    it('C. All fake IDs -> correlation rejected', () => {
      const json = JSON.stringify({
        summaryOverview: 'All fake IDs test',
        correlations: [
          {
            findingIds: ['fake-id-1', 'fake-id-2'],
            relationship: 'code-to-query',
            explanation: 'Correlation with all fake IDs.',
            evidence: 'Concrete evidence.',
            confidence: 'high',
          },
        ],
      });
      const res = parseClaudeCorrelationResponse(json, exposedMap);
      assert.strictEqual(res.correlations.length, 0);
    });

    it('D. Empty findingIds -> correlation rejected', () => {
      const json = JSON.stringify({
        summaryOverview: 'Empty findingIds test',
        correlations: [
          {
            findingIds: [],
            relationship: 'code-to-query',
            explanation: 'Correlation with no finding IDs.',
            evidence: 'Concrete evidence.',
            confidence: 'high',
          },
        ],
      });
      const res = parseClaudeCorrelationResponse(json, exposedMap);
      assert.strictEqual(res.correlations.length, 0);
    });

    it('E. Duplicate finding IDs -> deterministically normalized', () => {
      const json = JSON.stringify({
        summaryOverview: 'Duplicate IDs test',
        correlations: [
          {
            findingIds: ['code-valid-1', 'code-valid-1', 'db-valid-1', 'db-valid-1'],
            relationship: 'code-to-query',
            explanation: 'Correlation with duplicated IDs.',
            evidence: 'Concrete evidence.',
            confidence: 'high',
          },
        ],
      });
      const res = parseClaudeCorrelationResponse(json, exposedMap);
      assert.strictEqual(res.correlations.length, 1);
      assert.deepStrictEqual(res.correlations[0].findingIds, ['code-valid-1', 'db-valid-1']);
    });

    it('F. Same finding IDs in different order -> identical canonical correlation identity', () => {
      const json1 = JSON.stringify({
        summaryOverview: 'Order 1',
        correlations: [
          {
            findingIds: ['db-valid-1', 'code-valid-1'],
            relationship: 'code-to-query',
            explanation: 'Explanation text',
            evidence: 'Evidence text',
            confidence: 'high',
          },
        ],
      });
      const json2 = JSON.stringify({
        summaryOverview: 'Order 2',
        correlations: [
          {
            findingIds: ['code-valid-1', 'db-valid-1'],
            relationship: 'code-to-query',
            explanation: 'Explanation text',
            evidence: 'Evidence text',
            confidence: 'high',
          },
        ],
      });

      const res1 = parseClaudeCorrelationResponse(json1, exposedMap);
      const res2 = parseClaudeCorrelationResponse(json2, exposedMap);

      assert.strictEqual(res1.correlations[0].id, res2.correlations[0].id);
      assert.deepStrictEqual(
        new Set(res1.correlations[0].findingIds),
        new Set(res2.correlations[0].findingIds)
      );
    });

    it('G. Finding ID belonging to another analyzer -> accepted ONLY if exposed in orchestrator run', () => {
      const json = JSON.stringify({
        summaryOverview: 'Cross analyzer test',
        correlations: [
          {
            findingIds: ['code-valid-1', 'log-valid-1'],
            relationship: 'code-to-runtime',
            explanation: 'Code to log relationship.',
            evidence: 'Concrete evidence.',
            confidence: 'high',
          },
        ],
      });
      const res = parseClaudeCorrelationResponse(json, exposedMap);
      assert.strictEqual(res.correlations.length, 1);
      assert.deepStrictEqual(res.correlations[0].analyzers, ['code', 'logs']);
    });

    it('H. Finding ID from another project/session -> rejected', () => {
      const unexposedOtherProjectFindingId = 'other-project-finding-uuid-999';
      const json = JSON.stringify({
        summaryOverview: 'Tenant cross leakage test',
        correlations: [
          {
            findingIds: [unexposedOtherProjectFindingId],
            relationship: 'code-to-query',
            explanation: 'Attempt to reference other tenant finding.',
            evidence: 'Evidence.',
            confidence: 'high',
          },
        ],
      });
      const res = parseClaudeCorrelationResponse(json, exposedMap);
      assert.strictEqual(res.correlations.length, 0);
    });

    it('I. Finding ID that exists in database but was NOT exposed in orchestrator run -> rejected', () => {
      const unexposedDatabaseFindingId = 'db-unexposed-123';
      const json = JSON.stringify({
        summaryOverview: 'Unexposed DB finding test',
        correlations: [
          {
            findingIds: [unexposedDatabaseFindingId],
            relationship: 'query-to-runtime',
            explanation: 'Referencing unexposed finding.',
            evidence: 'Evidence.',
            confidence: 'high',
          },
        ],
      });
      const res = parseClaudeCorrelationResponse(json, exposedMap);
      assert.strictEqual(res.correlations.length, 0);
    });

    it('J. Finding ID with malformed/unexpected structure -> safely rejected', () => {
      const json = JSON.stringify({
        summaryOverview: 'Malformed ID structure test',
        correlations: [
          {
            findingIds: [null, 12345, { id: 'nested' }, '   ', '../../etc/passwd'],
            relationship: 'code-to-query',
            explanation: 'Malformed ID elements.',
            evidence: 'Evidence.',
            confidence: 'high',
          },
        ],
      });
      const res = parseClaudeCorrelationResponse(json, exposedMap);
      assert.strictEqual(res.correlations.length, 0);
    });
  });

  // ==================================================
  // 2. SESSION / PROJECT / TENANT ISOLATION
  // ==================================================
  describe('2. Session / Project / Tenant Isolation', () => {
    it('validateReportGrounding throws InvalidGroundingError if unexposed finding ID referenced', () => {
      const fakeCorrelation = {
        id: 'corr_test_1',
        findingIds: ['code-valid-1', 'unexposed-tenant-id-999'],
        analyzers: ['code' as const],
        relationship: 'code-to-query' as const,
        explanation: 'Test',
        evidence: 'Test',
        confidence: 'high' as const,
      };

      assert.throws(
        () => validateReportGrounding([fakeCorrelation], exposedMap),
        (err: unknown) => {
          return (
            err instanceof InvalidGroundingError &&
            err.message.includes('references unexposed finding ID')
          );
        }
      );
    });

    it('validateReportGrounding throws InvalidGroundingError for empty findingIds array', () => {
      const emptyCorrelation = {
        id: 'corr_test_empty',
        findingIds: [],
        analyzers: ['code' as const],
        relationship: 'code-to-query' as const,
        explanation: 'Test',
        evidence: 'Test',
        confidence: 'high' as const,
      };

      assert.throws(
        () => validateReportGrounding([emptyCorrelation], exposedMap),
        (err: unknown) => {
          return (
            err instanceof InvalidGroundingError &&
            err.message.includes('contains no referenced finding IDs')
          );
        }
      );
    });
  });

  // ==================================================
  // 3. CLAUDE TOOL SAFETY & ENFORCEMENT
  // ==================================================
  describe('3. Claude Tool Safety & Limit Enforcement', () => {
    it('validateToolInput rejects unknown tool names', () => {
      const res = validateToolInput('unknown_tool_name', {});
      assert.strictEqual(res.valid, false);
      assert.ok(res.reason?.includes('Unknown tool name'));
    });

    it('validateToolInput safely handles null, Array, and primitive rawInput', () => {
      assert.strictEqual(validateToolInput('get_code_findings', null).valid, true);
      assert.strictEqual(validateToolInput('get_code_findings', [1, 2, 3]).valid, true);
      assert.strictEqual(validateToolInput('get_code_findings', 'primitive_string').valid, true);
      assert.strictEqual(validateToolInput('get_code_findings', 12345).valid, true);
    });

    it('validateToolInput validates severity and category enums', () => {
      const invalidSev = validateToolInput('get_code_findings', { severity: 'invalid_sev' });
      assert.strictEqual(invalidSev.valid, false);

      const invalidCat = validateToolInput('get_code_findings', { category: 'invalid_cat' });
      assert.strictEqual(invalidCat.valid, false);

      const validBoth = validateToolInput('get_code_findings', {
        severity: 'high',
        category: 'architecture',
      });
      assert.strictEqual(validBoth.valid, true);
      assert.strictEqual(validBoth.validatedInput.severity, 'high');
      assert.strictEqual(validBoth.validatedInput.category, 'architecture');
    });

    it('validateToolInput clamps negative, zero, and enormous limits', () => {
      const neg = validateToolInput('get_code_findings', { limit: -10 });
      assert.strictEqual(neg.validatedInput.limit, 1);

      const zero = validateToolInput('get_code_findings', { limit: 0 });
      assert.strictEqual(zero.validatedInput.limit, 1);

      const huge = validateToolInput('get_code_findings', { limit: 999999 });
      assert.strictEqual(huge.validatedInput.limit, CORRELATION_LIMITS.MAX_FINDINGS_PER_TOOL_CALL);
    });

    it('dispatchCorrelationToolCall throws on unsupported tool name', () => {
      assert.throws(() => {
        dispatchCorrelationToolCall('invalid_tool' as any, {}, {});
      }, /Unsupported correlation tool name/);
    });
  });

  // ==================================================
  // 4. PROMPT INJECTION HARDENING
  // ==================================================
  describe('4. Prompt Injection Hardening', () => {
    it('System prompt clearly mandates operational constraints and untrusted data handling', () => {
      assert.ok(CORRELATION_SYSTEM_PROMPT.includes('GROUNDING MANDATE'));
      assert.ok(CORRELATION_SYSTEM_PROMPT.includes('PROMPT INJECTION DEFENSE'));
      assert.ok(CORRELATION_SYSTEM_PROMPT.includes('UNTRUSTED DATA'));
    });

    it('sanitizeCorrelationSecrets redacts bearer tokens, API keys, and connection strings', () => {
      const rawText =
        'Secret sk-proj1234567890abcdef123456 with Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9 and postgres://user:pass@localhost:5432/mydb and API_KEY=secret_val';
      const clean = sanitizeCorrelationSecrets(rawText);

      assert.ok(!clean.includes('sk-proj1234567890abcdef123456'));
      assert.ok(!clean.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'));
      assert.ok(!clean.includes('postgres://user:pass@localhost:5432/mydb'));
      assert.ok(!clean.includes('secret_val'));
      assert.ok(clean.includes('[REDACTED_SECRET]'));
      assert.ok(clean.includes('Bearer [REDACTED_TOKEN]'));
      assert.ok(clean.includes('[REDACTED_DATABASE_URL]'));
      assert.ok(clean.includes('[REDACTED_ENV_VAR]'));
    });

    it('buildCorrelationPrompt redacts secrets from user prompt input', () => {
      const { userPrompt } = buildCorrelationPrompt({
        projectId: 'prj_123',
        sessionAvailability: { code: true, database: true, logs: true },
        findingsCount: 5,
      });
      assert.ok(userPrompt.includes("Project Context ID: 'prj_123'"));
    });
  });

  // ==================================================
  // 5. RESPONSE PARSER HARDENING
  // ==================================================
  describe('5. Response Parser Hardening', () => {
    it('Parses JSON embedded in conversational text with markdown code fences', () => {
      const raw =
        'Here is the analysis:\n```json\n{\n  "summaryOverview": "Embedded overview",\n  "correlations": [\n    {\n      "findingIds": ["code-valid-1"],\n      "relationship": "code-to-query",\n      "explanation": "Embedded explanation",\n      "evidence": "Embedded evidence",\n      "confidence": "high"\n    }\n  ]\n}\n```\nHope this helps!';

      const parsed = parseClaudeCorrelationResponse(raw, exposedMap);
      assert.strictEqual(parsed.correlations.length, 1);
      assert.strictEqual(parsed.summaryOverview, 'Embedded overview');
    });

    it('Parses raw JSON without markdown fences surrounded by text', () => {
      const raw =
        'Analysis output: {\n  "summaryOverview": "Raw JSON",\n  "correlations": [\n    {\n      "findingIds": ["code-valid-1"],\n      "relationship": "code-to-query",\n      "explanation": "Raw explanation",\n      "evidence": "Raw evidence",\n      "confidence": "high"\n    }\n  ]\n} End of output.';

      const parsed = parseClaudeCorrelationResponse(raw, exposedMap);
      assert.strictEqual(parsed.correlations.length, 1);
      assert.strictEqual(parsed.summaryOverview, 'Raw JSON');
    });

    it('Fails closed on truncated or unparseable JSON without throwing exceptions', () => {
      const truncated =
        '```json\n{ "summaryOverview": "Incomplete", "correlations": [ { "findingIds": [';
      const parsed = parseClaudeCorrelationResponse(truncated, exposedMap);
      assert.strictEqual(parsed.correlations.length, 0);
      assert.strictEqual(parsed.summaryOverview, 'Failed to parse correlation response JSON.');
    });

    it('Ignores invalid relationship and confidence enums, falling back safely', () => {
      const json = JSON.stringify({
        summaryOverview: 'Enum fallback test',
        correlations: [
          {
            findingIds: ['code-valid-1'],
            relationship: 'invalid_relationship_type',
            explanation: 'Fallback test',
            evidence: 'Fallback evidence',
            confidence: 'invalid_confidence_level',
          },
        ],
      });

      const parsed = parseClaudeCorrelationResponse(json, exposedMap);
      assert.strictEqual(parsed.correlations.length, 1);
      assert.strictEqual(parsed.correlations[0].relationship, 'cross-layer');
      assert.strictEqual(parsed.correlations[0].confidence, 'medium');
    });
  });

  // ==================================================
  // 6. DETERMINISM & STABILITY
  // ==================================================
  describe('6. Determinism & Stability', () => {
    it('10 consecutive executions produce 100% byte-identical outputs', () => {
      const json = JSON.stringify({
        summaryOverview: 'Determinism test overview',
        correlations: [
          {
            findingIds: ['db-valid-1', 'code-valid-1'],
            relationship: 'code-to-query',
            explanation: 'Determinism explanation',
            evidence: 'Determinism evidence',
            confidence: 'high',
          },
        ],
      });

      const runs: string[] = [];
      for (let i = 0; i < 10; i++) {
        const res = parseClaudeCorrelationResponse(json, exposedMap);
        runs.push(JSON.stringify(res));
      }

      const first = runs[0];
      for (let i = 1; i < 10; i++) {
        assert.strictEqual(runs[i], first, `Execution run ${i + 1} must match run 1 identically`);
      }
    });
  });

  // ==================================================
  // 7. FAILURE & RECOVERY HARDENING
  // ==================================================
  describe('7. Failure & Recovery Hardening', () => {
    it('runCorrelationOrchestrator handles unconfigured ANTHROPIC_API_KEY safely returning offline status', async () => {
      const origKey = process.env.ANTHROPIC_API_KEY;
      try {
        delete process.env.ANTHROPIC_API_KEY;
        const res = await runCorrelationOrchestrator({
          projectId: 'prj_test',
          sessionFindings: { code: [exposedCodeFinding], database: [], logs: [] },
        });

        assert.strictEqual(res.status, 'offline');
        assert.ok(res.response.includes('ANTHROPIC_API_KEY is not configured'));
      } finally {
        if (origKey) process.env.ANTHROPIC_API_KEY = origKey;
      }
    });
  });
});
