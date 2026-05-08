import { matrix, multiply, inv, type Matrix } from 'mathjs';
import type { ImageNeighbourType } from '../../schemaTypes';
import type { PixelTransform } from '../types';

/** Reshape a flat 9-element homography array into a 3x3 matrix. */
function array2Matrix(hc: number[] | null | undefined): number[][] | null {
  if (!hc || hc.length !== 9) return null;
  return [hc.slice(0, 3), hc.slice(3, 6), hc.slice(6, 9)];
}

/** Build a pixel→pixel transform from a 3x3 homography matrix. */
function makeTransform(H: Matrix): PixelTransform {
  return (c: [number, number]): [number, number] => {
    const result = multiply(H, [c[0], c[1], 1]).valueOf() as number[];
    return [result[0] / result[2], result[1] / result[2]];
  };
}

export interface BuiltTransforms {
  forward: PixelTransform;
  backward: PixelTransform;
  noHomography: boolean;
}

/**
 * Build forward and backward transforms for an ImageNeighbour row. If the
 * homography is missing or malformed, returns identity transforms with
 * `noHomography: true` so callers can exclude the pair from the workflow.
 */
export function buildNeighbourTransforms(n: ImageNeighbourType): BuiltTransforms {
  const arr = array2Matrix(n.homography ?? null);
  if (!arr) {
    const identity: PixelTransform = (c) => [c[0], c[1]];
    return { forward: identity, backward: identity, noHomography: true };
  }
  const M = matrix(arr) as Matrix;
  const Minv = inv(M) as Matrix;
  return {
    forward: makeTransform(M),
    backward: makeTransform(Minv),
    noHomography: false,
  };
}

/** Returns true when (x, y) projected via `tf` lands inside [0, w) × [0, h). */
export function projectsInside(
  x: number,
  y: number,
  tf: PixelTransform,
  w: number,
  h: number
): boolean {
  const [tx, ty] = tf([x, y]);
  return tx >= 0 && ty >= 0 && tx < w && ty < h;
}
