// Timestamp-gap transect detection.
//
// The old turf-based approach (src/survey/DefineTransects.tsx) simplifies the
// GPS track and occasionally splits a straight line into two transects. For
// the Individual ID workflow we only need a "good enough 99% of the time"
// segmentation, so we use a far more robust signal: the time gap between
// consecutive images. Within a transect the aircraft photographs at a steady
// cadence (~1–3s); between transects it turns, producing a gap an order of
// magnitude larger. We split whenever a gap exceeds K × the median gap, with
// an absolute floor so a very tight cadence can't produce a tiny threshold.

export const SPLIT_GAP_FACTOR = 3;
// Real between-transect turns are tens of seconds to minutes; intra-transect
// jitter is a few seconds. 10s keeps us safely between the two.
export const SPLIT_GAP_FLOOR_MS = 10_000;

export type TimedImage = { id: string; timestamp: number | null | undefined };
export type TransectAssignment = { id: string; transectIndex: number };

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

// Image.timestamp is stored as an epoch value; some rows are seconds, some ms.
// Normalize to ms so deltas are comparable.
function normalizeToMillis(ts: number): number {
  return ts > 0 && ts < 1e12 ? ts * 1000 : ts;
}

/**
 * Assign each image a sequential transectIndex (0-based) based on timestamp
 * gaps. Images without a usable timestamp are kept in input order and never
 * trigger a split (they inherit the current transect).
 */
export function detectTransects(images: TimedImage[]): TransectAssignment[] {
  if (images.length === 0) return [];

  const withTs = images.map((img) => ({
    id: img.id,
    ts:
      typeof img.timestamp === 'number' && Number.isFinite(img.timestamp)
        ? normalizeToMillis(img.timestamp)
        : NaN,
  }));

  // Stable sort by timestamp; NaN timestamps sink to the end in original order.
  const sorted = withTs
    .map((v, i) => ({ ...v, i }))
    .sort((a, b) => {
      const aNaN = Number.isNaN(a.ts);
      const bNaN = Number.isNaN(b.ts);
      if (aNaN && bNaN) return a.i - b.i;
      if (aNaN) return 1;
      if (bNaN) return -1;
      return a.ts - b.ts || a.i - b.i;
    });

  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].ts;
    const cur = sorted[i].ts;
    if (Number.isFinite(prev) && Number.isFinite(cur)) {
      gaps.push(Math.max(cur - prev, 0));
    }
  }

  const threshold = Math.max(
    median(gaps) * SPLIT_GAP_FACTOR,
    SPLIT_GAP_FLOOR_MS
  );

  const assignments: TransectAssignment[] = [];
  let transectIndex = 0;
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const prev = sorted[i - 1].ts;
      const cur = sorted[i].ts;
      if (
        Number.isFinite(prev) &&
        Number.isFinite(cur) &&
        cur - prev > threshold
      ) {
        transectIndex++;
      }
    }
    assignments.push({ id: sorted[i].id, transectIndex });
  }

  return assignments;
}
