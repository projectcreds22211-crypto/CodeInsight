import assert from 'node:assert';
import fs from 'node:fs';
import { describe, it } from 'node:test';
import { withClonedRepository } from './repository/repository-cloner.js';
import { buildModuleDependencyGraph } from './ast/graph-builder.js';
import { detectCircularDependencies } from './ast/cycle-detector.js';
import { analyzeCodeSmells } from './ast/smell-engine.js';
import { calculateCodeTechDebtScore, COMPONENT_CAPS } from './ast/tech-debt-scorer.js';

interface ExternalRepoConfig {
  name: string;
  url: string;
  primaryLanguage: 'JavaScript' | 'TypeScript';
}

const EXTERNAL_REPOSITORIES: ExternalRepoConfig[] = [
  {
    name: 'expressjs/cors',
    url: 'https://github.com/expressjs/cors.git',
    primaryLanguage: 'JavaScript',
  },
  {
    name: 'sindresorhus/is',
    url: 'https://github.com/sindresorhus/is.git',
    primaryLanguage: 'TypeScript',
  },
  {
    name: 'chalk/chalk',
    url: 'https://github.com/chalk/chalk.git',
    primaryLanguage: 'TypeScript',
  },
];

describe('Code Analyzer Phase 5.10 — External Repository Robustness Verification', () => {
  for (const repoConfig of EXTERNAL_REPOSITORIES) {
    describe(`Robustness Check: ${repoConfig.name}`, () => {
      it('executes passive pipeline, measures performance, verifies scoring formula & determinism', async () => {
        let tempDirTracked = '';

        const startTotal = performance.now();

        const resultRun1 = await withClonedRepository(repoConfig.url, async ({ tempDir }) => {
          tempDirTracked = tempDir;
          assert.ok(
            fs.existsSync(tempDir),
            'Temporary clone directory must exist during execution'
          );

          // Step 1: Graph Extraction
          const startGraph = performance.now();
          const graph = await buildModuleDependencyGraph(tempDir);
          const durationGraph = performance.now() - startGraph;

          // Step 2: Cycle Detection
          const startCycles = performance.now();
          const cyclesResult = detectCircularDependencies(graph);
          const durationCycles = performance.now() - startCycles;

          // Step 3: Smell Analysis
          const startSmells = performance.now();
          const smellsResult = await analyzeCodeSmells(tempDir, graph);
          const durationSmells = performance.now() - startSmells;

          // Step 4: Tech Debt Scoring
          const startScoring = performance.now();
          const scoreResult = calculateCodeTechDebtScore(cyclesResult, smellsResult);
          const durationScoring = performance.now() - startScoring;

          return {
            graph,
            cyclesResult,
            smellsResult,
            scoreResult,
            durations: {
              graphMs: Math.round(durationGraph),
              cyclesMs: Math.round(durationCycles),
              smellsMs: Math.round(durationSmells),
              scoringMs: Math.round(durationScoring),
            },
          };
        });

        const durationTotal = performance.now() - startTotal;

        // Verify cleanup after withClonedRepository completes
        assert.ok(
          !fs.existsSync(tempDirTracked),
          `Temporary directory '${tempDirTracked}' must be cleaned up recursively`
        );

        console.log(`\n====================================================`);
        console.log(`EXTERNAL REPO ANALYSIS REPORT: ${repoConfig.name}`);
        console.log(`URL: ${repoConfig.url}`);
        console.log(`Language: ${repoConfig.primaryLanguage}`);
        console.log(`Total Pipeline Execution Time: ${Math.round(durationTotal)} ms`);
        console.log(
          `Phase Timings (ms): Graph=${resultRun1.durations.graphMs}, Cycles=${resultRun1.durations.cyclesMs}, Smells=${resultRun1.durations.smellsMs}, Scoring=${resultRun1.durations.scoringMs}`
        );
        console.log(`Source Files Discovered: ${resultRun1.graph.nodes.length}`);
        console.log(
          `Graph Edges: Total=${resultRun1.graph.edges.length}, Internal=${resultRun1.graph.edges.filter((e) => e.kind === 'internal').length}, External=${resultRun1.graph.edges.filter((e) => e.kind === 'external').length}`
        );
        console.log(`Entrypoints Discovered: ${resultRun1.graph.entrypoints.length}`);
        console.log(`Circular Dependencies Detected: ${resultRun1.cyclesResult.totalCycles}`);
        console.log(`Code Smells Observed: ${resultRun1.smellsResult.summary.totalObservations}`);
        console.log(
          `Smell Breakdown: LongFuncs=${resultRun1.scoreResult.counts.longFunctions}, DupLogic=${resultRun1.scoreResult.counts.duplicateLogic}, UnusedExports=${resultRun1.scoreResult.counts.potentiallyUnusedExports}, CommentDebt=${resultRun1.scoreResult.counts.todoMarkers + resultRun1.scoreResult.counts.fixmeMarkers + resultRun1.scoreResult.counts.hackMarkers + resultRun1.scoreResult.counts.xxxMarkers}`
        );
        console.log(
          `Tech Debt Score: ${resultRun1.scoreResult.score} (${resultRun1.scoreResult.band})`
        );
        console.log(
          `Component Penalties: Cycles=${resultRun1.scoreResult.penalties.circularDependencies}/${COMPONENT_CAPS.circularDependencies}, LongFuncs=${resultRun1.scoreResult.penalties.longFunctions}/${COMPONENT_CAPS.longFunctions}, DupLogic=${resultRun1.scoreResult.penalties.duplicateLogic}/${COMPONENT_CAPS.duplicateLogic}, UnusedExports=${resultRun1.scoreResult.penalties.potentiallyUnusedExports}/${COMPONENT_CAPS.potentiallyUnusedExports}, CommentDebt=${resultRun1.scoreResult.penalties.commentDebt}/${COMPONENT_CAPS.commentDebt}, TestRatio=${resultRun1.scoreResult.penalties.testFileRatio}/${COMPONENT_CAPS.testFileRatio}, TotalPenalty=${resultRun1.scoreResult.penalties.total}`
        );
        console.log(`====================================================\n`);

        // Phase 5.5 Formula Verification
        const expectedCyclePen = Math.min(
          COMPONENT_CAPS.circularDependencies,
          resultRun1.cyclesResult.totalCycles * 5
        );
        assert.strictEqual(
          resultRun1.scoreResult.penalties.circularDependencies,
          expectedCyclePen,
          'Cycle penalty must equal min(30, cycles * 5)'
        );

        const expectedScore = Math.max(0, 100 - resultRun1.scoreResult.penalties.total);
        assert.strictEqual(
          resultRun1.scoreResult.score,
          expectedScore,
          'Tech debt score must equal max(0, 100 - totalPenalty)'
        );

        // Step 5: Determinism Verification (Run 2)
        const resultRun2 = await withClonedRepository(repoConfig.url, async ({ tempDir }) => {
          const graph = await buildModuleDependencyGraph(tempDir);
          const cyclesResult = detectCircularDependencies(graph);
          const smellsResult = await analyzeCodeSmells(tempDir, graph);
          const scoreResult = calculateCodeTechDebtScore(cyclesResult, smellsResult);

          return { graph, cyclesResult, smellsResult, scoreResult };
        });

        assert.strictEqual(
          resultRun2.graph.nodes.length,
          resultRun1.graph.nodes.length,
          'Node count must be 100% identical between runs'
        );
        assert.strictEqual(
          resultRun2.graph.edges.length,
          resultRun1.graph.edges.length,
          'Edge count must be 100% identical between runs'
        );
        assert.strictEqual(
          resultRun2.cyclesResult.totalCycles,
          resultRun1.cyclesResult.totalCycles,
          'Cycle count must be 100% identical between runs'
        );
        assert.strictEqual(
          resultRun2.smellsResult.summary.totalObservations,
          resultRun1.smellsResult.summary.totalObservations,
          'Smell observation count must be 100% identical between runs'
        );
        assert.strictEqual(
          resultRun2.scoreResult.score,
          resultRun1.scoreResult.score,
          'Tech debt score must be 100% identical between runs'
        );
        assert.strictEqual(
          resultRun2.scoreResult.band,
          resultRun1.scoreResult.band,
          'Score band must be 100% identical between runs'
        );
        assert.deepStrictEqual(
          resultRun2.scoreResult.penalties,
          resultRun1.scoreResult.penalties,
          'Score penalties must be 100% identical between runs'
        );
      });
    });
  }
});
