/**
 * Apply a 3x3 homography matrix (flat 9-element array) to a point (x, y).
 * Uses homogeneous coordinates: [x', y', w'] = H * [x, y, 1]
 * Returns [x'/w', y'/w']
 */
export function applyHomography(H: number[], x: number, y: number): [number, number] {
  const xp = H[0] * x + H[1] * y + H[2];
  const yp = H[3] * x + H[4] * y + H[5];
  const wp = H[6] * x + H[7] * y + H[8];
  if (Math.abs(wp) < 1e-15) {
    throw new Error('Homography maps point to infinity (w ~= 0)');
  }
  return [xp / wp, yp / wp];
}

/**
 * Invert a 3x3 matrix (flat 9-element array). Returns flat 9-element array.
 * Uses cofactor expansion / Cramer's rule.
 *
 * Matrix layout (row-major):
 *   [ a b c ]     [ H[0] H[1] H[2] ]
 *   [ d e f ]  =  [ H[3] H[4] H[5] ]
 *   [ g h i ]     [ H[6] H[7] H[8] ]
 */
export function invertHomography(H: number[]): number[] {
  const [a, b, c, d, e, f, g, h, i] = H;

  // Cofactors
  const A = e * i - f * h;
  const B = -(d * i - f * g);
  const C = d * h - e * g;
  const D = -(b * i - c * h);
  const E = a * i - c * g;
  const F = -(a * h - b * g);
  const G = b * f - c * e;
  const HH = -(a * f - c * d);
  const I = a * e - b * d;

  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-15) {
    throw new Error('Matrix is singular, cannot invert');
  }

  const invDet = 1.0 / det;

  // Transpose of cofactor matrix divided by determinant
  return [
    A * invDet, D * invDet, G * invDet,
    B * invDet, E * invDet, HH * invDet,
    C * invDet, F * invDet, I * invDet,
  ];
}

/**
 * Project the 4 corners of an image (0,0), (w,0), (w,h), (0,h) through homography H.
 * Returns array of [x,y] points.
 */
export function projectCorners(H: number[], w: number, h: number): [number, number][] {
  return [
    applyHomography(H, 0, 0),
    applyHomography(H, w, 0),
    applyHomography(H, w, h),
    applyHomography(H, 0, h),
  ];
}

/**
 * Sutherland-Hodgman polygon clipping against a rectangle [0,0,w,h].
 * Clips sequentially against each of the 4 edges: left (x=0), right (x=w), bottom (y=0), top (y=h).
 * Returns clipped polygon vertices, or empty array if no overlap.
 */
export function clipPolygonToRect(
  polygon: [number, number][],
  w: number,
  h: number,
): [number, number][] {
  if (polygon.length === 0) return [];

  type Edge = (p: [number, number]) => boolean;
  type Intersect = (a: [number, number], b: [number, number]) => [number, number];

  const edges: { inside: Edge; intersect: Intersect }[] = [
    // Left edge: x >= 0
    {
      inside: (p) => p[0] >= 0,
      intersect: (a, b) => {
        const t = (0 - a[0]) / (b[0] - a[0]);
        return [0, a[1] + t * (b[1] - a[1])];
      },
    },
    // Right edge: x <= w
    {
      inside: (p) => p[0] <= w,
      intersect: (a, b) => {
        const t = (w - a[0]) / (b[0] - a[0]);
        return [w, a[1] + t * (b[1] - a[1])];
      },
    },
    // Bottom edge: y >= 0
    {
      inside: (p) => p[1] >= 0,
      intersect: (a, b) => {
        const t = (0 - a[1]) / (b[1] - a[1]);
        return [a[0] + t * (b[0] - a[0]), 0];
      },
    },
    // Top edge: y <= h
    {
      inside: (p) => p[1] <= h,
      intersect: (a, b) => {
        const t = (h - a[1]) / (b[1] - a[1]);
        return [a[0] + t * (b[0] - a[0]), h];
      },
    },
  ];

  let output: [number, number][] = [...polygon];

  for (const edge of edges) {
    if (output.length === 0) return [];

    const input = output;
    output = [];

    for (let i = 0; i < input.length; i++) {
      const current = input[i];
      const previous = input[(i + input.length - 1) % input.length];

      const currInside = edge.inside(current);
      const prevInside = edge.inside(previous);

      if (currInside) {
        if (!prevInside) {
          // Entering: add intersection then current
          output.push(edge.intersect(previous, current));
        }
        output.push(current);
      } else if (prevInside) {
        // Leaving: add intersection
        output.push(edge.intersect(previous, current));
      }
      // Both outside: add nothing
    }
  }

  return output;
}

/**
 * Ray-casting point-in-polygon test.
 */
export function pointInPolygon(x: number, y: number, polygon: [number, number][]): boolean {
  let inside = false;
  const n = polygon.length;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Compute area of a polygon using the shoelace formula.
 * Returns the absolute area.
 */
export function polygonArea(polygon: [number, number][]): number {
  const n = polygon.length;
  if (n < 3) return 0;

  let area = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += polygon[i][0] * polygon[j][1];
    area -= polygon[j][0] * polygon[i][1];
  }

  return Math.abs(area) / 2;
}
