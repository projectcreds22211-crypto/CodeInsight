import type {
  CycleDetectionResult,
  DependencyCycle,
  DependencyEdge,
  ModuleDependencyGraph,
} from './types.js';

/**
 * Normalizes a cycle node path so that the lexicographically smallest node appears first.
 * For example: ['src/b.ts', 'src/c.ts', 'src/a.ts', 'src/b.ts']
 * -> unique nodes: ['src/b.ts', 'src/c.ts', 'src/a.ts']
 * -> rotated: ['src/a.ts', 'src/b.ts', 'src/c.ts', 'src/a.ts']
 */
export function canonicalizeCycle(cycleNodes: string[]): string[] {
  if (cycleNodes.length <= 1) return cycleNodes;

  // Strip trailing duplicate node if closed loop
  const uniqueNodes =
    cycleNodes[0] === cycleNodes[cycleNodes.length - 1] ? cycleNodes.slice(0, -1) : [...cycleNodes];

  if (uniqueNodes.length <= 1) {
    return [uniqueNodes[0], uniqueNodes[0]];
  }

  // Find index of lexicographically smallest node
  let minIdx = 0;
  for (let i = 1; i < uniqueNodes.length; i++) {
    if (uniqueNodes[i] < uniqueNodes[minIdx]) {
      minIdx = i;
    }
  }

  // Rotate array starting at minIdx
  const rotated = [...uniqueNodes.slice(minIdx), ...uniqueNodes.slice(0, minIdx)];

  // Close loop
  return [...rotated, rotated[0]];
}

/**
 * Detects circular dependencies in a ModuleDependencyGraph over internal edges.
 * Uses Tarjan's Strongly Connected Components algorithm for O(V + E) complexity
 * and normalizes output into canonical, deterministic representation.
 */
export function detectCircularDependencies(graph: ModuleDependencyGraph): CycleDetectionResult {
  if (!graph || !graph.nodes || graph.nodes.length === 0) {
    return { cycles: [], totalCycles: 0, cyclicNodeCount: 0 };
  }

  // 1. Filter internal edges only
  const internalEdges = (graph.edges || []).filter((e) => e.kind === 'internal');
  if (internalEdges.length === 0) {
    return { cycles: [], totalCycles: 0, cyclicNodeCount: 0 };
  }

  // Build adjacency list for internal nodes
  const adj = new Map<string, Array<{ target: string; edge: DependencyEdge }>>();
  const nodesSet = new Set<string>();

  for (const node of graph.nodes) {
    nodesSet.add(node.id);
    adj.set(node.id, []);
  }

  for (const edge of internalEdges) {
    nodesSet.add(edge.source);
    nodesSet.add(edge.target);
    if (!adj.has(edge.source)) {
      adj.set(edge.source, []);
    }
    adj.get(edge.source)!.push({ target: edge.target, edge });
  }

  // Sort adjacency list targets deterministically
  for (const [, neighbors] of adj) {
    neighbors.sort((a, b) => a.target.localeCompare(b.target));
  }

  // Check self-loops explicitly
  const selfLoops: DependencyCycle[] = [];
  for (const edge of internalEdges) {
    if (edge.source === edge.target) {
      const cycleNodes = [edge.source, edge.source];
      const cycleId = `cycle:${cycleNodes.join('->')}`;
      selfLoops.push({
        id: cycleId,
        nodes: cycleNodes,
        edges: [edge],
        length: 1,
      });
    }
  }

  // 2. Tarjan's SCC Algorithm
  let index = 0;
  const indices = new Map<string, number>();
  const lowlink = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const sccs: string[][] = [];

  const allNodes = Array.from(nodesSet).sort();

  function strongConnect(u: string) {
    indices.set(u, index);
    lowlink.set(u, index);
    index++;
    stack.push(u);
    onStack.add(u);

    const neighbors = adj.get(u) || [];
    for (const { target: v } of neighbors) {
      if (!indices.has(v)) {
        strongConnect(v);
        lowlink.set(u, Math.min(lowlink.get(u)!, lowlink.get(v)!));
      } else if (onStack.has(v)) {
        lowlink.set(u, Math.min(lowlink.get(u)!, indices.get(v)!));
      }
    }

    if (lowlink.get(u) === indices.get(u)) {
      const scc: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        scc.push(w);
      } while (w !== u);
      sccs.push(scc);
    }
  }

  for (const node of allNodes) {
    if (!indices.has(node)) {
      strongConnect(node);
    }
  }

  // 3. Extract representative simple cycle per multi-node SCC
  const extractedCycles: DependencyCycle[] = [...selfLoops];

  for (const scc of sccs) {
    if (scc.length <= 1) continue; // Single node without self-loop (self-loops handled above)

    const sccSet = new Set(scc);
    // Find canonical minimum node in SCC
    const startNode = [...scc].sort()[0];

    // BFS to find shortest path from startNode back to startNode within SCC
    const queue: Array<{ curr: string; path: string[]; edges: DependencyEdge[] }> = [
      { curr: startNode, path: [startNode], edges: [] },
    ];
    const visited = new Set<string>();

    let foundCycle: { path: string[]; edges: DependencyEdge[] } | null = null;

    while (queue.length > 0) {
      const { curr, path: currentPath, edges: currentEdges } = queue.shift()!;

      const neighbors = adj.get(curr) || [];
      for (const { target: neighbor, edge } of neighbors) {
        if (!sccSet.has(neighbor)) continue;

        if (neighbor === startNode && currentPath.length > 1) {
          foundCycle = {
            path: [...currentPath, startNode],
            edges: [...currentEdges, edge],
          };
          break;
        }

        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push({
            curr: neighbor,
            path: [...currentPath, neighbor],
            edges: [...currentEdges, edge],
          });
        }
      }

      if (foundCycle) break;
    }

    if (foundCycle) {
      const canonicalNodes = canonicalizeCycle(foundCycle.path);
      const cycleId = `cycle:${canonicalNodes.join('->')}`;
      const uniqueCount = canonicalNodes.length - 1;

      extractedCycles.push({
        id: cycleId,
        nodes: canonicalNodes,
        edges: foundCycle.edges,
        length: uniqueCount,
      });
    }
  }

  // 4. Deduplicate and sort cycles deterministically
  const cycleMap = new Map<string, DependencyCycle>();
  for (const cycle of extractedCycles) {
    if (!cycleMap.has(cycle.id)) {
      cycleMap.set(cycle.id, cycle);
    }
  }

  const cycles = Array.from(cycleMap.values()).sort((a, b) => a.id.localeCompare(b.id));

  // Compute total unique cyclic nodes
  const cyclicNodesSet = new Set<string>();
  for (const cycle of cycles) {
    for (const node of cycle.nodes) {
      cyclicNodesSet.add(node);
    }
  }

  return {
    cycles,
    totalCycles: cycles.length,
    cyclicNodeCount: cyclicNodesSet.size,
  };
}
