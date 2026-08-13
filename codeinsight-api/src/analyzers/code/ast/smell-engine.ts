import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Project, SyntaxKind } from 'ts-morph';
import { toRepoRelative } from './graph-builder.js';
import type {
  CodeSmellAnalysisResult,
  CodeSmellConfig,
  CodeSmellObservation,
  ModuleDependencyGraph,
} from './types.js';

const DEFAULT_LONG_FUNCTION_LINES = 50;
const DEFAULT_LOW_TEST_RATIO_THRESHOLD = 0.2;
const DEFAULT_MIN_DUPLICATE_STATEMENTS = 4;

/**
 * Checks whether a repository-relative file path is a test file
 */
export function isTestFile(filePath: string): boolean {
  const normalized = filePath.toLowerCase();
  return (
    normalized.includes('.test.') ||
    normalized.includes('.spec.') ||
    normalized.includes('/__tests__/')
  );
}

/**
 * Normalizes a statement text block into generic token representation for duplicate code fingerprinting
 */
export function normalizeStatementBlock(statementTexts: string[]): string {
  const combined = statementTexts.join('\n');
  const keywords = new Set([
    'let',
    'const',
    'var',
    'function',
    'return',
    'if',
    'else',
    'for',
    'while',
    'import',
    'export',
    'class',
    'interface',
    'type',
    'console',
    'log',
    'null',
    'undefined',
    'true',
    'false',
    'async',
    'await',
  ]);

  return combined
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '') // strip comments
    .replace(/["'](?:[^"'\\]|\\.)*["']/g, '"STR"') // normalize strings
    .replace(/\b\d+\b/g, '0') // normalize numbers
    .replace(/\b[a-zA-Z_$][a-zA-Z0-9_$]*\b/g, (match) => {
      return keywords.has(match) ? match : 'ID';
    })
    .replace(/\s+/g, ' ') // normalize whitespace
    .trim();
}

/**
 * Resolves name of function, method, arrow function, or function expression
 */
export function getFunctionName(funcNode: any): string {
  if ('getName' in funcNode && typeof funcNode.getName === 'function') {
    const name = funcNode.getName();
    if (name) return name;
  }

  let curr = funcNode.getParent();
  while (curr) {
    const kind = curr.getKind();
    if (
      kind === SyntaxKind.VariableDeclaration ||
      kind === SyntaxKind.PropertyAssignment ||
      kind === SyntaxKind.BindingElement
    ) {
      if ('getName' in curr && typeof curr.getName === 'function') {
        const name = curr.getName();
        if (name) return name;
      }
      const ident = curr.getFirstChildByKind && curr.getFirstChildByKind(SyntaxKind.Identifier);
      if (ident) return ident.getText();
    }
    if (
      kind === SyntaxKind.FunctionDeclaration ||
      kind === SyntaxKind.SourceFile ||
      kind === SyntaxKind.ClassDeclaration
    ) {
      break;
    }
    curr = curr.getParent();
  }

  return '<anonymous>';
}

/**
 * Analyzes static code smells across 5 MVP heuristic categories using ts-morph AST
 */
