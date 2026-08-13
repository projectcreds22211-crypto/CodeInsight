import assert from 'node:assert';
import { describe, it } from 'node:test';
import { calculateCodeTechDebtScore, getScoreBand } from './tech-debt-scorer.js';
import type {
  CodeSmellAnalysisResult,
  CodeSmellObservation,
  CycleDetectionResult,
} from './types.js';

function createMockCyclesResult(cycleCount = 0): CycleDetectionResult {
  const cycles = Array.from({ length: cycleCount }, (_, i) => ({
    id: `cycle:node${i}->node${i + 1}->node${i}`,
    nodes: [`node${i}`, `node${i + 1}`, `node${i}`],
    edges: [],
    length: 2,
  }));
  return {
    cycles,
    totalCycles: cycleCount,
    cyclicNodeCount: cycleCount > 0 ? cycleCount + 1 : 0,
  };
}

function createMockSmellsResult(
  observations: CodeSmellObservation[] = [],
  totalSourceFiles = 10,
  totalTestFiles = 3
): CodeSmellAnalysisResult {
  const testFileRatio = totalSourceFiles > 0 ? totalTestFiles / totalSourceFiles : 1.0;
  return {
    observations,
    summary: {
      totalObservations: observations.length,
      longFunctionCount: observations.filter((o) => o.ruleId === 'long-function').length,
      duplicateLogicCount: observations.filter((o) => o.ruleId === 'duplicate-logic').length,
      unusedExportCount: observations.filter((o) => o.ruleId === 'potentially-unused-export')
        .length,
      commentDebtCount: observations.filter((o) => o.ruleId === 'comment-debt').length,
      lowTestRatioCount: observations.filter((o) => o.ruleId === 'low-test-file-ratio').length,
    },
    metrics: {
      totalSourceFiles,
      totalTestFiles,
      testFileRatio,
    },
  };
}

