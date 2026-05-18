import { matrix, multiply, inv, type Matrix } from 'mathjs';
import type { ImageNeighbourType } from '../../schemaTypes';
import type { PixelTransform } from '../types';

function array2Matrix(hc: number[] | null | undefined): number[][] | null {
  if (!hc || hc.length !== 9) return null;
  return [hc.slice(0, 3), hc.slice(3, 6), hc.slice(6, 9)];
}

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

// Returns identity transforms with noHomography:true when the homography is missing/malformed.
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