export async function analyzeCodeSmells(
  rootDir: string,
  moduleGraph?: ModuleDependencyGraph,
  config: CodeSmellConfig = {}
): Promise<CodeSmellAnalysisResult> {
  const absRootDir = path.resolve(rootDir);
  const longFuncThreshold = config.longFunctionThresholdLines || DEFAULT_LONG_FUNCTION_LINES;
  const testRatioThreshold = config.lowTestFileRatioThreshold || DEFAULT_LOW_TEST_RATIO_THRESHOLD;
  const minDupStatements = config.minDuplicateStatements || DEFAULT_MIN_DUPLICATE_STATEMENTS;

  if (!fs.existsSync(absRootDir)) {
    return {
      observations: [],
      summary: {
        totalObservations: 0,
        longFunctionCount: 0,
        duplicateLogicCount: 0,
        unusedExportCount: 0,
        commentDebtCount: 0,
        lowTestRatioCount: 0,
      },
      metrics: { totalSourceFiles: 0, totalTestFiles: 0, testFileRatio: 1.0 },
    };
  }

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: { allowJs: true, jsx: 1, noLib: true },
  });

  const globPattern = path.join(absRootDir, '**/*.{ts,tsx,js,jsx}').replace(/\\/g, '/');
  const ignoreNodeModules = `!${path.join(absRootDir, '**/node_modules/**').replace(/\\/g, '/')}`;
  const ignoreGit = `!${path.join(absRootDir, '**/.git/**').replace(/\\/g, '/')}`;
  const ignoreDist = `!${path.join(absRootDir, '**/dist/**').replace(/\\/g, '/')}`;
  const ignoreBuild = `!${path.join(absRootDir, '**/build/**').replace(/\\/g, '/')}`;
  const ignoreCoverage = `!${path.join(absRootDir, '**/coverage/**').replace(/\\/g, '/')}`;

  project.addSourceFilesAtPaths([
    globPattern,
    ignoreNodeModules,
    ignoreGit,
    ignoreDist,
    ignoreBuild,
    ignoreCoverage,
  ]);

  const sourceFiles = project.getSourceFiles();
  const observations: CodeSmellObservation[] = [];

  let totalProductionFiles = 0;
  let totalTestFiles = 0;

  // Track statement fingerprints for duplicate logic detection
  const fingerprintMap = new Map<
    string,
    Array<{ file: string; startLine: number; endLine: number }>
  >();

  for (const file of sourceFiles) {
    const relPath = toRepoRelative(file.getFilePath(), absRootDir);

    if (isTestFile(relPath)) {
      totalTestFiles++;
    } else {
      totalProductionFiles++;
    }

    // -------------------------------------------------------------
    // 1. Long Functions Heuristic
    // -------------------------------------------------------------
    const functions = [
      ...file.getFunctions(),
      ...file.getDescendantsOfKind(SyntaxKind.MethodDeclaration),
      ...file.getDescendantsOfKind(SyntaxKind.ArrowFunction),
      ...file.getDescendantsOfKind(SyntaxKind.FunctionExpression),
    ];

    for (const funcNode of functions) {
      const startLine = funcNode.getStartLineNumber();
      const endLine = funcNode.getEndLineNumber();
      const lineCount = endLine - startLine + 1;

      if (lineCount > longFuncThreshold) {
        const funcName = getFunctionName(funcNode);
        const id = `smell:long-function:${relPath}:${startLine}:${endLine}`;
        observations.push({
          id,
          ruleId: 'long-function',
          severity: lineCount >= 100 ? 'high' : 'medium',
          file: relPath,
          message: `Function '${funcName}' is ${lineCount} lines long (threshold: ${longFuncThreshold})`,
          startLine,
          endLine,
          metadata: { functionName: funcName, lineCount, threshold: longFuncThreshold },
        });
      }

      // -------------------------------------------------------------
      // 2. Duplicate Logic Block Fingerprinting
      // -------------------------------------------------------------
      let statements: any[] = [];
      if ('getStatements' in funcNode && typeof (funcNode as any).getStatements === 'function') {
        statements = (funcNode as any).getStatements();
      } else {
        const body = (funcNode as any).getBody ? (funcNode as any).getBody() : null;
        if (body && 'getStatements' in body && typeof body.getStatements === 'function') {
          statements = body.getStatements();
        }
      }

      if (statements.length >= 1) {
        const stmtTexts = statements.map((s) => s.getText());
        const normalized = normalizeStatementBlock(stmtTexts);

        if (
          normalized.length >= 30 &&
          (statements.length >= minDupStatements || statements.length === 1)
        ) {
          const hash = crypto
            .createHash('sha256')
            .update(normalized)
            .digest('hex')
            .substring(0, 16);
          const startLine = statements[0].getStartLineNumber();
          const endLine = statements[statements.length - 1].getEndLineNumber();

          if (!fingerprintMap.has(hash)) {
            fingerprintMap.set(hash, []);
          }
          fingerprintMap.get(hash)!.push({ file: relPath, startLine, endLine });
        }
      }
    }

    // -------------------------------------------------------------
    // 4. TODO / FIXME Comment Debt Heuristic
    // -------------------------------------------------------------
    const fullText = file.getFullText();
    const lines = fullText.split('\n');

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const commentMatch = lineText.match(
        /\/\/\s*(TODO|FIXME|HACK|XXX)(?:\([^)]*\))?:?\s*(.*)|\/\*\s*(TODO|FIXME|HACK|XXX)(?:\([^)]*\))?:?\s*(.*?)\*\//i
      );

      if (commentMatch) {
        const marker = (commentMatch[1] || commentMatch[3]).toUpperCase() as
          'TODO' | 'FIXME' | 'HACK' | 'XXX';
        const rawExcerpt = (commentMatch[2] || commentMatch[4] || '').trim();
        const excerpt = rawExcerpt.substring(0, 120);

        const id = `smell:comment-debt:${relPath}:${lineNum}:${marker}`;
        observations.push({
          id,
          ruleId: 'comment-debt',
          severity: marker === 'FIXME' || marker === 'HACK' ? 'medium' : 'low',
          file: relPath,
          message: `Code debt marker '${marker}' found: "${excerpt || marker}"`,
          startLine: lineNum,
          endLine: lineNum,
          metadata: { marker, excerpt, line: lineNum },
        });
      }
    });

    // -------------------------------------------------------------
    // 3. Unused Utility / Export Heuristic
    // -------------------------------------------------------------
    const isEntry =
      isTestFile(relPath) ||
      relPath.endsWith('index.ts') ||
      relPath.endsWith('index.tsx') ||
      relPath.endsWith('server.ts') ||
      relPath.endsWith('App.tsx') ||
      (moduleGraph && moduleGraph.entrypoints.includes(relPath));

    if (!isEntry) {
      const exportDeclarations = file.getExportedDeclarations();
      for (const [exportName] of exportDeclarations) {
        if (exportName === 'default') continue;

        // Check if exportName is referenced as an identifier in any other source file
        let isReferenced = false;
        const exportRegex = new RegExp(
          `\\b${exportName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`
        );

        for (const otherFile of project.getSourceFiles()) {
          const otherRelPath = toRepoRelative(otherFile.getFilePath(), absRootDir);
          if (otherRelPath === relPath) continue;

          if (exportRegex.test(otherFile.getFullText())) {
            isReferenced = true;
            break;
          }
        }

        if (!isReferenced) {
          const decls = exportDeclarations.get(exportName);
          const declNode = decls && decls.length > 0 ? decls[0] : null;
          const startLine = declNode ? declNode.getStartLineNumber() : 1;
          const id = `smell:unused-export:${relPath}:${exportName}`;

          observations.push({
            id,
            ruleId: 'potentially-unused-export',
            severity: 'low',
            file: relPath,
            message: `Potentially unused export '${exportName}' in module '${relPath}' (heuristic)`,
            startLine,
            metadata: { exportName, file: relPath },
          });
        }
      }
    }
  }

  // -------------------------------------------------------------
  // Process Duplicate Logic Groups
  // -------------------------------------------------------------
  for (const [hash, occurrences] of fingerprintMap) {
    if (occurrences.length > 1) {
      // Deduplicate occurrences by file and startLine
      const uniqueOccurrencesMap = new Map<
        string,
        { file: string; startLine: number; endLine: number }
      >();
      for (const occ of occurrences) {
        uniqueOccurrencesMap.set(`${occ.file}:${occ.startLine}`, occ);
      }
      const uniqueOccurrences = Array.from(uniqueOccurrencesMap.values());

      if (uniqueOccurrences.length > 1) {
        for (let i = 0; i < uniqueOccurrences.length; i++) {
          const targetOcc = uniqueOccurrences[i];
          const otherOccs = uniqueOccurrences.filter((_, idx) => idx !== i);
          const otherLocsStr = otherOccs.map((o) => `${o.file}:${o.startLine}`).join(', ');

          const id = `smell:duplicate-logic:${targetOcc.file}:${targetOcc.startLine}:${hash.substring(0, 8)}`;
          observations.push({
            id,
            ruleId: 'duplicate-logic',
            severity: 'medium',
            file: targetOcc.file,
            message: `Duplicate statement logic block repeated in ${otherLocsStr}`,
            startLine: targetOcc.startLine,
            endLine: targetOcc.endLine,
            metadata: { hash, duplicates: otherOccs },
          });
        }
      }
    }
  }

  // -------------------------------------------------------------
  // 5. Test-File Ratio Heuristic
  // -------------------------------------------------------------
  const testFileRatio = totalProductionFiles > 0 ? totalTestFiles / totalProductionFiles : 1.0;
  if (totalProductionFiles > 0 && testFileRatio < testRatioThreshold) {
    const ratioPercent = (testFileRatio * 100).toFixed(1);
    const thresholdPercent = (testRatioThreshold * 100).toFixed(1);

    observations.push({
      id: 'smell:low-test-file-ratio:repository',
      ruleId: 'low-test-file-ratio',
      severity: 'medium',
      file: 'repository-root',
      message: `Low test-file presence ratio (${ratioPercent}% vs required threshold ${thresholdPercent}%)`,
      metadata: {
        totalProductionFiles,
        totalTestFiles,
        testFileRatio,
        threshold: testRatioThreshold,
      },
    });
  }

  // Deduplicate observations by ID
  const obsMap = new Map<string, CodeSmellObservation>();
  for (const obs of observations) {
    if (!obsMap.has(obs.id)) {
      obsMap.set(obs.id, obs);
    }
  }

  // Sort observations deterministically by file, startLine, ruleId
  const sortedObservations = Array.from(obsMap.values()).sort((a, b) => {
    const cmpFile = a.file.localeCompare(b.file);
    if (cmpFile !== 0) return cmpFile;
    const cmpLine = (a.startLine || 0) - (b.startLine || 0);
    if (cmpLine !== 0) return cmpLine;
    return a.ruleId.localeCompare(b.ruleId);
  });

  const summary = {
    totalObservations: sortedObservations.length,
    longFunctionCount: sortedObservations.filter((o) => o.ruleId === 'long-function').length,
    duplicateLogicCount: sortedObservations.filter((o) => o.ruleId === 'duplicate-logic').length,
    unusedExportCount: sortedObservations.filter((o) => o.ruleId === 'potentially-unused-export')
      .length,
    commentDebtCount: sortedObservations.filter((o) => o.ruleId === 'comment-debt').length,
    lowTestRatioCount: sortedObservations.filter((o) => o.ruleId === 'low-test-file-ratio').length,
  };

  return {
    observations: sortedObservations,
    summary,
    metrics: {
      totalSourceFiles: totalProductionFiles,
      totalTestFiles,
      testFileRatio,
    },
  };
}
