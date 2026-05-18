import type { NeighbourPairWithMeta, PairCompletionState } from '../types';

// entries are flat pair indices — lanes are presentation-only; navigation uses the flat index.
export interface Lane {
  cameraId: string;
  label: string;
  entries: number[];
}

// Cross-camera pairs appear in BOTH lanes (same flat index, two rows) so clicking either jumps to the same pair.
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

// keepIndex is always retained so the active marker stays visible regardless of completion state.
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
