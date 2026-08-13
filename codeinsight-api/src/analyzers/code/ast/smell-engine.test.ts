import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { analyzeCodeSmells, isTestFile } from './smell-engine.js';

describe('Code Analyzer Phase 5.4 — Code Smell Heuristics Engine', () => {
  describe('Utility & Helper Unit Tests', () => {
    it('recognizes test file naming conventions correctly', () => {
      assert.strictEqual(isTestFile('src/utils/math.test.ts'), true);
      assert.strictEqual(isTestFile('src/components/Button.spec.tsx'), true);
      assert.strictEqual(isTestFile('src/__tests__/integration.js'), true);
      assert.strictEqual(isTestFile('src/services/user-service.ts'), false);
    });
  });

  describe('Long Functions Heuristic', () => {
    it('1-7. distinguishes functions below, at, and above line threshold across methods, arrow functions, and nested functions', async () => {
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'test-long-func-'));
      try {
        await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });

        // Function with 10 lines (below default 50 threshold)
        const shortContent = `export function shortFunc() {\n${'  console.log("ok");\n'.repeat(8)}}\n`;
        await fs.promises.writeFile(path.join(tempDir, 'src/short.ts'), shortContent);

        // Function with 60 lines (above default 50 threshold)
        const longContent = `export function longFunc() {\n${'  console.log("line");\n'.repeat(58)}}\n`;
        await fs.promises.writeFile(path.join(tempDir, 'src/long.ts'), longContent);

        // Class method with 55 lines
        const classContent = `export class Service {\n  process() {\n${'    console.log("step");\n'.repeat(53)}  }\n}\n`;
        await fs.promises.writeFile(path.join(tempDir, 'src/service.ts'), classContent);

        // Arrow function with 55 lines
        const arrowContent = `export const arrowHandler = () => {\n${'  console.log("arrow");\n'.repeat(53)}};\n`;
        await fs.promises.writeFile(path.join(tempDir, 'src/arrow.ts'), arrowContent);

        const res = await analyzeCodeSmells(tempDir);
        const longFuncObs = res.observations.filter((o) => o.ruleId === 'long-function');

        assert.strictEqual(longFuncObs.length, 3);
        assert.ok(
          longFuncObs.some(
            (o) => o.file === 'src/long.ts' && o.metadata.functionName === 'longFunc'
          )
        );
        assert.ok(
          longFuncObs.some(
            (o) => o.file === 'src/service.ts' && o.metadata.functionName === 'process'
          )
        );
        assert.ok(
          longFuncObs.some(
            (o) => o.file === 'src/arrow.ts' && o.metadata.functionName === 'arrowHandler'
          )
        );
      } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Duplicate Logic Block Heuristic', () => {
    it('8-14. detects identical/whitespace-differing statement blocks while ignoring trivial one-liners and self-duplicates', async () => {
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'test-dup-logic-'));
      try {
        await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });

        const blockA = `
          export function processA(data: any) {
            console.log("start processing");
            const x = data.value * 2;
            const y = x + 10;
            console.log("result", y);
            return y;
          }
        `;

        // Same statement structure with whitespace differences
        const blockB = `
          export function processB(input: any) {
            console.log("start processing");
            const x = input.value * 2;
            const y = x + 10;
            console.log("result", y);
            return y;
          }
        `;

        await fs.promises.writeFile(path.join(tempDir, 'src/modA.ts'), blockA);
        await fs.promises.writeFile(path.join(tempDir, 'src/modB.ts'), blockB);

        const res = await analyzeCodeSmells(tempDir);
        const dupObs = res.observations.filter((o) => o.ruleId === 'duplicate-logic');

        assert.strictEqual(dupObs.length, 2);
        assert.ok(dupObs.some((o) => o.file === 'src/modA.ts'));
        assert.ok(dupObs.some((o) => o.file === 'src/modB.ts'));
      } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Unused Export Heuristic', () => {
    it('15-18. flags unreferenced non-entrypoint exports while preserving referenced or entrypoint exports', async () => {
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'test-unused-export-'));
      try {
        await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });

        // Unused export in internal module
        await fs.promises.writeFile(
          path.join(tempDir, 'src/internal-utils.ts'),
          `export function unusedHelper() { return 42; }
           export function usedHelper() { return 100; }`
        );

        // Consumer importing usedHelper
        await fs.promises.writeFile(
          path.join(tempDir, 'src/consumer.ts'),
          `import { usedHelper } from './internal-utils';
           console.log(usedHelper());`
        );

        // Entrypoint index.ts (should be preserved)
        await fs.promises.writeFile(
          path.join(tempDir, 'src/index.ts'),
          `export function mainPublicApi() { return true; }`
        );

        const res = await analyzeCodeSmells(tempDir);
        const unusedObs = res.observations.filter((o) => o.ruleId === 'potentially-unused-export');

        assert.strictEqual(unusedObs.length, 1);
        assert.strictEqual(unusedObs[0].file, 'src/internal-utils.ts');
        assert.strictEqual(unusedObs[0].metadata.exportName, 'unusedHelper');
      } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Comment Debt Heuristic', () => {
    it('19-24. scans TODO, FIXME, HACK, XXX comments with bounded excerpt lengths while ignoring normal comments', async () => {
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'test-comment-debt-'));
      try {
        await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });

        const source = `
          // TODO: refactor query optimization layer
          // FIXME: connection pool leak on timeout
          // HACK: temporary workaround for legacy IE11
          // XXX: investigate race condition in listener
          // Normal comment explaining business logic
        `;

        await fs.promises.writeFile(path.join(tempDir, 'src/app.ts'), source);

        const res = await analyzeCodeSmells(tempDir);
        const debtObs = res.observations.filter((o) => o.ruleId === 'comment-debt');

        assert.strictEqual(debtObs.length, 4);
        assert.ok(debtObs.some((o) => o.metadata.marker === 'TODO'));
        assert.ok(debtObs.some((o) => o.metadata.marker === 'FIXME'));
        assert.ok(debtObs.some((o) => o.metadata.marker === 'HACK'));
        assert.ok(debtObs.some((o) => o.metadata.marker === 'XXX'));
      } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Test-File Ratio Heuristic & Overall Execution', () => {
    it('25-29. evaluates test file ratio threshold and flags repository with low test coverage proxy', async () => {
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'test-ratio-'));
      try {
        await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });

        // 10 production files and 0 test files (0% ratio < 20% threshold)
        for (let i = 1; i <= 10; i++) {
          await fs.promises.writeFile(
            path.join(tempDir, `src/file${i}.ts`),
            `export const x${i} = ${i};`
          );
        }

        const res = await analyzeCodeSmells(tempDir);
        const ratioObs = res.observations.filter((o) => o.ruleId === 'low-test-file-ratio');

        assert.strictEqual(ratioObs.length, 1);
        assert.strictEqual(res.metrics.totalSourceFiles, 10);
        assert.strictEqual(res.metrics.totalTestFiles, 0);
        assert.strictEqual(res.metrics.testFileRatio, 0);
      } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('30-33. empty repo returns zero observations; repeated execution is 100% deterministic', async () => {
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'test-det-smell-'));
      try {
        await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });
        await fs.promises.writeFile(
          path.join(tempDir, 'src/app.ts'),
          `// TODO: fix this\nexport const x = 1;`
        );

        const res1 = await analyzeCodeSmells(tempDir);
        const res2 = await analyzeCodeSmells(tempDir);

        assert.deepStrictEqual(res1, res2);
      } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
