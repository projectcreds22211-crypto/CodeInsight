import fs from 'node:fs';
import path from 'node:path';
import { Project, SyntaxKind } from 'ts-morph';
import type { DependencyEdge, DependencyNode, ModuleDependencyGraph } from './types.js';

/**
 * Normalizes absolute file path to repository-relative path with forward slashes
 */
export function toRepoRelative(absPath: string, rootDir: string): string {
  const normalizedAbs = path.normalize(absPath).replace(/\\/g, '/');
  const normalizedRoot = path.normalize(rootDir).replace(/\\/g, '/');

  if (normalizedAbs.startsWith(normalizedRoot)) {
    let rel = normalizedAbs.slice(normalizedRoot.length);
    if (rel.startsWith('/')) {
      rel = rel.slice(1);
    }
    return rel;
  }
  return normalizedAbs;
}

/**
 * Resolves a relative import specifier against current source file directory
 */
function resolveRelativeImport(
  specifier: string,
  currentFileAbsPath: string,
  rootDir: string
): string | null {
  const fileDir = path.dirname(currentFileAbsPath);
  const baseTargetAbs = path.resolve(fileDir, specifier);

  const extensionsToTry = [
    '',
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '/index.ts',
    '/index.tsx',
    '/index.js',
    '/index.jsx',
  ];

  for (const ext of extensionsToTry) {
    const candidate = baseTargetAbs + ext;
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return toRepoRelative(candidate, rootDir);
    }
  }

  return null;
}

/**
 * Extracts package name from external import specifier (e.g., "@clerk/fastify/sub" -> "@clerk/fastify")
 */
function extractPackageName(specifier: string): string {
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    return parts.slice(0, 2).join('/');
  }
  return specifier.split('/')[0];
}

/**
 * Builds a deterministic module dependency graph from a cloned repository directory using ts-morph.
 */
export async function buildModuleDependencyGraph(rootDir: string): Promise<ModuleDependencyGraph> {
  const absRootDir = path.resolve(rootDir);
  if (!fs.existsSync(absRootDir)) {
    return { nodes: [], edges: [], entrypoints: [] };
  }

  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
      jsx: 1, // Preserve / React
      noLib: true,
    },
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
  if (sourceFiles.length === 0) {
    return { nodes: [], edges: [], entrypoints: [] };
  }

  const nodeMap = new Map<string, DependencyNode>();
  const rawEdges: DependencyEdge[] = [];

  // Register all discovered source file nodes
  for (const file of sourceFiles) {
    const relPath = toRepoRelative(file.getFilePath(), absRootDir);
    nodeMap.set(relPath, { id: relPath, path: relPath });
  }

  // Extract dependency edges from each source file
  for (const file of sourceFiles) {
    const sourceId = toRepoRelative(file.getFilePath(), absRootDir);
    const specifiersToProcess: string[] = [];

    // 1. ES module imports
    for (const importDecl of file.getImportDeclarations()) {
      specifiersToProcess.push(importDecl.getModuleSpecifierValue());
    }

    // 2. Re-export declarations (export ... from './module')
    for (const exportDecl of file.getExportDeclarations()) {
      if (exportDecl.hasModuleSpecifier()) {
        specifiersToProcess.push(exportDecl.getModuleSpecifierValue()!);
      }
    }

    // 3. Dynamic imports & CommonJS require() calls
    const callExpressions = file.getDescendantsOfKind(SyntaxKind.CallExpression);
    for (const callExpr of callExpressions) {
      const expressionText = callExpr.getExpression().getText();
      const args = callExpr.getArguments();

      if ((expressionText === 'require' || expressionText === 'import') && args.length > 0) {
        const firstArg = args[0];
        if (firstArg.getKind() === SyntaxKind.StringLiteral) {
          const spec = firstArg.getText().slice(1, -1);
          if (spec) {
            specifiersToProcess.push(spec);
          }
        }
      }
    }

    // Resolve specifiers to internal modules or external packages
    for (const specifier of specifiersToProcess) {
      // Ignore non-JS/TS style imports (e.g. .css, .json, .png)
      if (/\.(css|scss|sass|less|png|jpg|svg|json)$/i.test(specifier)) {
        continue;
      }

      if (specifier.startsWith('.')) {
        const resolvedInternal = resolveRelativeImport(specifier, file.getFilePath(), absRootDir);

        if (resolvedInternal) {
          rawEdges.push({
            source: sourceId,
            target: resolvedInternal,
            kind: 'internal',
            specifier,
          });
        }
      } else {
        // External package dependency
        const packageName = extractPackageName(specifier);
        rawEdges.push({
          source: sourceId,
          target: packageName,
          kind: 'external',
          specifier,
        });
      }
    }
  }

  // Deduplicate edges
  const edgeSet = new Set<string>();
  const edges: DependencyEdge[] = [];

  for (const edge of rawEdges) {
    const key = `${edge.source}->${edge.target}:${edge.specifier}:${edge.kind}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push(edge);
    }
  }

  // Sort nodes deterministically
  const nodes = Array.from(nodeMap.values()).sort((a, b) => a.id.localeCompare(b.id));

  // Sort edges deterministically
  edges.sort((a, b) => {
    const cmpSource = a.source.localeCompare(b.source);
    if (cmpSource !== 0) return cmpSource;
    const cmpTarget = a.target.localeCompare(b.target);
    if (cmpTarget !== 0) return cmpTarget;
    return a.specifier.localeCompare(b.specifier);
  });

  // Calculate entrypoints (internal nodes with 0 incoming internal dependencies)
  const incomingInternalTargets = new Set<string>();
  for (const edge of edges) {
    if (edge.kind === 'internal') {
      incomingInternalTargets.add(edge.target);
    }
  }

  const entrypoints = nodes
    .filter((n) => !incomingInternalTargets.has(n.id))
    .map((n) => n.id)
    .sort();

  return {
    nodes,
    edges,
    entrypoints,
  };
}
