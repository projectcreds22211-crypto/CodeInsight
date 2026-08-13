import assert from 'node:assert';
import { describe, it } from 'node:test';
import { DatabaseAnalyzer, databaseAnalyzer } from './database-analyzer.js';
import { DEMO_DATABASE_INPUT } from './fixtures/demo-database-fixture.js';
import type { DatabaseFindingMetadata } from './types.js';
import {
  extractAstCorrelatedSubqueries,
  extractAstOrderByColumns,
  extractAstTables,
  hasAstDistinctKeyword,
  hasAstLimitClause,
  hasSelectStarProjections,
  parseSqlToAst,
} from './sql-parser.js';

describe('Database Analyzer Phase 3.3 — AST Parser & AnalyzerResult Integration', () => {
  describe('SQL Parser Boundary (parseSqlToAst)', () => {
    it('1. parses valid PostgreSQL query cleanly', () => {
      const res = parseSqlToAst('SELECT id, name FROM users WHERE id = $1;');
      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(res.ast.type, 'select');
        assert.deepStrictEqual(extractAstTables(res.ast), ['users']);
      }
    });

    it('2. handles malformed SQL gracefully without throwing exceptions', () => {
      const res = parseSqlToAst('SELECT FROM WHERE invalid sql syntax %$&^;');
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.ok(res.error.includes('SQL Parse Error'));
      }
    });

    it('3. handles empty query gracefully', () => {
      const res = parseSqlToAst('   ');
      assert.strictEqual(res.success, false);
      if (!res.success) {
        assert.strictEqual(res.error, 'Empty SQL query string');
      }
    });

    it('4. handles subqueries correctly', () => {
      const res = parseSqlToAst(
        'SELECT t.id, (SELECT SUM(l.amount) FROM ledger_entries l WHERE l.task_id = t.id) FROM tasks t;'
      );
      assert.strictEqual(res.success, true);
      if (res.success) {
        const correlated = extractAstCorrelatedSubqueries(res.ast);
        assert.strictEqual(correlated.length, 1);
        assert.strictEqual(correlated[0].outerAlias, 't');
      }
    });

    it('5. detects SELECT DISTINCT via AST inspection', () => {
      const res = parseSqlToAst('SELECT DISTINCT id, title FROM tasks;');
      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(hasAstDistinctKeyword(res.ast), true);
      }
    });

    it('6. detects SELECT * via AST inspection', () => {
      const res = parseSqlToAst('SELECT * FROM tasks;');
      assert.strictEqual(res.success, true);
      if (res.success) {
        assert.strictEqual(hasSelectStarProjections(res.ast), true);
      }
    });

    it('7. extracts ORDER BY columns via AST inspection', () => {
      const res = parseSqlToAst('SELECT id, title FROM tasks ORDER BY hourly_rate DESC;');
      assert.strictEqual(res.success, true);
      if (res.success) {
        const orderCols = extractAstOrderByColumns(res.ast);
        assert.deepStrictEqual(orderCols, ['hourly_rate']);
      }
    });

    it('8. detects LIMIT clause presence via AST inspection', () => {
      const resWithLimit = parseSqlToAst('SELECT id FROM tasks LIMIT 10;');
      assert.strictEqual(resWithLimit.success, true);
      if (resWithLimit.success) {
        assert.strictEqual(hasAstLimitClause(resWithLimit.ast), true);
      }

      const resNoLimit = parseSqlToAst('SELECT id FROM tasks;');
      assert.strictEqual(resNoLimit.success, true);
      if (resNoLimit.success) {
        assert.strictEqual(hasAstLimitClause(resNoLimit.ast), false);
      }
    });
  });

  describe('DatabaseAnalyzer Service & AnalyzerResult Contract', () => {
    it('validates input payload cleanly', () => {
      const invalidRes = databaseAnalyzer.validateInput(null as any);
      assert.strictEqual(invalidRes.success, false);

      const validRes = databaseAnalyzer.validateInput(DEMO_DATABASE_INPUT);
      assert.strictEqual(validRes.success, true);
    });

    it('returns typed AnalyzerResult structure on analyze execution', async () => {
      const result = await databaseAnalyzer.analyze(DEMO_DATABASE_INPUT, {
        sessionId: 'test-session-3-3',
      });

      assert.strictEqual(result.sessionId, 'test-session-3-3');
      assert.strictEqual(result.analyzerType, 'database');
      assert.strictEqual(result.status, 'completed');
      assert.ok(Array.isArray(result.findings));
      assert.ok(result.summary);
      assert.strictEqual(result.summary.totalFindings, result.findings.length);
      assert.ok(result.metrics);
      assert.strictEqual(result.metrics.itemsAnalyzed, DEMO_DATABASE_INPUT.queriesSql.length);
      assert.strictEqual(result.metrics.rulesEvaluated, 7);
      assert.ok(typeof result.metrics.score === 'number');
    });

    it('handles validation failure gracefully returning failed AnalyzerResult', async () => {
      const result = await databaseAnalyzer.analyze({ schemaSql: '', queriesSql: [] });
      assert.strictEqual(result.status, 'failed');
      assert.strictEqual(result.findings.length, 0);
      assert.strictEqual(result.summary.totalFindings, 0);
    });
  });

  describe('Benchmark Determinism & Regression Testing', () => {
    it('produces 100% deterministic output across repeated executions', async () => {
      const res1 = await databaseAnalyzer.analyze(DEMO_DATABASE_INPUT, { sessionId: 's1' });
      const res2 = await databaseAnalyzer.analyze(DEMO_DATABASE_INPUT, { sessionId: 's1' });

      assert.strictEqual(res1.findings.length, res2.findings.length);
      assert.strictEqual(res1.summary.totalFindings, res2.summary.totalFindings);
      assert.strictEqual(res1.metrics.score, res2.metrics.score);

      const ids1 = res1.findings.map((f) => f.id);
      const ids2 = res2.findings.map((f) => f.id);
      assert.deepStrictEqual(ids1, ids2);
    });

    it('verifies 100% ground-truth alignment against docs/EXPECTED_FINDINGS.md', async () => {
      const result = await databaseAnalyzer.analyze(DEMO_DATABASE_INPUT, {
        sessionId: 'bench-3-7',
      });
      assert.strictEqual(result.status, 'completed');
      assert.ok(result.findings.length >= 7);

      const ruleIds = result.findings.map((f) => (f.metadata as DatabaseFindingMetadata)?.ruleId);

      // 1. SELECT * detection (Query 2 & Query 5)
      assert.ok(ruleIds.includes('select-star'));
      const selectStarFindings = result.findings.filter(
        (f) => (f.metadata as DatabaseFindingMetadata)?.ruleId === 'select-star'
      );
      assert.ok(selectStarFindings.length >= 2);

      // 2. Missing index detection (Query 8 - hourly_rate)
      assert.ok(ruleIds.includes('unindexed-order-by'));
      const missingIndexFindings = result.findings.filter(
        (f) => (f.metadata as DatabaseFindingMetadata)?.ruleId === 'unindexed-order-by'
      );
      assert.ok(
        missingIndexFindings.some(
          (f) => (f.metadata as DatabaseFindingMetadata)?.column === 'hourly_rate'
        )
      );

      // 3. Unbounded query detection (Query 7 - missing LIMIT)
      assert.ok(ruleIds.includes('missing-limit'));

      // 4. Correlated subquery detection (Query 11)
      assert.ok(ruleIds.includes('correlated-subquery'));

      // 5. Duplicate query detection (Query 6, 9, 10)
      assert.ok(ruleIds.includes('duplicate-query'));

      // 6. Unnecessary DISTINCT detection (Query 12)
      assert.ok(ruleIds.includes('unnecessary-distinct'));
    });
  });
});
