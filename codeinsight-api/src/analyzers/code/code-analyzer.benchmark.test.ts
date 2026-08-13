import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { detectCircularDependencies } from './ast/cycle-detector.js';
import { buildModuleDependencyGraph } from './ast/graph-builder.js';
import { analyzeCodeSmells } from './ast/smell-engine.js';
import { calculateCodeTechDebtScore } from './ast/tech-debt-scorer.js';
import type { CodeAnalyzerCustomData } from '../../services/code-analysis.service.js';
import type { AnalyzerResult } from '@codeinsight/shared-contracts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getDemoRepoPath(): string {
  const candidates = [
    path.resolve(process.cwd(), 'codeinsight-demo-repo'),
    path.resolve(process.cwd(), '../codeinsight-demo-repo'),
    path.resolve(__dirname, '../../../../codeinsight-demo-repo'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, 'src'))) {
      return candidate;
    }
  }

  throw new Error(
    `codeinsight-demo-repo directory not found in candidates: ${candidates.join(', ')}`
  );
}

interface ExpectedFinding {
  name: string;
  category: 'architecture' | 'tech_debt';
  ruleId: string;
  fileSnippet: string;
  severity?: string;
}

/**
 * Ground-Truth Specification from docs/EXPECTED_FINDINGS.md (TypeScript Analyzer section)
 */
const EXPECTED_CODE_FINDINGS: ExpectedFinding[] = [
  {
    name: 'Circular dependency between TaskService, ReportGenerator, and LedgerService',
    category: 'architecture',
    ruleId: 'circular-dependency',
    fileSnippet: 'task.service',
    severity: 'high',
  },
  {
    name: 'Duplicate validation helper: isValidIdFormat',
    category: 'tech_debt',
    ruleId: 'duplicate-logic',
    fileSnippet: 'user.service',
    severity: 'medium',
  },
  {
    name: 'Unused utility: slugifyProjectName',
    category: 'tech_debt',
    ruleId: 'potentially-unused-export',
    fileSnippet: 'formatting.ts',
    severity: 'low',
  },
  {
    name: 'Stale TODO marker in ledger.repository.ts',
    category: 'tech_debt',
    ruleId: 'comment-debt',
    fileSnippet: 'ledger.repository',
    severity: 'low',
  },
];

