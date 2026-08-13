import assert from 'node:assert';
import { describe, it } from 'node:test';
import type { Finding } from '@codeinsight/shared-contracts';
import type { GroundedCorrelation } from '../correlation/types.js';
import { InvalidGroundingError, validateReportGrounding } from './correlation-service.js';

function mockFinding(id: string): Finding {
  return {
    id,
    sessionId: 'session-001',
    analyzer: 'code',
    category: 'tech_debt',
    severity: 'high',
    title: `Title ${id}`,
    description: `Description ${id}`,
    recommendation: 'Fix it',
    evidence: [],
    metadata: {},
    createdAt: new Date().toISOString(),
  };
}

describe('Correlation Engine Phase 6.5 — Server-Side Grounding Validation & Persistence Boundary', () => {
  const availableMap = new Map<string, Finding>([
    ['code-f1', mockFinding('code-f1')],
    ['db-f1', mockFinding('db-f1')],
    ['log-f1', mockFinding('log-f1')],
  ]);

  it('8. accepts valid grounded correlation items referencing exposed finding IDs', () => {
    const correlations: GroundedCorrelation[] = [
      {
        id: 'corr-1',
        findingIds: ['code-f1', 'db-f1'],
        analyzers: ['code', 'database'],
        relationship: 'code-to-query',
        explanation: 'Code module invokes unindexed SQL query.',
        evidence: 'Matching table TaskLedger.',
        confidence: 'high',
      },
    ];

    assert.doesNotThrow(() => {
      validateReportGrounding(correlations, availableMap);
    });
  });

  it('9 & 10. throws InvalidGroundingError and fails closed if any referenced finding ID is unknown/unexposed', () => {
    const correlations: GroundedCorrelation[] = [
      {
        id: 'corr-hallucinated',
        findingIds: ['code-f1', 'unexposed-fake-id-999'],
        analyzers: ['code'],
        relationship: 'cross-layer',
        explanation: 'Fake correlation.',
        evidence: 'None.',
        confidence: 'low',
      },
    ];

    assert.throws(
      () => {
        validateReportGrounding(correlations, availableMap);
      },
      (err: unknown) => {
        return (
          err instanceof InvalidGroundingError && err.message.includes('unexposed-fake-id-999')
        );
      }
    );
  });

  it('11. rejects finding IDs belonging to another project/session not present in availableMap', () => {
    const correlations: GroundedCorrelation[] = [
      {
        id: 'corr-cross-tenant',
        findingIds: ['finding-other-project-uuid-000'],
        analyzers: ['logs'],
        relationship: 'temporal',
        explanation: 'Attempted cross-tenant finding reference.',
        evidence: 'None.',
        confidence: 'medium',
      },
    ];

    assert.throws(() => {
      validateReportGrounding(correlations, availableMap);
    }, InvalidGroundingError);
  });

  it('12. throws InvalidGroundingError if action plan item contains empty findingIds array', () => {
    const correlations: GroundedCorrelation[] = [
      {
        id: 'corr-empty',
        findingIds: [],
        analyzers: ['code'],
        relationship: 'code-to-runtime',
        explanation: 'Empty finding IDs array.',
        evidence: 'None.',
        confidence: 'low',
      },
    ];

    assert.throws(() => {
      validateReportGrounding(correlations, availableMap);
    }, InvalidGroundingError);
  });
});
