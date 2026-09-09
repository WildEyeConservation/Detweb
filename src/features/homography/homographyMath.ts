import { Matrix, matrix, multiply, transpose, inv } from 'mathjs';

export type Point = { id: string; x: number; y: number };

function buildDesignMatrix(points1: Point[], points2: Point[]) {
  // Build A (2N x 8) and b (2N x 1) for least squares with h33 fixed to 1
  const rows: number[][] = [];
  const b: number[] = [];
  for (let i = 0; i < Math.min(points1.length, points2.length); i++) {
    const { x, y } = points1[i];
    const { x: xp, y: yp } = points2[i];
    rows.push([x, y, 1, 0, 0, 0, -x * xp, -y * xp]);
    b.push(xp);
    rows.push([0, 0, 0, x, y, 1, -x * yp, -y * yp]);
    b.push(yp);
  }
  return { A: matrix(rows), b: matrix(b) };
}

export const MIN_HOMOGRAPHY_POINTS = 4;

export function solveHomography(points1: Point[], points2: Point[]): Matrix | null {
  if (points1.length < MIN_HOMOGRAPHY_POINTS || points2.length < MIN_HOMOGRAPHY_POINTS) return null;
  const { A, b } = buildDesignMatrix(points1, points2);
  // Normal equations: (A^T A) u = A^T b
  const At = transpose(A) as Matrix;
  const AtA = multiply(At, A) as Matrix;
  const Atb = multiply(At, b) as Matrix;
  // Solve using inverse (sufficient for small 8x8)
  const u = multiply(inv(AtA), Atb) as Matrix; // 8x1

  const h11 = u.get([0]);
  const h12 = u.get([1]);
  const h13 = u.get([2]);
  const h21 = u.get([3]);
  const h22 = u.get([4]);
  const h23 = u.get([5]);
  const h31 = u.get([6]);
  const h32 = u.get([7]);
  const H = matrix([
    [h11, h12, h13],
    [h21, h22, h23],
    [h31, h32, 1],
  ]);
  return H;
}

/**
 * Compute per-point symmetric reprojection error.
 * For each pair, measures how far H(p1) is from p2 AND how far H_inv(p2) is from p1,
 * then returns the RMS of both directions per point.
 */
export function computeReprojectionErrors(
  points1: Point[],
  points2: Point[]
): number[] | null {
  const n = Math.min(points1.length, points2.length);
  if (n < MIN_HOMOGRAPHY_POINTS) return null;
  const H = solveHomography(
    points1.slice(0, n),
    points2.slice(0, n)
  );
  if (!H) return null;

  let Hinv: Matrix;
  try {
    Hinv = inv(H);
  } catch {
    return null;
  }

  const apply = (M: Matrix, x: number, y: number): [number, number] => {
    const r = multiply(M, [x, y, 1]).valueOf() as number[];
    return [r[0] / r[2], r[1] / r[2]];
  };

  const errors: number[] = [];
  for (let i = 0; i < n; i++) {
    const [px, py] = apply(H, points1[i].x, points1[i].y);
    const fwdErr2 = (px - points2[i].x) ** 2 + (py - points2[i].y) ** 2;

    const [qx, qy] = apply(Hinv, points2[i].x, points2[i].y);
    const bwdErr2 = (qx - points1[i].x) ** 2 + (qy - points1[i].y) ** 2;

    errors.push(Math.sqrt((fwdErr2 + bwdErr2) / 2));
  }
  return errors;
}