describe('Code Analyzer Phase 5.9 — Benchmark Accuracy Checkpoint', () => {
  const repoPath = getDemoRepoPath();

  describe('1. Ground-Truth Matrix Verification against codeinsight-demo-repo', () => {
    it('detects 100% of planted Ground-Truth Code Analyzer issues from docs/EXPECTED_FINDINGS.md', async () => {
      const graph = await buildModuleDependencyGraph(repoPath);
      const cyclesResult = detectCircularDependencies(graph);
      const smellsResult = await analyzeCodeSmells(repoPath, graph);
      const techDebtScore = calculateCodeTechDebtScore(cyclesResult, smellsResult);

      const detectedFindingsList: string[] = [];

      // Check Circular Dependency Detection
      const hasTaskCycle = cyclesResult.cycles.some(
        (c) =>
          c.nodes.some((n) => n.includes('task.service')) &&
          c.nodes.some((n) => n.includes('report.generator')) &&
          c.nodes.some((n) => n.includes('ledger.service'))
      );

      if (hasTaskCycle) {
        detectedFindingsList.push(
          'Circular dependency between TaskService, ReportGenerator, and LedgerService'
        );
      }

      // Check Duplicate Logic (isValidIdFormat)
      const hasDuplicateLogic = smellsResult.observations.some(
        (o) =>
          o.ruleId === 'duplicate-logic' &&
          (o.file.includes('user.service') || o.file.includes('report.generator'))
      );
      if (hasDuplicateLogic) {
        detectedFindingsList.push('Duplicate validation helper: isValidIdFormat');
      }

      // Check Unused Export (slugifyProjectName in formatting.ts)
      const hasUnusedExport = smellsResult.observations.some(
        (o) => o.ruleId === 'potentially-unused-export' && o.file.includes('formatting.ts')
      );
      if (hasUnusedExport) {
        detectedFindingsList.push('Unused utility: slugifyProjectName');
      }

      // Check Comment Debt (Stale TODO in ledger.repository.ts)
      const hasCommentDebt = smellsResult.observations.some(
        (o) => o.ruleId === 'comment-debt' && o.file.includes('ledger.repository')
      );
      if (hasCommentDebt) {
        detectedFindingsList.push('Stale TODO marker in ledger.repository.ts');
      }

      const totalExpected = EXPECTED_CODE_FINDINGS.length;
      const totalDetected = detectedFindingsList.length;
      const accuracyRate = (totalDetected / totalExpected) * 100;

      console.log('----------------------------------------------------');
      console.log('CODE ANALYZER BENCHMARK ACCURACY REPORT:');
      console.log(
        `Ground-Truth Detection Rate: ${totalDetected}/${totalExpected} (${accuracyRate.toFixed(1)}%)`
      );
      console.log('Planted Issues Detected:', detectedFindingsList);
      console.log('Tech Debt Score:', techDebtScore.score, `(${techDebtScore.band})`);
      console.log('Total Cycles:', cyclesResult.totalCycles);
      console.log('Total Code Smells:', smellsResult.summary.totalObservations);
      console.log('----------------------------------------------------');

      assert.strictEqual(
        totalDetected,
        totalExpected,
        `Expected 100% detection rate (${totalExpected}/${totalExpected}), but detected ${totalDetected}`
      );
      assert.strictEqual(accuracyRate, 100);
    });
  });

  describe('2. Circular Dependency Precision & Canonical Representation', () => {
    it('verifies Tarjan SCC cycle length, node paths, and canonical rotation', async () => {
      const graph = await buildModuleDependencyGraph(repoPath);
      const cyclesResult = detectCircularDependencies(graph);

      assert.ok(cyclesResult.totalCycles >= 1, 'Must detect at least 1 circular dependency');

      const cycle = cyclesResult.cycles[0];
      assert.ok(cycle.length >= 3, 'Cycle length must be at least 3');
      assert.strictEqual(
        cycle.nodes.length,
        cycle.length + 1,
        'Closed loop nodes array includes returning start node'
      );

      // Verify canonical rotation: first node must be lexicographically smallest
      const sortedNodes = [...cycle.nodes].sort((a, b) => a.localeCompare(b));
      assert.strictEqual(
        cycle.nodes[0],
        sortedNodes[0],
        'Canonical cycle rotation must start at lexicographically smallest node'
      );

      // Verify external package imports (e.g. express, node:fs) are not treated as internal cycle nodes
      for (const node of cycle.nodes) {
        assert.ok(
          !node.startsWith('node:'),
          'External node modules must not be included in cycle paths'
        );
      }
    });
  });

  describe('3. Code Smell Heuristics Matrix Verification', () => {
    it('verifies duplicate logic rule detection', async () => {
      const graph = await buildModuleDependencyGraph(repoPath);
      const smellsResult = await analyzeCodeSmells(repoPath, graph);

      const duplicateObs = smellsResult.observations.filter((o) => o.ruleId === 'duplicate-logic');
      assert.ok(duplicateObs.length >= 1, 'Must detect at least 1 duplicate logic observation');
    });

    it('verifies potentially unused export rule detection', async () => {
      const graph = await buildModuleDependencyGraph(repoPath);
      const smellsResult = await analyzeCodeSmells(repoPath, graph);

      const unusedObs = smellsResult.observations.filter(
        (o) => o.ruleId === 'potentially-unused-export'
      );
      assert.ok(unusedObs.length >= 1, 'Must detect at least 1 unused export observation');
      assert.ok(
        unusedObs.some((o) => o.file.includes('formatting.ts')),
        'Must flag formatting.ts unused export'
      );
    });

    it('verifies comment debt rule detection', async () => {
      const graph = await buildModuleDependencyGraph(repoPath);
      const smellsResult = await analyzeCodeSmells(repoPath, graph);

      const commentObs = smellsResult.observations.filter((o) => o.ruleId === 'comment-debt');
      assert.ok(commentObs.length >= 1, 'Must detect at least 1 comment debt observation');
      assert.ok(
        commentObs.some((o) => o.file.includes('ledger.repository')),
        'Must flag ledger.repository.ts TODO marker'
      );
    });
  });

  describe('4. Tech-Debt Scoring Consistency & Explainability', () => {
    it('verifies tech debt score calculation and penalty caps against benchmark findings', async () => {
      const graph = await buildModuleDependencyGraph(repoPath);
      const cyclesResult = detectCircularDependencies(graph);
      const smellsResult = await analyzeCodeSmells(repoPath, graph);
      const techDebtScore = calculateCodeTechDebtScore(cyclesResult, smellsResult);

      assert.ok(
        techDebtScore.score >= 0 && techDebtScore.score <= 100,
        'Score must be bounded between 0 and 100'
      );
      assert.ok(
        techDebtScore.penalties.circularDependencies > 0,
        'Circular dependencies penalty must be > 0'
      );
      assert.ok(techDebtScore.penalties.total > 0, 'Total penalty must be > 0');
      assert.strictEqual(
        techDebtScore.score,
        Math.max(0, 100 - techDebtScore.penalties.total),
        'Score must equal 100 minus total penalties (floored at 0)'
      );
      assert.ok(['healthy', 'moderate', 'concerning', 'high-debt'].includes(techDebtScore.band));
    });
  });

  describe('5. Determinism & Input Order Invariance', () => {
    it('produces 100% identical cycle IDs, smell IDs, penalties, and score across 5 consecutive runs', async () => {
      const graph = await buildModuleDependencyGraph(repoPath);

      const run1 = {
        cycles: detectCircularDependencies(graph),
        smells: await analyzeCodeSmells(repoPath, graph),
      };
      const score1 = calculateCodeTechDebtScore(run1.cycles, run1.smells);

      for (let i = 0; i < 4; i++) {
        const runN = {
          cycles: detectCircularDependencies(graph),
          smells: await analyzeCodeSmells(repoPath, graph),
        };
        const scoreN = calculateCodeTechDebtScore(runN.cycles, runN.smells);

        assert.deepStrictEqual(
          runN.cycles,
          run1.cycles,
          `Run ${i + 2} cycles must be identical to Run 1`
        );
        assert.deepStrictEqual(
          runN.smells,
          run1.smells,
          `Run ${i + 2} smells must be identical to Run 1`
        );
        assert.deepStrictEqual(scoreN, score1, `Run ${i + 2} score must be identical to Run 1`);
      }
    });
  });

  describe('6. Contract & API Representation Smoke Check', () => {
    it('verifies benchmark output conforms strictly to AnalyzerResult<CodeAnalyzerCustomData> contract shape', async () => {
      const graph = await buildModuleDependencyGraph(repoPath);
      const cyclesResult = detectCircularDependencies(graph);
      const smellsResult = await analyzeCodeSmells(repoPath, graph);
      const techDebtScore = calculateCodeTechDebtScore(cyclesResult, smellsResult);

      const mockResult: AnalyzerResult<CodeAnalyzerCustomData> = {
        sessionId: 'session-benchmark-001',
        analyzerType: 'code',
        status: 'completed',
        findings: [],
        summary: {
          totalFindings: smellsResult.summary.totalObservations + cyclesResult.totalCycles,
          severityCounts: { low: 2, medium: 1, high: 1, critical: 0 },
          categoryCounts: {
            architecture: cyclesResult.totalCycles,
            tech_debt: smellsResult.summary.totalObservations,
            query_optimization: 0,
            anomaly: 0,
          },
        },
        metrics: {
          score: techDebtScore.score,
          performanceMs: 45,
          itemsAnalyzed: smellsResult.metrics.totalSourceFiles,
          rulesEvaluated: 5,
        },
        customData: {
          techDebtScore,
          totalCycles: cyclesResult.totalCycles,
          totalObservations: smellsResult.summary.totalObservations,
          summaryOverview: 'Benchmark validation completed successfully.',
        },
      };

      assert.strictEqual(mockResult.analyzerType, 'code');
      assert.strictEqual(mockResult.status, 'completed');
      assert.strictEqual(mockResult.metrics.score, techDebtScore.score);
    });
  });
});
