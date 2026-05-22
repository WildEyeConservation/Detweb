import { matrix, multiply, inv, type Matrix } from 'mathjs';
import type { ImageNeighbourType } from '../../schemaTypes';
import type { ChainedPath, PixelTransform } from '../types';

export const DEFAULT_CHAIN_RADIUS = 10;

function array2Matrix(hc: number[] | null | undefined): number[][] | null {
  if (!hc || hc.length !== 9) return null;
  return [hc.slice(0, 3), hc.slice(3, 6), hc.slice(6, 9)];
}

function makeTransform(H: Matrix): PixelTransform {
  return (c) => {
    const result = multiply(H, [c[0], c[1], 1]).valueOf() as number[];
    return [result[0] / result[2], result[1] / result[2]];
  };
}

interface AdjEdge {
  other: string;
  /** Source image (the key in the adjacency map) -> `other`. */
  forward: Matrix;
  /** `other` -> source image. */
  backward: Matrix;
}

function buildAdjacency(
  neighbours: ImageNeighbourType[]
): Map<string, AdjEdge[]> {
  const adj = new Map<string, AdjEdge[]>();
  const push = (from: string, edge: AdjEdge) => {
    let arr = adj.get(from);
    if (!arr) {
      arr = [];
      adj.set(from, arr);
    }
    arr.push(edge);
  };
  for (const n of neighbours) {
    const arr = array2Matrix(n.homography ?? null);
    if (!arr) continue;
    const M = matrix(arr) as Matrix;
    const Minv = inv(M) as Matrix;
    push(n.image1Id, { other: n.image2Id, forward: M, backward: Minv });
    push(n.image2Id, { other: n.image1Id, forward: Minv, backward: M });
  }
  return adj;
}

/**
 * BFS from every image up to `radius` hops, composing per-edge homographies
 * into source→target transforms. BFS guarantees we record each target via
 * its fewest-hops path, which minimises the drift that accumulates with
 * each composed matrix.
 *
 * Includes direct neighbours (hops === 1); the chain-propagation pass
 * skips those because adjacent-pair Munkres already handles them.
 */
export function buildChainedTransforms(
  neighbours: ImageNeighbourType[],
  radius: number = DEFAULT_CHAIN_RADIUS
): Map<string, Map<string, ChainedPath>> {
  const adj = buildAdjacency(neighbours);
  const result = new Map<string, Map<string, ChainedPath>>();
  const identity = matrix([
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ]) as Matrix;

  for (const sourceId of adj.keys()) {
    const reached = new Map<string, ChainedPath>();
    const visited = new Set<string>([sourceId]);
    type Frontier = {
      imageId: string;
      hops: number;
      path: string[];
      compForward: Matrix;
      compBackward: Matrix;
    };
    const queue: Frontier[] = [
      {
        imageId: sourceId,
        hops: 0,
        path: [sourceId],
        compForward: identity,
        compBackward: identity,
      },
    ];

    while (queue.length > 0) {
      const f = queue.shift()!;
      if (f.hops > 0) {
        reached.set(f.imageId, {
          imageIds: f.path,
          hops: f.hops,
          forward: makeTransform(f.compForward),
          backward: makeTransform(f.compBackward),
        });
      }
      if (f.hops >= radius) continue;
      const edges = adj.get(f.imageId) ?? [];
      for (const e of edges) {
        if (visited.has(e.other)) continue;
        visited.add(e.other);
        // source -> ... -> f -> other: e.forward is applied after compForward.
        const nextForward = multiply(e.forward, f.compForward) as Matrix;
        // other -> f -> ... -> source: e.backward applied first, then compBackward.
        const nextBackward = multiply(f.compBackward, e.backward) as Matrix;
        queue.push({
          imageId: e.other,
          hops: f.hops + 1,
          path: [...f.path, e.other],
          compForward: nextForward,
          compBackward: nextBackward,
        });
      }
    }

    result.set(sourceId, reached);
  }

  return result;
}