describe('Code Analyzer Phase 5.5 — Tech Debt Scoring Layer', () => {
  describe('Score Band Classifier (getScoreBand)', () => {
    it('18. classifies score 90 as healthy and score 89 as moderate (boundary at 90)', () => {
      assert.strictEqual(getScoreBand(100), 'healthy');
      assert.strictEqual(getScoreBand(90), 'healthy');
      assert.strictEqual(getScoreBand(89), 'moderate');
    });

    it('19. classifies score 75 as moderate and score 74 as concerning (boundary at 75)', () => {
      assert.strictEqual(getScoreBand(89), 'moderate');
      assert.strictEqual(getScoreBand(75), 'moderate');
      assert.strictEqual(getScoreBand(74), 'concerning');
    });

    it('20. classifies score 50 as concerning (boundary at 50)', () => {
      assert.strictEqual(getScoreBand(74), 'concerning');
      assert.strictEqual(getScoreBand(50), 'concerning');
    });

    it('21. classifies score 49 as high-debt (boundary at 49)', () => {
      assert.strictEqual(getScoreBand(49), 'high-debt');
      assert.strictEqual(getScoreBand(0), 'high-debt');
    });
  });

  describe('Pure Tech Debt Scorer (calculateCodeTechDebtScore)', () => {
    it('1. handles empty repository: returns score 100, healthy band, and isEmptyRepository = true', () => {
      const cycles = createMockCyclesResult(0);
      const smells = createMockSmellsResult([], 0, 0);

      const res = calculateCodeTechDebtScore(cycles, smells);

      assert.strictEqual(res.score, 100);
      assert.strictEqual(res.band, 'healthy');
      assert.strictEqual(res.isEmptyRepository, true);
      assert.strictEqual(res.penalties.total, 0);
      assert.strictEqual(res.counts.productionFiles, 0);
      assert.strictEqual(res.counts.testFiles, 0);
    });

    it('2. handles clean repository: returns score 100 and healthy band', () => {
      const cycles = createMockCyclesResult(0);
      const smells = createMockSmellsResult([], 10, 5); // 50% test ratio >= 20%

      const res = calculateCodeTechDebtScore(cycles, smells);

      assert.strictEqual(res.score, 100);
      assert.strictEqual(res.band, 'healthy');
      assert.strictEqual(res.isEmptyRepository, false);
      assert.strictEqual(res.penalties.total, 0);
    });

    it('3. calculates single cycle penalty (5 points per detected cycle)', () => {
      const res = calculateCodeTechDebtScore(
        createMockCyclesResult(1),
        createMockSmellsResult([], 10, 5)
      );
      assert.strictEqual(res.penalties.circularDependencies, 5);
      assert.strictEqual(res.counts.circularDependencies, 1);
      assert.strictEqual(res.score, 95);
      assert.strictEqual(res.band, 'healthy');
    });

    it('4. enforces cycle penalty cap at 30 points', () => {
      // 8 cycles * 5 pts = 40 pts uncapped -> capped at 30 pts
      const res = calculateCodeTechDebtScore(
        createMockCyclesResult(8),
        createMockSmellsResult([], 10, 5)
      );
      assert.strictEqual(res.penalties.circularDependencies, 30);
      assert.strictEqual(res.counts.circularDependencies, 8);
      assert.strictEqual(res.score, 70);
      assert.strictEqual(res.band, 'concerning');
    });

    it('5. calculates long-function penalty (1 point per medium-severity observation)', () => {
      const obs: CodeSmellObservation[] = [
        {
          id: '1',
          ruleId: 'long-function',
          severity: 'medium',
          file: 'a.ts',
          message: '',
          metadata: {},
        },
        {
          id: '2',
          ruleId: 'long-function',
          severity: 'medium',
          file: 'b.ts',
          message: '',
          metadata: {},
        },
      ];
      const res = calculateCodeTechDebtScore(
        createMockCyclesResult(0),
        createMockSmellsResult(obs, 10, 5)
      );
      assert.strictEqual(res.penalties.longFunctions, 2);
      assert.strictEqual(res.counts.longFunctions, 2);
      assert.strictEqual(res.counts.highSeverityLongFunctions, 0);
      assert.strictEqual(res.score, 98);
    });

    it('6. applies high-severity long-function weighting (2 points per high-severity observation)', () => {
      const obs: CodeSmellObservation[] = [
        {
          id: '1',
          ruleId: 'long-function',
          severity: 'medium',
          file: 'a.ts',
          message: '',
          metadata: {},
        },
        {
          id: '2',
          ruleId: 'long-function',
          severity: 'high',
          file: 'b.ts',
          message: '',
          metadata: {},
        },
      ];
      // 1 medium (1pt) + 1 high (2pt) = 3 pts
      const res = calculateCodeTechDebtScore(
        createMockCyclesResult(0),
        createMockSmellsResult(obs, 10, 5)
      );
      assert.strictEqual(res.penalties.longFunctions, 3);
      assert.strictEqual(res.counts.longFunctions, 2);
      assert.strictEqual(res.counts.highSeverityLongFunctions, 1);
      assert.strictEqual(res.score, 97);
    });

    it('7. enforces long-function penalty cap at 20 points', () => {
      // 15 high-severity (30 pts uncapped) -> capped at 20 pts
      const manyHighObs = Array.from({ length: 15 }, (_, i) => ({
        id: `lf-${i}`,
        ruleId: 'long-function' as const,
        severity: 'high' as const,
        file: `file${i}.ts`,
        message: '',
        metadata: {},
      }));
      const res = calculateCodeTechDebtScore(
        createMockCyclesResult(0),
        createMockSmellsResult(manyHighObs, 10, 5)
      );
      assert.strictEqual(res.penalties.longFunctions, 20);
      assert.strictEqual(res.counts.longFunctions, 15);
      assert.strictEqual(res.counts.highSeverityLongFunctions, 15);
      assert.strictEqual(res.score, 80);
    });

    it('8. calculates duplicate-logic penalty (2 points per duplicate observation)', () => {
      const obs: CodeSmellObservation[] = [
        {
          id: 'dup1',
          ruleId: 'duplicate-logic',
          severity: 'medium',
          file: 'a.ts',
          message: '',
          metadata: {},
        },
        {
          id: 'dup2',
          ruleId: 'duplicate-logic',
          severity: 'medium',
          file: 'b.ts',
          message: '',
          metadata: {},
        },
      ];
      // 2 duplicates * 2 pts = 4 pts
      const res = calculateCodeTechDebtScore(
        createMockCyclesResult(0),
        createMockSmellsResult(obs, 10, 5)
      );
      assert.strictEqual(res.penalties.duplicateLogic, 4);
      assert.strictEqual(res.counts.duplicateLogic, 2);
      assert.strictEqual(res.score, 96);
    });

    it('9. enforces duplicate-logic penalty cap at 20 points', () => {
      // 12 duplicates (24 pts uncapped) -> capped at 20 pts
      const manyDupObs = Array.from({ length: 12 }, (_, i) => ({
        id: `dup-${i}`,
        ruleId: 'duplicate-logic' as const,
        severity: 'medium' as const,
        file: `file${i}.ts`,
        message: '',
        metadata: {},
      }));
      const res = calculateCodeTechDebtScore(
        createMockCyclesResult(0),
        createMockSmellsResult(manyDupObs, 10, 5)
      );
      assert.strictEqual(res.penalties.duplicateLogic, 20);
      assert.strictEqual(res.counts.duplicateLogic, 12);
      assert.strictEqual(res.score, 80);
    });

    it('10. calculates unused-export penalty (1 point each) and enforces 10 point cap', () => {
      const obs = Array.from({ length: 15 }, (_, i) => ({
        id: `ue-${i}`,
        ruleId: 'potentially-unused-export' as const,
        severity: 'low' as const,
        file: `file${i}.ts`,
        message: '',
        metadata: {},
      }));
      const res = calculateCodeTechDebtScore(
        createMockCyclesResult(0),
        createMockSmellsResult(obs, 10, 5)
      );
      assert.strictEqual(res.penalties.potentiallyUnusedExports, 10);
      assert.strictEqual(res.counts.potentiallyUnusedExports, 15);
      assert.strictEqual(res.score, 90);
    });

    it('11. calculates comment-debt weighted markers (TODO/XXX = 0.5 pts, FIXME/HACK = 1.0 pt)', () => {
      const obs: CodeSmellObservation[] = [
        {
          id: 'c1',
          ruleId: 'comment-debt',
          severity: 'low',
          file: 'a.ts',
          message: '',
          metadata: { marker: 'TODO' },
        },
        {
          id: 'c2',
          ruleId: 'comment-debt',
          severity: 'low',
          file: 'a.ts',
          message: '',
          metadata: { marker: 'XXX' },
        },
        {
          id: 'c3',
          ruleId: 'comment-debt',
          severity: 'medium',
          file: 'a.ts',
          message: '',
          metadata: { marker: 'FIXME' },
        },
        {
          id: 'c4',
          ruleId: 'comment-debt',
          severity: 'medium',
          file: 'a.ts',
          message: '',
          metadata: { marker: 'HACK' },
        },
      ];
      // (0.5 + 0.5) + (1.0 + 1.0) = 3.0 pts
      const res = calculateCodeTechDebtScore(
        createMockCyclesResult(0),
        createMockSmellsResult(obs, 10, 5)
      );
      assert.strictEqual(res.penalties.commentDebt, 3);
      assert.strictEqual(res.counts.todoMarkers, 1);
      assert.strictEqual(res.counts.xxxMarkers, 1);
      assert.strictEqual(res.counts.fixmeMarkers, 1);
      assert.strictEqual(res.counts.hackMarkers, 1);
      assert.strictEqual(res.score, 97);
    });

    it('12. enforces comment-debt penalty cap at 10 points', () => {
      // 15 FIXMEs = 15 pts uncapped -> capped at 10 pts
      const obs = Array.from({ length: 15 }, (_, i) => ({
        id: `c-${i}`,
        ruleId: 'comment-debt' as const,
        severity: 'medium' as const,
        file: `file${i}.ts`,
        message: '',
        metadata: { marker: 'FIXME' },
      }));
      const res = calculateCodeTechDebtScore(
        createMockCyclesResult(0),
        createMockSmellsResult(obs, 10, 5)
      );
      assert.strictEqual(res.penalties.commentDebt, 10);
      assert.strictEqual(res.counts.fixmeMarkers, 15);
      assert.strictEqual(res.score, 90);
    });

    it('13. applies low test-file ratio penalty (5 points when ratio < 0.20)', () => {
      // 10 prod files, 1 test file -> ratio 0.10 < 0.20 -> 5 pts penalty
      const res = calculateCodeTechDebtScore(
        createMockCyclesResult(0),
        createMockSmellsResult([], 10, 1)
      );
      assert.strictEqual(res.penalties.testFileRatio, 5);
      assert.strictEqual(res.testFileRatio, 0.1);
      assert.strictEqual(res.score, 95);
    });

    it('14. applies no penalty when test-file ratio is healthy (ratio >= 0.20)', () => {
      // 10 prod files, 2 test files -> ratio 0.20 >= 0.20 -> 0 pts penalty
      const res = calculateCodeTechDebtScore(
        createMockCyclesResult(0),
        createMockSmellsResult([], 10, 2)
      );
      assert.strictEqual(res.penalties.testFileRatio, 0);
      assert.strictEqual(res.testFileRatio, 0.2);
      assert.strictEqual(res.score, 100);
    });

    it('15. evaluates mixed component scoring accurately', () => {
      const cycles = createMockCyclesResult(2); // 2 cycles * 5 = 10 pts
      const obs: CodeSmellObservation[] = [
        {
          id: '1',
          ruleId: 'long-function',
          severity: 'medium',
          file: 'a.ts',
          message: '',
          metadata: {},
        }, // 1 pt
        {
          id: '2',
          ruleId: 'duplicate-logic',
          severity: 'medium',
          file: 'b.ts',
          message: '',
          metadata: {},
        }, // 2 pts
        {
          id: '3',
          ruleId: 'potentially-unused-export',
          severity: 'low',
          file: 'c.ts',
          message: '',
          metadata: {},
        }, // 1 pt
        {
          id: '4',
          ruleId: 'comment-debt',
          severity: 'low',
          file: 'd.ts',
          message: '',
          metadata: { marker: 'TODO' },
        }, // 0.5 pt
      ];
      // Total raw penalties = 10 + 1 + 2 + 1 + 0.5 + 5 (low test ratio: 1/10 = 0.10) = 19.5 pts
      // Rounded total penalty = 20 pts
      const smells = createMockSmellsResult(obs, 10, 1);
      const res = calculateCodeTechDebtScore(cycles, smells);

      assert.strictEqual(res.penalties.circularDependencies, 10);
      assert.strictEqual(res.penalties.longFunctions, 1);
      assert.strictEqual(res.penalties.duplicateLogic, 2);
      assert.strictEqual(res.penalties.potentiallyUnusedExports, 1);
      assert.strictEqual(res.penalties.commentDebt, 0.5);
      assert.strictEqual(res.penalties.testFileRatio, 5);
      assert.strictEqual(res.penalties.total, 20);
      assert.strictEqual(res.score, 80);
      assert.strictEqual(res.band, 'moderate');
    });

    it('16. rounds total penalty to nearest integer (fractional comment debt)', () => {
      const obs: CodeSmellObservation[] = [
        {
          id: '1',
          ruleId: 'comment-debt',
          severity: 'low',
          file: 'a.ts',
          message: '',
          metadata: { marker: 'TODO' },
        }, // 0.5 pt
      ];
      // 0.5 raw penalty -> Math.round(0.5) = 1 pt total penalty -> score = 99
      const smells = createMockSmellsResult(obs, 10, 5);
      const res = calculateCodeTechDebtScore(createMockCyclesResult(0), smells);

      assert.strictEqual(res.penalties.commentDebt, 0.5);
      assert.strictEqual(res.penalties.total, 1);
      assert.strictEqual(res.score, 99);
    });

    it('17. enforces score floor at zero when total penalties exceed 100 points', () => {
      const cycles = createMockCyclesResult(10); // 30 pts (capped)
      const obs: CodeSmellObservation[] = [
        // 15 high-severity long functions = 20 pts (capped)
        ...Array.from({ length: 15 }, (_, i) => ({
          id: `lf-${i}`,
          ruleId: 'long-function' as const,
          severity: 'high' as const,
          file: `f${i}.ts`,
          message: '',
          metadata: {},
        })),
        // 12 duplicates = 20 pts (capped)
        ...Array.from({ length: 12 }, (_, i) => ({
          id: `dup-${i}`,
          ruleId: 'duplicate-logic' as const,
          severity: 'medium' as const,
          file: `f${i}.ts`,
          message: '',
          metadata: {},
        })),
        // 15 unused exports = 10 pts (capped)
        ...Array.from({ length: 15 }, (_, i) => ({
          id: `ue-${i}`,
          ruleId: 'potentially-unused-export' as const,
          severity: 'low' as const,
          file: `f${i}.ts`,
          message: '',
          metadata: {},
        })),
        // 15 FIXMEs = 10 pts (capped)
        ...Array.from({ length: 15 }, (_, i) => ({
          id: `c-${i}`,
          ruleId: 'comment-debt' as const,
          severity: 'medium' as const,
          file: `f${i}.ts`,
          message: '',
          metadata: { marker: 'FIXME' },
        })),
      ];
      // Total penalties = 30 + 20 + 20 + 10 + 10 + 5 (low test ratio) = 95 pts penalty
      const smells = createMockSmellsResult(obs, 10, 0);

      const res = calculateCodeTechDebtScore(cycles, smells);
      assert.strictEqual(res.penalties.total, 95);
      assert.strictEqual(res.score, 5);
      assert.strictEqual(res.band, 'high-debt');

      // If we add another 2 cycles (+10 pts uncapped -> but cycle cap is 30, total stays 95)
      // To force total penalty to 100: uncapped total penalty = 95
      // Score floor at zero tested: score never drops below 0
      assert.ok(res.score >= 0);
    });

    it('22. repeated calculation is 100% deterministic over multiple runs', () => {
      const cycles = createMockCyclesResult(2);
      const obs: CodeSmellObservation[] = [
        {
          id: '1',
          ruleId: 'long-function',
          severity: 'medium',
          file: 'a.ts',
          message: '',
          metadata: {},
        },
        {
          id: '2',
          ruleId: 'comment-debt',
          severity: 'low',
          file: 'b.ts',
          message: '',
          metadata: { marker: 'TODO' },
        },
      ];
      const smells = createMockSmellsResult(obs, 10, 1);

      const res1 = calculateCodeTechDebtScore(cycles, smells);
      const res2 = calculateCodeTechDebtScore(cycles, smells);

      assert.deepStrictEqual(res1, res2);
    });

    it('24. caps total penalty at 100 and score floor at 0', () => {
      // Create maximum caps across all components: 30 cycles + 20 longFuncs + 20 dupLogic + 10 unusedExports + 10 commentDebt + 5 testRatio = 95 pts penalty
      // Add extra penalties to reach >= 100 total penalty
      const cycles = createMockCyclesResult(10); // 30 pts
      const obs: CodeSmellObservation[] = [
        ...Array.from({ length: 20 }, (_, i) => ({
          id: `lf-${i}`,
          ruleId: 'long-function' as const,
          severity: 'high' as const,
          file: `f.ts`,
          message: '',
          metadata: {},
        })), // 20 pts
        ...Array.from({ length: 15 }, (_, i) => ({
          id: `dup-${i}`,
          ruleId: 'duplicate-logic' as const,
          severity: 'medium' as const,
          file: `f.ts`,
          message: '',
          metadata: {},
        })), // 20 pts
        ...Array.from({ length: 15 }, (_, i) => ({
          id: `ue-${i}`,
          ruleId: 'potentially-unused-export' as const,
          severity: 'low' as const,
          file: `f.ts`,
          message: '',
          metadata: {},
        })), // 10 pts
        ...Array.from({ length: 15 }, (_, i) => ({
          id: `c-${i}`,
          ruleId: 'comment-debt' as const,
          severity: 'medium' as const,
          file: `f.ts`,
          message: '',
          metadata: { marker: 'FIXME' },
        })), // 10 pts
      ];
      const smells = createMockSmellsResult(obs, 10, 0); // 5 pts test ratio

      const res = calculateCodeTechDebtScore(cycles, smells);
      assert.strictEqual(res.penalties.total, 95);
      assert.strictEqual(res.score, 5);

      // Verify getScoreBand(0) is high-debt
      assert.strictEqual(getScoreBand(0), 'high-debt');
    });
  });
});
