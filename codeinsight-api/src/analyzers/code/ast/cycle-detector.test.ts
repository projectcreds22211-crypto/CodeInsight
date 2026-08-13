import assert from 'node:assert';
import { describe, it } from 'node:test';
import { canonicalizeCycle, detectCircularDependencies } from './cycle-detector.js';
import type { DependencyEdge, ModuleDependencyGraph } from './types.js';

describe('Code Analyzer Phase 5.3 — Circular Dependency Detection Layer', () => {
  describe('Canonicalization (canonicalizeCycle)', () => {
    it('canonicalizes cycle node order starting with lexicographically smallest node', () => {
      const raw = ['src/b.ts', 'src/c.ts', 'src/a.ts', 'src/b.ts'];
      const canonical = canonicalizeCycle(raw);
      assert.deepStrictEqual(canonical, ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/a.ts']);
    });
  });

  describe('Cycle Detection (detectCircularDependencies)', () => {
    it('1. empty graph returns zero cycles', () => {
      const graph: ModuleDependencyGraph = { nodes: [], edges: [], entrypoints: [] };
      const res = detectCircularDependencies(graph);
      assert.strictEqual(res.totalCycles, 0);
      assert.strictEqual(res.cyclicNodeCount, 0);
      assert.deepStrictEqual(res.cycles, []);
    });

    it('2. single node with no edges returns zero cycles', () => {
      const graph: ModuleDependencyGraph = {
        nodes: [{ id: 'src/a.ts', path: 'src/a.ts' }],
        edges: [],
        entrypoints: ['src/a.ts'],
      };
      const res = detectCircularDependencies(graph);
      assert.strictEqual(res.totalCycles, 0);
    });

    it('3. simple two-node cycle (A -> B -> A) returns exactly one canonical cycle', () => {
      const edges: DependencyEdge[] = [
        { source: 'src/a.ts', target: 'src/b.ts', kind: 'internal', specifier: './b' },
        { source: 'src/b.ts', target: 'src/a.ts', kind: 'internal', specifier: './a' },
      ];
      const graph: ModuleDependencyGraph = {
        nodes: [
          { id: 'src/a.ts', path: 'src/a.ts' },
          { id: 'src/b.ts', path: 'src/b.ts' },
        ],
        edges,
        entrypoints: [],
      };
      const res = detectCircularDependencies(graph);
      assert.strictEqual(res.totalCycles, 1);
      assert.strictEqual(res.cyclicNodeCount, 2);
      assert.deepStrictEqual(res.cycles[0].nodes, ['src/a.ts', 'src/b.ts', 'src/a.ts']);
      assert.strictEqual(res.cycles[0].length, 2);
    });

    it('4. three-node cycle (A -> B -> C -> A) returns exactly one canonical cycle', () => {
      const edges: DependencyEdge[] = [
        { source: 'src/a.ts', target: 'src/b.ts', kind: 'internal', specifier: './b' },
        { source: 'src/b.ts', target: 'src/c.ts', kind: 'internal', specifier: './c' },
        { source: 'src/c.ts', target: 'src/a.ts', kind: 'internal', specifier: './a' },
      ];
      const graph: ModuleDependencyGraph = {
        nodes: [
          { id: 'src/a.ts', path: 'src/a.ts' },
          { id: 'src/b.ts', path: 'src/b.ts' },
          { id: 'src/c.ts', path: 'src/c.ts' },
        ],
        edges,
        entrypoints: [],
      };
      const res = detectCircularDependencies(graph);
      assert.strictEqual(res.totalCycles, 1);
      assert.deepStrictEqual(res.cycles[0].nodes, ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/a.ts']);
      assert.strictEqual(res.cycles[0].length, 3);
    });

    it('5. longer cycle (A -> B -> C -> D -> A) correctly detected', () => {
      const edges: DependencyEdge[] = [
        { source: 'src/a.ts', target: 'src/b.ts', kind: 'internal', specifier: './b' },
        { source: 'src/b.ts', target: 'src/c.ts', kind: 'internal', specifier: './c' },
        { source: 'src/c.ts', target: 'src/d.ts', kind: 'internal', specifier: './d' },
        { source: 'src/d.ts', target: 'src/a.ts', kind: 'internal', specifier: './a' },
      ];
      const graph: ModuleDependencyGraph = {
        nodes: ['a', 'b', 'c', 'd'].map((id) => ({ id: `src/${id}.ts`, path: `src/${id}.ts` })),
        edges,
        entrypoints: [],
      };
      const res = detectCircularDependencies(graph);
      assert.strictEqual(res.totalCycles, 1);
      assert.strictEqual(res.cycles[0].length, 4);
    });

    it('6. self-loop (A -> A) returns exactly one cycle', () => {
      const edges: DependencyEdge[] = [
        { source: 'src/a.ts', target: 'src/a.ts', kind: 'internal', specifier: './a' },
      ];
      const graph: ModuleDependencyGraph = {
        nodes: [{ id: 'src/a.ts', path: 'src/a.ts' }],
        edges,
        entrypoints: [],
      };
      const res = detectCircularDependencies(graph);
      assert.strictEqual(res.totalCycles, 1);
      assert.deepStrictEqual(res.cycles[0].nodes, ['src/a.ts', 'src/a.ts']);
      assert.strictEqual(res.cycles[0].length, 1);
    });

    it('7. acyclic chain (A -> B -> C) returns zero cycles', () => {
      const edges: DependencyEdge[] = [
        { source: 'src/a.ts', target: 'src/b.ts', kind: 'internal', specifier: './b' },
        { source: 'src/b.ts', target: 'src/c.ts', kind: 'internal', specifier: './c' },
      ];
      const graph: ModuleDependencyGraph = {
        nodes: ['a', 'b', 'c'].map((id) => ({ id: `src/${id}.ts`, path: `src/${id}.ts` })),
        edges,
        entrypoints: ['src/a.ts'],
      };
      const res = detectCircularDependencies(graph);
      assert.strictEqual(res.totalCycles, 0);
    });

    it('8. diamond pattern (A -> B, A -> C, B -> D, C -> D) returns zero cycles', () => {
      const edges: DependencyEdge[] = [
        { source: 'src/a.ts', target: 'src/b.ts', kind: 'internal', specifier: './b' },
        { source: 'src/a.ts', target: 'src/c.ts', kind: 'internal', specifier: './c' },
        { source: 'src/b.ts', target: 'src/d.ts', kind: 'internal', specifier: './d' },
        { source: 'src/c.ts', target: 'src/d.ts', kind: 'internal', specifier: './d' },
      ];
      const graph: ModuleDependencyGraph = {
        nodes: ['a', 'b', 'c', 'd'].map((id) => ({ id: `src/${id}.ts`, path: `src/${id}.ts` })),
        edges,
        entrypoints: ['src/a.ts'],
      };
      const res = detectCircularDependencies(graph);
      assert.strictEqual(res.totalCycles, 0);
    });

    it('9. two independent cycles returns exactly two cycles', () => {
      const edges: DependencyEdge[] = [
        // Cycle 1: A <-> B
        { source: 'src/a.ts', target: 'src/b.ts', kind: 'internal', specifier: './b' },
        { source: 'src/b.ts', target: 'src/a.ts', kind: 'internal', specifier: './a' },
        // Cycle 2: X <-> Y
        { source: 'src/x.ts', target: 'src/y.ts', kind: 'internal', specifier: './y' },
        { source: 'src/y.ts', target: 'src/x.ts', kind: 'internal', specifier: './x' },
      ];
      const graph: ModuleDependencyGraph = {
        nodes: ['a', 'b', 'x', 'y'].map((id) => ({ id: `src/${id}.ts`, path: `src/${id}.ts` })),
        edges,
        entrypoints: [],
      };
      const res = detectCircularDependencies(graph);
      assert.strictEqual(res.totalCycles, 2);
    });

    it('10. cycle plus unrelated acyclic graph returns only the cycle', () => {
      const edges: DependencyEdge[] = [
        // Acyclic chain
        {
          source: 'src/main.ts',
          target: 'src/service.ts',
          kind: 'internal',
          specifier: './service',
        },
        // Cycle: A <-> B
        { source: 'src/a.ts', target: 'src/b.ts', kind: 'internal', specifier: './b' },
        { source: 'src/b.ts', target: 'src/a.ts', kind: 'internal', specifier: './a' },
      ];
      const graph: ModuleDependencyGraph = {
        nodes: ['main', 'service', 'a', 'b'].map((id) => ({
          id: `src/${id}.ts`,
          path: `src/${id}.ts`,
        })),
        edges,
        entrypoints: ['src/main.ts'],
      };
      const res = detectCircularDependencies(graph);
      assert.strictEqual(res.totalCycles, 1);
      assert.deepStrictEqual(res.cycles[0].nodes, ['src/a.ts', 'src/b.ts', 'src/a.ts']);
    });

    it('11. external dependency edges are completely ignored', () => {
      const edges: DependencyEdge[] = [
        { source: 'src/a.ts', target: 'react', kind: 'external', specifier: 'react' },
        { source: 'src/b.ts', target: 'react', kind: 'external', specifier: 'react' },
        { source: 'src/a.ts', target: 'src/b.ts', kind: 'internal', specifier: './b' },
      ];
      const graph: ModuleDependencyGraph = {
        nodes: ['a', 'b'].map((id) => ({ id: `src/${id}.ts`, path: `src/${id}.ts` })),
        edges,
        entrypoints: ['src/a.ts'],
      };
      const res = detectCircularDependencies(graph);
      assert.strictEqual(res.totalCycles, 0);
    });

    it('12. SCC with multiple nodes produces one canonical cycle representation without duplicate rotations', () => {
      const edges: DependencyEdge[] = [
        { source: 'src/b.ts', target: 'src/c.ts', kind: 'internal', specifier: './c' },
        { source: 'src/c.ts', target: 'src/a.ts', kind: 'internal', specifier: './a' },
        { source: 'src/a.ts', target: 'src/b.ts', kind: 'internal', specifier: './b' },
      ];
      const graph: ModuleDependencyGraph = {
        nodes: ['a', 'b', 'c'].map((id) => ({ id: `src/${id}.ts`, path: `src/${id}.ts` })),
        edges,
        entrypoints: [],
      };
      const res = detectCircularDependencies(graph);
      assert.strictEqual(res.totalCycles, 1);
      assert.deepStrictEqual(res.cycles[0].nodes, ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/a.ts']);
    });

    it('13. duplicate/parallel edges produce deterministic behavior without duplicate cycle reports', () => {
      const edges: DependencyEdge[] = [
        { source: 'src/a.ts', target: 'src/b.ts', kind: 'internal', specifier: './b' },
        { source: 'src/a.ts', target: 'src/b.ts', kind: 'internal', specifier: './b?query' },
        { source: 'src/b.ts', target: 'src/a.ts', kind: 'internal', specifier: './a' },
      ];
      const graph: ModuleDependencyGraph = {
        nodes: ['a', 'b'].map((id) => ({ id: `src/${id}.ts`, path: `src/${id}.ts` })),
        edges,
        entrypoints: [],
      };
      const res = detectCircularDependencies(graph);
      assert.strictEqual(res.totalCycles, 1);
    });

    it('14. deterministic output over repeated executions', () => {
      const edges: DependencyEdge[] = [
        { source: 'src/a.ts', target: 'src/b.ts', kind: 'internal', specifier: './b' },
        { source: 'src/b.ts', target: 'src/a.ts', kind: 'internal', specifier: './a' },
      ];
      const graph: ModuleDependencyGraph = {
        nodes: ['a', 'b'].map((id) => ({ id: `src/${id}.ts`, path: `src/${id}.ts` })),
        edges,
        entrypoints: [],
      };

      const res1 = detectCircularDependencies(graph);
      const res2 = detectCircularDependencies(graph);
      assert.deepStrictEqual(res1, res2);
    });

    it('15. input ordering invariance (shuffled nodes and edges produce identical cycle output)', () => {
      const edges1: DependencyEdge[] = [
        { source: 'src/a.ts', target: 'src/b.ts', kind: 'internal', specifier: './b' },
        { source: 'src/b.ts', target: 'src/c.ts', kind: 'internal', specifier: './c' },
        { source: 'src/c.ts', target: 'src/a.ts', kind: 'internal', specifier: './a' },
      ];
      const graph1: ModuleDependencyGraph = {
        nodes: [
          { id: 'src/a.ts', path: 'src/a.ts' },
          { id: 'src/b.ts', path: 'src/b.ts' },
          { id: 'src/c.ts', path: 'src/c.ts' },
        ],
        edges: edges1,
        entrypoints: [],
      };

      // Shuffled inputs
      const edges2: DependencyEdge[] = [
        { source: 'src/c.ts', target: 'src/a.ts', kind: 'internal', specifier: './a' },
        { source: 'src/a.ts', target: 'src/b.ts', kind: 'internal', specifier: './b' },
        { source: 'src/b.ts', target: 'src/c.ts', kind: 'internal', specifier: './c' },
      ];
      const graph2: ModuleDependencyGraph = {
        nodes: [
          { id: 'src/c.ts', path: 'src/c.ts' },
          { id: 'src/a.ts', path: 'src/a.ts' },
          { id: 'src/b.ts', path: 'src/b.ts' },
        ],
        edges: edges2,
        entrypoints: [],
      };

      const res1 = detectCircularDependencies(graph1);
      const res2 = detectCircularDependencies(graph2);
      assert.deepStrictEqual(res1, res2);
    });

    it('16. self-loop inside otherwise larger graph correctly handled', () => {
      const edges: DependencyEdge[] = [
        { source: 'src/a.ts', target: 'src/b.ts', kind: 'internal', specifier: './b' },
        { source: 'src/b.ts', target: 'src/b.ts', kind: 'internal', specifier: './b' }, // Self loop
      ];
      const graph: ModuleDependencyGraph = {
        nodes: ['a', 'b'].map((id) => ({ id: `src/${id}.ts`, path: `src/${id}.ts` })),
        edges,
        entrypoints: ['src/a.ts'],
      };
      const res = detectCircularDependencies(graph);
      assert.strictEqual(res.totalCycles, 1);
      assert.deepStrictEqual(res.cycles[0].nodes, ['src/b.ts', 'src/b.ts']);
    });

    it('17. multiple SCCs each represented exactly once', () => {
      const edges: DependencyEdge[] = [
        // SCC 1: A <-> B
        { source: 'src/a.ts', target: 'src/b.ts', kind: 'internal', specifier: './b' },
        { source: 'src/b.ts', target: 'src/a.ts', kind: 'internal', specifier: './a' },
        // Inter-scc edge (acyclic link between SCCs)
        { source: 'src/b.ts', target: 'src/x.ts', kind: 'internal', specifier: './x' },
        // SCC 2: X <-> Y
        { source: 'src/x.ts', target: 'src/y.ts', kind: 'internal', specifier: './y' },
        { source: 'src/y.ts', target: 'src/x.ts', kind: 'internal', specifier: './x' },
      ];
      const graph: ModuleDependencyGraph = {
        nodes: ['a', 'b', 'x', 'y'].map((id) => ({ id: `src/${id}.ts`, path: `src/${id}.ts` })),
        edges,
        entrypoints: [],
      };

      const res = detectCircularDependencies(graph);
      assert.strictEqual(res.totalCycles, 2);
      assert.strictEqual(res.cyclicNodeCount, 4);
    });
  });
});
