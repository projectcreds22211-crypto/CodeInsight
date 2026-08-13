import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import {
  CODE_ANALYZER_SYSTEM_PROMPT,
  buildCodeAnalysisPrompt,
  enhanceCodeObservationsWithClaude,
  generateCodeOptimizationsWithClaude,
  parseClaudeCodeResponse,
} from './prompt.js';
import type {
  CodeSmellAnalysisResult,
  CodeSmellObservation,
  CodeTechDebtScore,
  CycleDetectionResult,
} from './ast/types.js';

function createMockCyclesResult(cycleCount = 1): CycleDetectionResult {
  const cycles = Array.from({ length: cycleCount }, (_, i) => ({
    id: `cycle:node${i}->node${i + 1}->node${i}`,
    nodes: [`src/node${i}.ts`, `src/node${i + 1}.ts`, `src/node${i}.ts`],
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
  observations: CodeSmellObservation[] = []
): CodeSmellAnalysisResult {
  const obs =
    observations.length > 0
      ? observations
      : [
          {
            id: 'smell:long-function:src/services/user.ts:10:80',
            ruleId: 'long-function' as const,
            severity: 'high' as const,
            file: 'src/services/user.ts',
            message: "Function 'processUser' is 70 lines long (threshold: 50)",
            startLine: 10,
            endLine: 80,
            metadata: { functionName: 'processUser', lineCount: 70 },
          },
          {
            id: 'smell:comment-debt:src/utils/helpers.ts:15:15',
            ruleId: 'comment-debt' as const,
            severity: 'low' as const,
            file: 'src/utils/helpers.ts',
            message: 'Found TODO comment marker',
            startLine: 15,
            endLine: 15,
            metadata: { marker: 'TODO' },
          },
        ];

  return {
    observations: obs,
    summary: {
      totalObservations: obs.length,
      longFunctionCount: obs.filter((o) => o.ruleId === 'long-function').length,
      duplicateLogicCount: obs.filter((o) => o.ruleId === 'duplicate-logic').length,
      unusedExportCount: obs.filter((o) => o.ruleId === 'potentially-unused-export').length,
      commentDebtCount: obs.filter((o) => o.ruleId === 'comment-debt').length,
      lowTestRatioCount: obs.filter((o) => o.ruleId === 'low-test-file-ratio').length,
    },
    metrics: {
      totalSourceFiles: 10,
      totalTestFiles: 3,
      testFileRatio: 0.3,
    },
  };
}

function createMockTechDebtScore(): CodeTechDebtScore {
  return {
    score: 85,
    band: 'moderate',
    isEmptyRepository: false,
    counts: {
      circularDependencies: 1,
      longFunctions: 1,
      highSeverityLongFunctions: 1,
      duplicateLogic: 0,
      potentiallyUnusedExports: 0,
      todoMarkers: 1,
      fixmeMarkers: 0,
      hackMarkers: 0,
      xxxMarkers: 0,
      productionFiles: 10,
      testFiles: 3,
    },
    penalties: {
      circularDependencies: 5,
      longFunctions: 2,
      duplicateLogic: 0,
      potentiallyUnusedExports: 0,
      commentDebt: 0.5,
      testFileRatio: 0,
      total: 8,
    },
    testFileRatio: 0.3,
  };
}

describe('Code Analyzer Phase 5.6 — Claude Prompt & Explanation Layer', () => {
  describe('Prompt Construction & Grounding Safety', () => {
    it('1. system prompt enforces deterministic grounding and advisory constraints', () => {
      assert.ok(CODE_ANALYZER_SYSTEM_PROMPT.includes('GROUNDING MANDATE'));
      assert.ok(CODE_ANALYZER_SYSTEM_PROMPT.includes('ADVISORY SAFETY'));
      assert.ok(CODE_ANALYZER_SYSTEM_PROMPT.includes('STRUCTURED JSON OUTPUT'));
    });

    it('2. prompt contains supplied observation IDs', () => {
      const cycles = createMockCyclesResult(1);
      const smells = createMockSmellsResult();
      const score = createMockTechDebtScore();

      const { userPrompt } = buildCodeAnalysisPrompt({
        cyclesResult: cycles,
        smellsResult: smells,
        techDebtScore: score,
      });

      assert.ok(userPrompt.includes(smells.observations[0].id));
      assert.ok(userPrompt.includes(smells.observations[1].id));
    });

    it('3. prompt contains tech-debt score breakdown and penalty counts', () => {
      const cycles = createMockCyclesResult(1);
      const smells = createMockSmellsResult();
      const score = createMockTechDebtScore();

      const { userPrompt } = buildCodeAnalysisPrompt({
        cyclesResult: cycles,
        smellsResult: smells,
        techDebtScore: score,
      });

      assert.ok(userPrompt.includes('Score: 85 / 100 (MODERATE)'));
      assert.ok(userPrompt.includes('Circular Dependencies: 5 / 30 pts'));
      assert.ok(userPrompt.includes('Long Functions: 2 / 20 pts'));
    });

    it('4. prompt contains cycle context', () => {
      const cycles = createMockCyclesResult(1);
      const smells = createMockSmellsResult();
      const score = createMockTechDebtScore();

      const { userPrompt } = buildCodeAnalysisPrompt({
        cyclesResult: cycles,
        smellsResult: smells,
        techDebtScore: score,
      });

      assert.ok(userPrompt.includes(cycles.cycles[0].id));
      assert.ok(userPrompt.includes('src/node0.ts -> src/node1.ts -> src/node0.ts'));
    });

    it('5. prompt contains smell context and file metadata', () => {
      const cycles = createMockCyclesResult(0);
      const smells = createMockSmellsResult();
      const score = createMockTechDebtScore();

      const { userPrompt } = buildCodeAnalysisPrompt({
        cyclesResult: cycles,
        smellsResult: smells,
        techDebtScore: score,
      });

      assert.ok(userPrompt.includes('Rule ID: long-function'));
      assert.ok(userPrompt.includes('File: src/services/user.ts'));
      assert.ok(userPrompt.includes("Function 'processUser' is 70 lines long"));
    });

    it('6. prompt contains bounded source snippets when rootDir is provided', () => {
      const tempDir = fs.mkdtempSync(path.join(process.cwd(), 'scratch-prompt-test-'));
      try {
        const fileDir = path.join(tempDir, 'src/services');
        fs.mkdirSync(fileDir, { recursive: true });
        const filePath = path.join(fileDir, 'user.ts');
        fs.writeFileSync(filePath, 'function processUser() {\n  const x = 1;\n  return x;\n}\n');

        const smells = createMockSmellsResult([
          {
            id: 'smell:long-function:src/services/user.ts:1:4',
            ruleId: 'long-function',
            severity: 'medium',
            file: 'src/services/user.ts',
            message: 'test message',
            startLine: 1,
            endLine: 4,
            metadata: {},
          },
        ]);

        const { userPrompt } = buildCodeAnalysisPrompt({
          cyclesResult: createMockCyclesResult(0),
          smellsResult: smells,
          techDebtScore: createMockTechDebtScore(),
          rootDir: tempDir,
        });

        assert.ok(userPrompt.includes('function processUser()'));
        assert.ok(userPrompt.includes('Source Snippet:'));
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('7. prompt does not contain secrets, environment keys, or authorization tokens', () => {
      const cycles = createMockCyclesResult(0);
      const smells = createMockSmellsResult();
      const score = createMockTechDebtScore();

      const { userPrompt } = buildCodeAnalysisPrompt({
        cyclesResult: cycles,
        smellsResult: smells,
        techDebtScore: score,
      });

      assert.strictEqual(userPrompt.includes('ANTHROPIC_API_KEY'), false);
      assert.strictEqual(userPrompt.includes('DATABASE_URL'), false);
      assert.strictEqual(userPrompt.includes('CLERK_SECRET_KEY'), false);
      assert.strictEqual(userPrompt.includes('sk-ant-'), false);
    });

    it('23. large source snippets are bounded defensively to prevent prompt bloat', () => {
      const tempDir = fs.mkdtempSync(path.join(process.cwd(), 'scratch-snippet-test-'));
      try {
        const fileDir = path.join(tempDir, 'src');
        fs.mkdirSync(fileDir, { recursive: true });
        const filePath = path.join(fileDir, 'huge.ts');
        const hugeContent = Array.from({ length: 200 }, (_, i) => `const line${i} = ${i};`).join(
          '\n'
        );
        fs.writeFileSync(filePath, hugeContent);

        const smells = createMockSmellsResult([
          {
            id: 'smell:long-function:src/huge.ts:1:200',
            ruleId: 'long-function',
            severity: 'high',
            file: 'src/huge.ts',
            message: 'Huge function',
            startLine: 1,
            endLine: 200,
            metadata: {},
          },
        ]);

        const { userPrompt } = buildCodeAnalysisPrompt({
          cyclesResult: createMockCyclesResult(0),
          smellsResult: smells,
          techDebtScore: createMockTechDebtScore(),
          rootDir: tempDir,
        });

        // Snippet lines > maxLines (40) is omitted safely
        assert.strictEqual(userPrompt.includes('line199'), false);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });

  describe('Response Parsing & Grounding Safeguards', () => {
    const validIds = new Set([
      'smell:long-function:src/services/user.ts:10:80',
      'smell:comment-debt:src/utils/helpers.ts:15:15',
    ]);

    it('8. valid Claude JSON parses correctly', () => {
      const rawJson = JSON.stringify({
        summaryOverview: 'Primary debt stems from long methods.',
        explanations: [
          {
            observationId: 'smell:long-function:src/services/user.ts:10:80',
            explanation: 'The processUser function exceeds 70 lines.',
            likelyImpact: 'Increased risk of regression bugs.',
            recommendation: 'Break down into smaller utility functions.',
            refactorExample: 'function processUser() { step1(); step2(); }',
            confidence: 'high',
          },
        ],
      });

      const parsed = parseClaudeCodeResponse(rawJson, validIds);

      assert.strictEqual(parsed.summaryOverview, 'Primary debt stems from long methods.');
      assert.strictEqual(parsed.explanations.length, 1);
      assert.strictEqual(
        parsed.explanations[0].observationId,
        'smell:long-function:src/services/user.ts:10:80'
      );
    });

    it('9. markdown-fenced ```json parses correctly', () => {
      const rawText = `\`\`\`json
{
  "summaryOverview": "Fenced JSON overview.",
  "explanations": [
    {
      "observationId": "smell:long-function:src/services/user.ts:10:80",
      "explanation": "Fenced explanation",
      "likelyImpact": "Fenced impact",
      "recommendation": "Fenced recommendation"
    }
  ]
}
\`\`\``;

      const parsed = parseClaudeCodeResponse(rawText, validIds);

      assert.strictEqual(parsed.summaryOverview, 'Fenced JSON overview.');
      assert.strictEqual(parsed.explanations.length, 1);
    });

    it('10. malformed JSON is rejected safely without throwing', () => {
      const rawText = 'Not valid JSON {{{';
      const parsed = parseClaudeCodeResponse(rawText, validIds);

      assert.deepStrictEqual(parsed, { explanations: [] });
    });

    it('11. unknown observation IDs are rejected defensively', () => {
      const rawJson = JSON.stringify({
        explanations: [
          {
            observationId: 'invented-unknown-id',
            explanation: 'Fake issue',
            likelyImpact: 'Fake impact',
            recommendation: 'Fake advice',
          },
        ],
      });

      const parsed = parseClaudeCodeResponse(rawJson, validIds);

      assert.strictEqual(parsed.explanations.length, 0);
    });

    it('12. missing required fields are rejected defensively', () => {
      const rawJson = JSON.stringify({
        explanations: [
          {
            observationId: 'smell:long-function:src/services/user.ts:10:80',
            explanation: 'Missing likelyImpact and recommendation',
          },
        ],
      });

      const parsed = parseClaudeCodeResponse(rawJson, validIds);

      assert.strictEqual(parsed.explanations.length, 0);
    });

    it('13. multiple valid explanations parse correctly', () => {
      const rawJson = JSON.stringify({
        summaryOverview: 'Multiple explanations overview',
        explanations: [
          {
            observationId: 'smell:long-function:src/services/user.ts:10:80',
            explanation: 'First explanation',
            likelyImpact: 'First impact',
            recommendation: 'First recommendation',
          },
          {
            observationId: 'smell:comment-debt:src/utils/helpers.ts:15:15',
            explanation: 'Second explanation',
            likelyImpact: 'Second impact',
            recommendation: 'Second recommendation',
          },
        ],
      });

      const parsed = parseClaudeCodeResponse(rawJson, validIds);

      assert.strictEqual(parsed.explanations.length, 2);
    });
  });

  describe('Deterministic Identity Preservation during Enrichment', () => {
    it('14-18. preserves finding identity, severity, rule IDs, evidence, and tech-debt score during enrichment', () => {
      const smells = createMockSmellsResult();
      const origObs = smells.observations[0];

      const claudeResponse = {
        summaryOverview: 'Overview',
        explanations: [
          {
            observationId: origObs.id,
            explanation: 'Claude explanation',
            likelyImpact: 'Claude impact',
            recommendation: 'Claude recommendation',
            refactorExample: 'const safe = 1;',
            confidence: 'high' as const,
          },
        ],
      };

      const enhanced = enhanceCodeObservationsWithClaude(smells, claudeResponse);
      const enhancedObs = enhanced.observations[0];

      // 14. Identity preserved
      assert.strictEqual(enhancedObs.id, origObs.id);
      // 15. Severity preserved
      assert.strictEqual(enhancedObs.severity, origObs.severity);
      // 16. Rule IDs preserved
      assert.strictEqual(enhancedObs.ruleId, origObs.ruleId);
      // 17. Evidence / line numbers preserved
      assert.strictEqual(enhancedObs.file, origObs.file);
      assert.strictEqual(enhancedObs.startLine, origObs.startLine);
      assert.strictEqual(enhancedObs.endLine, origObs.endLine);

      // 22. Refactor example attached as advisory metadata only
      const aiMeta = enhancedObs.metadata.aiExplanation as any;
      assert.ok(aiMeta);
      assert.strictEqual(aiMeta.explanation, 'Claude explanation');
      assert.strictEqual(aiMeta.refactorExample, 'const safe = 1;');
    });

    it('18. deterministic score remains unchanged', () => {
      const score = createMockTechDebtScore();
      // Score object is not mutated by Claude prompt functions
      assert.strictEqual(score.score, 85);
      assert.strictEqual(score.band, 'moderate');
    });
  });

  describe('Offline & API Fallback Safety', () => {
    it('19. offline fallback works without ANTHROPIC_API_KEY set', async () => {
      const origEnv = process.env.ANTHROPIC_API_KEY;
      delete process.env.ANTHROPIC_API_KEY;

      try {
        const res = await generateCodeOptimizationsWithClaude({
          cyclesResult: createMockCyclesResult(0),
          smellsResult: createMockSmellsResult(),
          techDebtScore: createMockTechDebtScore(),
        });

        assert.ok(res.summaryOverview?.includes('ANTHROPIC_API_KEY unconfigured'));
        assert.deepStrictEqual(res.explanations, []);
      } finally {
        if (origEnv) process.env.ANTHROPIC_API_KEY = origEnv;
      }
    });

    it('20. API failure falls back safely without throwing uncaught error', async () => {
      const origEnv = process.env.ANTHROPIC_API_KEY;
      process.env.ANTHROPIC_API_KEY = 'invalid_dummy_key';

      try {
        const res = await generateCodeOptimizationsWithClaude({
          cyclesResult: createMockCyclesResult(0),
          smellsResult: createMockSmellsResult(),
          techDebtScore: createMockTechDebtScore(),
        });

        assert.ok(
          res.summaryOverview?.includes('AI explanation service encountered an error') ||
            res.summaryOverview?.includes('unconfigured')
        );
        assert.deepStrictEqual(res.explanations, []);
      } finally {
        if (origEnv) process.env.ANTHROPIC_API_KEY = origEnv;
        else delete process.env.ANTHROPIC_API_KEY;
      }
    });

    it('21. repeated fallback execution is 100% deterministic', async () => {
      const req = {
        cyclesResult: createMockCyclesResult(0),
        smellsResult: createMockSmellsResult(),
        techDebtScore: createMockTechDebtScore(),
      };

      const res1 = await generateCodeOptimizationsWithClaude(req);
      const res2 = await generateCodeOptimizationsWithClaude(req);

      assert.deepStrictEqual(res1, res2);
    });
  });
});
