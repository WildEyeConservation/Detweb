import type { NeighbourPairWithMeta, PairCompletionState } from '../types';

/**
 * One camera's row in the progress bar. `entries` are indices into the flat,
 * globally-sorted pairs/pairViews array — the lanes are a pure presentation
 * grouping, the harness still navigates by flat index.
 */
export interface Lane {
  /** Camera id this lane represents. '' for images with no cameraId. */
  cameraId: string;
  label: string;
  entries: number[];
}

/**
 * Group pairs into per-camera lanes.
 *
 * A same-camera pair lands in its one camera lane. A cross-camera pair is
 * injected into BOTH camera lanes — it's one logical pair (one index) shown
 * in two rows, so clicking it in either lane jumps to the same pair.
 *
 * `pairs` is assumed globally sorted (imageA.timestamp ascending). Within a
 * lane, entries are re-sorted by the timestamp of the image on *that* lane's
 * camera, so a cross-camera pair sits chronologically correctly in each row.
 *
 * Single camera (or every image missing cameraId) collapses to exactly one
 * lane, so the progress bar looks and behaves as it did before.
 */
export function buildLanes(
  pairs: NeighbourPairWithMeta[],
  cameraNamesById: Record<string, string>
): Lane[] {
  const byCamera = new Map<string, number[]>();
  const order: string[] = [];
  const touch = (cameraId: string, index: number) => {
    let arr = byCamera.get(cameraId);
    if (!arr) {
      arr = [];
      byCamera.set(cameraId, arr);
      order.push(cameraId);
    }
    arr.push(index);
  };

  pairs.forEach((p, i) => {
    const camA = p.imageA.cameraId ?? '';
    const camB = p.imageB.cameraId ?? '';
    touch(camA, i);
    if (camB !== camA) touch(camB, i);
  });

  const laneTimestamp = (
    cameraId: string,
    p: NeighbourPairWithMeta
  ): number => {
    const img =
      (p.imageA.cameraId ?? '') === cameraId ? p.imageA : p.imageB;
    return img.timestamp ?? 0;
  };

  return order.map((cameraId, laneIdx) => {
    const entries = byCamera.get(cameraId)!.slice();
    entries.sort((a, b) => {
      const ta = laneTimestamp(cameraId, pairs[a]);
      const tb = laneTimestamp(cameraId, pairs[b]);
      if (ta !== tb) return ta - tb;
      return a - b;
    });
    const label =
      (cameraId && cameraNamesById[cameraId]) || `Camera ${laneIdx + 1}`;
    return { cameraId, label, entries };
  });
}

/**
 * "Simple view" filter: within each lane keep only the pairs that still need
 * attention plus `radius` neighbours on each side (in lane display order),
 * dropping the long runs of already-done pairs that are just noise for the
 * 99% of users who only care about what's left.
 *
 * `keepIndex` (the currently-active flat pair index) is always kept, even if
 * it's a finished pair far from any incomplete one, so the active marker
 * stays visible and lane-relative navigation never loses its position.
 */
export function filterLanesToAttention(
  lanes: Lane[],
  states: PairCompletionState[],
  keepIndex: number,
  radius: number
): Lane[] {
  return lanes.map((lane) => {
    const { entries } = lane;
    const keep = new Array<boolean>(entries.length).fill(false);
    for (let i = 0; i < entries.length; i++) {
      if (entries[i] === keepIndex) keep[i] = true;
      if (states[entries[i]]?.status !== 'incomplete') continue;
      const lo = Math.max(0, i - radius);
      const hi = Math.min(entries.length - 1, i + radius);
      for (let j = lo; j <= hi; j++) keep[j] = true;
    }
    return { ...lane, entries: entries.filter((_, i) => keep[i]) };
  });
}
