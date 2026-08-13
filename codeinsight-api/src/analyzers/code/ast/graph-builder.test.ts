import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { buildModuleDependencyGraph, toRepoRelative } from './graph-builder.js';

describe('Code Analyzer Phase 5.2 — ts-morph Integration & Module Dependency Graph Extraction', () => {
  describe('Path Normalization (toRepoRelative)', () => {
    it('1. converts absolute path to repository-relative path with forward slashes', () => {
      const rootDir = path.normalize('/tmp/repo');
      const absPath = path.normalize('/tmp/repo/src/services/user.ts');
      const rel = toRepoRelative(absPath, rootDir);
      assert.strictEqual(rel, 'src/services/user.ts');
    });
  });

  describe('Module Dependency Graph Extraction (buildModuleDependencyGraph)', () => {
    it('2. handles empty directory safely returning empty graph', async () => {
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'test-empty-repo-'));
      try {
        const graph = await buildModuleDependencyGraph(tempDir);
        assert.deepStrictEqual(graph.nodes, []);
        assert.deepStrictEqual(graph.edges, []);
        assert.deepStrictEqual(graph.entrypoints, []);
      } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('3. extracts JS/TS/JSX/TSX modules, ES imports, re-exports, CommonJS require, and external packages', async () => {
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'test-graph-repo-'));
      try {
        // Create directory structure
        await fs.promises.mkdir(path.join(tempDir, 'src/components'), { recursive: true });
        await fs.promises.mkdir(path.join(tempDir, 'src/utils'), { recursive: true });
        await fs.promises.mkdir(path.join(tempDir, 'node_modules/mock-pkg'), { recursive: true });

        // 1. src/index.ts (entrypoint)
        await fs.promises.writeFile(
          path.join(tempDir, 'src/index.ts'),
          `import React from 'react';
           import { Button } from './components/Button';
           import { helper } from './utils/helper';
           export * from './utils/helper';
           const lazyComp = import('./components/Lazy');
           const legacy = require('./utils/legacy');
          `
        );

        // 2. src/components/Button.tsx
        await fs.promises.writeFile(
          path.join(tempDir, 'src/components/Button.tsx'),
          `import React from 'react';
           import styles from './Button.css';
           export const Button = () => null;
          `
        );

        // 3. src/components/Lazy.tsx
        await fs.promises.writeFile(
          path.join(tempDir, 'src/components/Lazy.tsx'),
          `export default function Lazy() { return null; }`
        );

        // 4. src/utils/helper.ts
        await fs.promises.writeFile(
          path.join(tempDir, 'src/utils/helper.ts'),
          `export function helper() { return 'ok'; }`
        );

        // 5. src/utils/legacy.js
        await fs.promises.writeFile(
          path.join(tempDir, 'src/utils/legacy.js'),
          `module.exports = { old: true };`
        );

        // 6. node_modules file (should be ignored)
        await fs.promises.writeFile(
          path.join(tempDir, 'node_modules/mock-pkg/index.js'),
          `console.log('ignored');`
        );

        const graph = await buildModuleDependencyGraph(tempDir);

        // Verify node discovery (ignoring node_modules)
        const nodeIds = graph.nodes.map((n) => n.id);
        assert.deepStrictEqual(nodeIds, [
          'src/components/Button.tsx',
          'src/components/Lazy.tsx',
          'src/index.ts',
          'src/utils/helper.ts',
          'src/utils/legacy.js',
        ]);

        // Verify external package dependency extraction
        const externalEdges = graph.edges.filter((e) => e.kind === 'external');
        assert.ok(externalEdges.some((e) => e.source === 'src/index.ts' && e.target === 'react'));
        assert.ok(
          externalEdges.some(
            (e) => e.source === 'src/components/Button.tsx' && e.target === 'react'
          )
        );

        // Verify internal relative import resolution
        const internalEdges = graph.edges.filter((e) => e.kind === 'internal');
        assert.ok(
          internalEdges.some(
            (e) => e.source === 'src/index.ts' && e.target === 'src/components/Button.tsx'
          )
        );
        assert.ok(
          internalEdges.some(
            (e) => e.source === 'src/index.ts' && e.target === 'src/utils/helper.ts'
          )
        );
        assert.ok(
          internalEdges.some(
            (e) => e.source === 'src/index.ts' && e.target === 'src/components/Lazy.tsx'
          )
        );
        assert.ok(
          internalEdges.some(
            (e) => e.source === 'src/index.ts' && e.target === 'src/utils/legacy.js'
          )
        );

        // Verify asset import (.css) was ignored
        assert.strictEqual(
          graph.edges.some((e) => e.specifier.endsWith('.css')),
          false
        );

        // Verify entrypoint detection (src/index.ts has 0 internal incoming dependencies)
        assert.deepStrictEqual(graph.entrypoints, ['src/index.ts']);
      } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('4. resolves directory index imports (./utils -> src/utils/index.ts)', async () => {
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'test-index-repo-'));
      try {
        await fs.promises.mkdir(path.join(tempDir, 'src/utils'), { recursive: true });

        await fs.promises.writeFile(
          path.join(tempDir, 'src/main.ts'),
          `import { util } from './utils';`
        );

        await fs.promises.writeFile(
          path.join(tempDir, 'src/utils/index.ts'),
          `export const util = 123;`
        );

        const graph = await buildModuleDependencyGraph(tempDir);

        const internalEdges = graph.edges.filter((e) => e.kind === 'internal');
        assert.strictEqual(internalEdges.length, 1);
        assert.strictEqual(internalEdges[0].source, 'src/main.ts');
        assert.strictEqual(internalEdges[0].target, 'src/utils/index.ts');
      } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    });

    it('5. deterministic output over repeated executions', async () => {
      const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'test-det-repo-'));
      try {
        await fs.promises.mkdir(path.join(tempDir, 'src'), { recursive: true });
        await fs.promises.writeFile(path.join(tempDir, 'src/a.ts'), `import './b';`);
        await fs.promises.writeFile(path.join(tempDir, 'src/b.ts'), `export const b = 1;`);

        const res1 = await buildModuleDependencyGraph(tempDir);
        const res2 = await buildModuleDependencyGraph(tempDir);

        assert.deepStrictEqual(res1, res2);
      } finally {
        await fs.promises.rm(tempDir, { recursive: true, force: true });
      }
    });
  });
});
