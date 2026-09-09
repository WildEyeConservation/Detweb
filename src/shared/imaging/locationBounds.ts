/**
 * Whether a point falls within a location's bounds. Locations store a centre
 * point plus width/height, so the test is against half-extents. The boundary
 * itself counts as inside.
 */
export function isWithinLocationBounds(
  point: { x: number; y: number },
  location: {
    x: number;
    y: number;
    width?: number | null;
    height?: number | null;
  }
): boolean {
  return (
    Math.abs(point.x - location.x) <= (location.width ?? 0) / 2 &&
    Math.abs(point.y - location.y) <= (location.height ?? 0) / 2
  );
}
