import type {
  CodeSmellAnalysisResult,
  CodeTechDebtBand,
  CodeTechDebtCounts,
  CodeTechDebtPenalties,
  CodeTechDebtScore,
  CycleDetectionResult,
} from './types.js';

export const COMPONENT_CAPS = {
  circularDependencies: 30,
  longFunctions: 20,
  duplicateLogic: 20,
  potentiallyUnusedExports: 10,
  commentDebt: 10,
  testFileRatio: 5,
};

/**
 * Maps an integer score (0–100) to its deterministic score band
 */
export function getScoreBand(score: number): CodeTechDebtBand {
  if (score >= 90) return 'healthy';
  if (score >= 75) return 'moderate';
  if (score >= 50) return 'concerning';
  return 'high-debt';
}

/**
 * Pure, deterministic tech-debt scoring function.
 * Aggregates circular dependencies (Phase 5.3) and code smell observations (Phase 5.4)
 * into a bounded, explainable score (0–100) with detailed component penalties and raw counts.
 */
export function calculateCodeTechDebtScore(
  cyclesResult: CycleDetectionResult,
  smellsResult: CodeSmellAnalysisResult
): CodeTechDebtScore {
  const prodFiles = smellsResult?.metrics?.totalSourceFiles || 0;
  const testFiles = smellsResult?.metrics?.totalTestFiles || 0;
  const testFileRatio = smellsResult?.metrics?.testFileRatio ?? 1.0;

  // Handle empty repository
  if (prodFiles === 0) {
    return {
      score: 100,
      band: 'healthy',
      isEmptyRepository: true,
      counts: {
        circularDependencies: 0,
        longFunctions: 0,
        highSeverityLongFunctions: 0,
        duplicateLogic: 0,
        potentiallyUnusedExports: 0,
        todoMarkers: 0,
        fixmeMarkers: 0,
        hackMarkers: 0,
        xxxMarkers: 0,
        productionFiles: 0,
        testFiles: 0,
      },
      penalties: {
        circularDependencies: 0,
        longFunctions: 0,
        duplicateLogic: 0,
        potentiallyUnusedExports: 0,
        commentDebt: 0,
        testFileRatio: 0,
        total: 0,
      },
      testFileRatio: 1.0,
    };
  }

  // Extract raw findings
  const obs = smellsResult?.observations || [];
  const cycles = cyclesResult?.cycles || [];

  const longFuncObs = obs.filter((o) => o.ruleId === 'long-function');
  const highSeverityLongFuncCount = longFuncObs.filter((o) => o.severity === 'high').length;
  const mediumSeverityLongFuncCount = longFuncObs.length - highSeverityLongFuncCount;

  const dupLogicCount = obs.filter((o) => o.ruleId === 'duplicate-logic').length;
  const unusedExportCount = obs.filter((o) => o.ruleId === 'potentially-unused-export').length;

  const commentDebtObs = obs.filter((o) => o.ruleId === 'comment-debt');
  let todoCount = 0;
  let fixmeCount = 0;
  let hackCount = 0;
  let xxxCount = 0;

  for (const c of commentDebtObs) {
    const marker = (c.metadata?.marker as string)?.toUpperCase();
    if (marker === 'TODO') todoCount++;
    else if (marker === 'FIXME') fixmeCount++;
    else if (marker === 'HACK') hackCount++;
    else if (marker === 'XXX') xxxCount++;
    else todoCount++;
  }

  // Calculate component penalties
  const uncappedCyclesPen = cycles.length * 5;
  const uncappedLongFuncPen = mediumSeverityLongFuncCount * 1 + highSeverityLongFuncCount * 2;
  const uncappedDupLogicPen = dupLogicCount * 2;
  const uncappedUnusedExportsPen = unusedExportCount * 1;
  const uncappedCommentDebtPen = (todoCount + xxxCount) * 0.5 + (fixmeCount + hackCount) * 1.0;
  const uncappedTestRatioPen = testFileRatio < 0.2 ? 5 : 0;

  // Apply component caps
  const cyclesPen = Math.min(COMPONENT_CAPS.circularDependencies, uncappedCyclesPen);
  const longFuncPen = Math.min(COMPONENT_CAPS.longFunctions, uncappedLongFuncPen);
  const dupLogicPen = Math.min(COMPONENT_CAPS.duplicateLogic, uncappedDupLogicPen);
  const unusedExportsPen = Math.min(
    COMPONENT_CAPS.potentiallyUnusedExports,
    uncappedUnusedExportsPen
  );
  const commentDebtPen = Math.min(COMPONENT_CAPS.commentDebt, uncappedCommentDebtPen);
  const testRatioPen = Math.min(COMPONENT_CAPS.testFileRatio, uncappedTestRatioPen);

  // Calculate total penalty (capped at 100) and round to nearest integer
  const rawTotalPenalty =
    cyclesPen + longFuncPen + dupLogicPen + unusedExportsPen + commentDebtPen + testRatioPen;
  const totalPenalty = Math.min(100, Math.round(rawTotalPenalty));

  const score = Math.max(0, 100 - totalPenalty);
  const band = getScoreBand(score);

  const counts: CodeTechDebtCounts = {
    circularDependencies: cycles.length,
    longFunctions: longFuncObs.length,
    highSeverityLongFunctions: highSeverityLongFuncCount,
    duplicateLogic: dupLogicCount,
    potentiallyUnusedExports: unusedExportCount,
    todoMarkers: todoCount,
    fixmeMarkers: fixmeCount,
    hackMarkers: hackCount,
    xxxMarkers: xxxCount,
    productionFiles: prodFiles,
    testFiles,
  };

  const penalties: CodeTechDebtPenalties = {
    circularDependencies: cyclesPen,
    longFunctions: longFuncPen,
    duplicateLogic: dupLogicPen,
    potentiallyUnusedExports: unusedExportsPen,
    commentDebt: commentDebtPen,
    testFileRatio: testRatioPen,
    total: totalPenalty,
  };

  return {
    score,
    band,
    isEmptyRepository: false,
    counts,
    penalties,
    testFileRatio,
  };
}
