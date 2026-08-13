import assert from 'node:assert';
import { describe, it } from 'node:test';
import { DEMO_DATABASE_INPUT } from './fixtures/demo-database-fixture.js';
import {
  parseSchemaDdl,
  runCorrelatedSubqueryRule,
  runDatabaseRules,
  runDuplicateQueryRule,
  runMissingIndexRule,
  runNPlusOneRule,
  runSelectStarRule,
  runUnboundedQueryRule,
  runUnnecessaryDistinctRule,
} from './rules.js';
import type { DatabaseAnalyzerInput } from './types.js';

describe('Database Analyzer Deterministic Rules Layer (Phase 3.2)', () => {
  const sampleSchema = `
    CREATE TABLE users (
      id VARCHAR(64) PRIMARY KEY,
      email VARCHAR(255) NOT NULL,
      org_id VARCHAR(64) NOT NULL
    );
    CREATE TABLE tasks (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(64) NOT NULL,
      status VARCHAR(50) NOT NULL,
      hourly_rate NUMERIC(10, 2) NOT NULL
    );
    CREATE INDEX idx_users_org ON users(org_id);
  `;

  describe('Rule A: SELECT * Detection', () => {
    it('detects SELECT * in positive cases', () => {
      const input: DatabaseAnalyzerInput = {
        schemaSql: sampleSchema,
        queriesSql: ['SELECT * FROM users;', 'SELECT u.* FROM users u;'],
      };
      const findings = runSelectStarRule(input);
      assert.strictEqual(findings.length, 2);
      assert.strictEqual(findings[0].metadata?.ruleId, 'select-star');
    });

    it('does not flag explicit column selections in negative cases', () => {
      const input: DatabaseAnalyzerInput = {
        schemaSql: sampleSchema,
        queriesSql: ['SELECT id, email FROM users;', 'SELECT id, status FROM tasks;'],
      };
      const findings = runSelectStarRule(input);
      assert.strictEqual(findings.length, 0);
    });
  });

  describe('Rule B: Missing Index Detection', () => {
    it('detects unindexed ORDER BY columns', () => {
      const schema = parseSchemaDdl(sampleSchema);
      const input: DatabaseAnalyzerInput = {
        schemaSql: sampleSchema,
        queriesSql: ['SELECT id, status FROM tasks ORDER BY hourly_rate DESC;'],
      };
      const findings = runMissingIndexRule(input, schema);
      assert.strictEqual(findings.length, 1);
      assert.strictEqual(findings[0].metadata?.ruleId, 'unindexed-order-by');
      assert.strictEqual(findings[0].metadata?.column, 'hourly_rate');
    });

    it('does not flag ORDER BY on indexed columns', () => {
      const schema = parseSchemaDdl(sampleSchema);
      const input: DatabaseAnalyzerInput = {
        schemaSql: sampleSchema,
        queriesSql: ['SELECT id, email FROM users ORDER BY org_id ASC;'],
      };
      const findings = runMissingIndexRule(input, schema);
      assert.strictEqual(findings.length, 0);
    });
  });

  describe('Rule C: Unbounded Query Detection', () => {
    it('detects missing LIMIT on ordered/multi-filter queries', () => {
      const input: DatabaseAnalyzerInput = {
        schemaSql: sampleSchema,
        queriesSql: [
          'SELECT id, status FROM tasks WHERE status = "pending" ORDER BY hourly_rate DESC;',
        ],
      };
      const findings = runUnboundedQueryRule(input);
      assert.strictEqual(findings.length, 1);
      assert.strictEqual(findings[0].metadata?.ruleId, 'missing-limit');
    });

    it('does not flag queries with an explicit LIMIT or primary key lookup', () => {
      const input: DatabaseAnalyzerInput = {
        schemaSql: sampleSchema,
        queriesSql: [
          'SELECT id FROM tasks LIMIT 10;',
          'SELECT * FROM tasks WHERE id = "tsk_101";',
          'SELECT COUNT(*) FROM tasks;',
        ],
      };
      const findings = runUnboundedQueryRule(input);
      assert.strictEqual(findings.length, 0);
    });
  });

  describe('Rule D: N+1 Query Pattern Detection', () => {
    it('detects N+1 query loop across parent/child tables', () => {
      const input: DatabaseAnalyzerInput = {
        schemaSql: sampleSchema,
        queriesSql: [
          "SELECT id, name FROM projects WHERE organization_id = 'org_999';",
          "SELECT * FROM tasks WHERE project_id = 'prj_001';",
          "SELECT * FROM ledger_entries WHERE task_id = 'tsk_501';",
        ],
      };
      const findings = runNPlusOneRule(input);
      assert.strictEqual(findings.length, 1);
      assert.ok(findings[0].title.includes('N+1 Query Pattern'));
    });

    it('does not flag independent unrelated queries as N+1 loops', () => {
      const input: DatabaseAnalyzerInput = {
        schemaSql: sampleSchema,
        queriesSql: [
          "SELECT id, email FROM users WHERE id = 'usr_001';",
          "SELECT id, status FROM tasks WHERE id = 'tsk_100';",
        ],
      };
      const findings = runNPlusOneRule(input);
      assert.strictEqual(findings.length, 0);
    });
  });

  describe('Rule E: Correlated Subquery Detection', () => {
    it('detects subqueries referencing outer table aliases', () => {
      const input: DatabaseAnalyzerInput = {
        schemaSql: sampleSchema,
        queriesSql: [
          'SELECT t.id, (SELECT SUM(l.amount) FROM ledger_entries l WHERE l.task_id = t.id) FROM tasks t;',
        ],
      };
      const findings = runCorrelatedSubqueryRule(input);
      assert.strictEqual(findings.length, 1);
      assert.strictEqual(findings[0].metadata?.ruleId, 'correlated-subquery');
    });

    it('does not flag non-correlated static subqueries', () => {
      const input: DatabaseAnalyzerInput = {
        schemaSql: sampleSchema,
        queriesSql: ['SELECT id FROM tasks WHERE status IN (SELECT status FROM status_lookup);'],
      };
      const findings = runCorrelatedSubqueryRule(input);
      assert.strictEqual(findings.length, 0);
    });
  });

  describe('Rule F: Duplicate Query Detection', () => {
    it('detects duplicate filter predicate logic across queries', () => {
      const input: DatabaseAnalyzerInput = {
        schemaSql: sampleSchema,
        queriesSql: [
          "SELECT id FROM tasks WHERE assigned_user_id = 'usr_101' AND status = 'pending';",
          "SELECT title, priority FROM tasks WHERE assigned_user_id = 'usr_101' AND status = 'pending';",
        ],
      };
      const findings = runDuplicateQueryRule(input);
      assert.strictEqual(findings.length, 1);
      assert.strictEqual(findings[0].metadata?.ruleId, 'duplicate-query');
    });

    it('does not flag distinct queries with different predicates', () => {
      const input: DatabaseAnalyzerInput = {
        schemaSql: sampleSchema,
        queriesSql: [
          "SELECT id FROM tasks WHERE status = 'pending';",
          "SELECT id FROM tasks WHERE status = 'completed';",
        ],
      };
      const findings = runDuplicateQueryRule(input);
      assert.strictEqual(findings.length, 0);
    });
  });

  describe('Rule G: Unnecessary DISTINCT Detection', () => {
    it('detects DISTINCT on primary key queries', () => {
      const schema = parseSchemaDdl(sampleSchema);
      const input: DatabaseAnalyzerInput = {
        schemaSql: sampleSchema,
        queriesSql: ['SELECT DISTINCT id, email FROM users;'],
      };
      const findings = runUnnecessaryDistinctRule(input, schema);
      assert.strictEqual(findings.length, 1);
      assert.strictEqual(findings[0].metadata?.ruleId, 'unnecessary-distinct');
    });

    it('does not flag DISTINCT on non-primary-key projections', () => {
      const schema = parseSchemaDdl(sampleSchema);
      const input: DatabaseAnalyzerInput = {
        schemaSql: sampleSchema,
        queriesSql: ['SELECT DISTINCT org_id FROM users;'],
      };
      const findings = runUnnecessaryDistinctRule(input, schema);
      assert.strictEqual(findings.length, 0);
    });
  });

  describe('Full Benchmark Execution against codeinsight-demo-repo Dataset', () => {
    it('executes runDatabaseRules against DEMO_DATABASE_INPUT and deterministically detects all planted issues', () => {
      const findings = runDatabaseRules(DEMO_DATABASE_INPUT, 'demo-session-db-001');

      assert.ok(findings.length >= 7);

      const ruleIds = new Set(findings.map((f) => f.metadata?.ruleId));
      assert.ok(ruleIds.has('select-star'));
      assert.ok(ruleIds.has('unindexed-order-by'));
      assert.ok(ruleIds.has('missing-limit'));
      assert.ok(ruleIds.has('correlated-subquery'));
      assert.ok(ruleIds.has('duplicate-query'));
      assert.ok(ruleIds.has('unnecessary-distinct'));

      // Verify specific evidence and structure
      const selectStarFindings = findings.filter((f) => f.metadata?.ruleId === 'select-star');
      assert.ok(selectStarFindings.length >= 2); // Query 2 and Query 5 (plus 3b/3c)

      const missingLimitFindings = findings.filter((f) => f.metadata?.ruleId === 'missing-limit');
      assert.ok(missingLimitFindings.some((f) => f.metadata?.queryIndex === 8)); // Query 7 (0-indexed: index 8)

      const unindexedOrderByCols = findings
        .filter((f) => f.metadata?.ruleId === 'unindexed-order-by')
        .map((f) => f.metadata?.column);
      assert.ok(unindexedOrderByCols.includes('hourly_rate'));

      const correlatedSubquery = findings.find((f) => f.metadata?.ruleId === 'correlated-subquery');
      assert.strictEqual(correlatedSubquery?.metadata?.queryIndex, 12); // Query 11 (0-indexed: index 12)

      const unnecessaryDistinct = findings.find(
        (f) => f.metadata?.ruleId === 'unnecessary-distinct'
      );
      assert.strictEqual(unnecessaryDistinct?.metadata?.queryIndex, 13); // Query 12 (0-indexed: index 13)
    });
  });
});
