import computeMunkres from 'munkres-js';
import type { AnnotationType, ImageType } from '../../schemaTypes';
import type { MatchCandidate, PixelTransform } from '../types';
import { projectsInside } from './transforms';

/**
 * Cost the algorithm assigns to "leave this annotation unmatched". This is the
 * leniency slider — distances larger than this value will fall back to the
 * pad row instead of producing a match.
 */
export interface BuildCandidatesInput {
  annotationsA: AnnotationType[];
  annotationsB: AnnotationType[];
  imageA: ImageType;
  imageB: ImageType;
  /** Maps an A-coordinate to a B-coordinate. */
  forward: PixelTransform;
  /** Maps a B-coordinate to an A-coordinate. */
  backward: PixelTransform;
  /** Pixel distance above which the algorithm prefers leaving an annotation unmatched. */
  leniency: number;
  /** Optional: only consider these category ids (typically a single one). */
  categoryFilter?: string | string[];
}

const HARD_FORCE = -1_000_000;
const HARD_FORBID = 1_000_000;

function dist2(
  a: { x: number; y: number },
  b: { x: number; y: number }
): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function passesCategory(
  anno: AnnotationType,
  filter?: string | string[]
): boolean {
  if (!filter) return true;
  if (typeof filter === 'string') return anno.categoryId === filter;
  return filter.includes(anno.categoryId);
}

/**
 * A stable id for a match candidate. We prefer existing ObjectIds, then
 * existing annotation ids, then a deterministic hash of the two annotation
 * ids. This keeps identicons stable across re-renders (no random uuids).
 */
function makePairKey(a?: AnnotationType, b?: AnnotationType): string {
  return (
    a?.objectId ??
    b?.objectId ??
    a?.id ??
    b?.id ??
    `pair-${crypto.randomUUID()}`
  );
}

/**
 * Run the Hungarian algorithm on cross-image annotations and return a list of
 * `MatchCandidate`s. Each candidate is either:
 *   - both real (pre-existing match or strong proposal),
 *   - one real + one shadow (Munkres invented the shadow on the missing side).
 *
 * The returned candidates are all `status: 'pending'`. The caller is expected
 * to merge them with any prior working state for the same pair.
 *
 * Compared to `useOptimalAssignment`, this is a pure function — no React, no
 * subscriptions — so the harness can call it for any pair on demand.
 */
export function buildMatchCandidates({
  annotationsA,
  annotationsB,
  imageA,
  imageB,
  forward,
  backward,
  leniency,
  categoryFilter,
}: BuildCandidatesInput): MatchCandidate[] {
  const A = annotationsA.filter((a) => passesCategory(a, categoryFilter));
  const B = annotationsB.filter((a) => passesCategory(a, categoryFilter));

  if (A.length === 0 && B.length === 0) return [];

  // Pad to a square cost matrix. Pad rows/cols are "leave unmatched" with cost
  // = leniency. A real match's cost is the projected distance.
  const N = A.length + B.length;
  const cost: number[][] = Array.from({ length: N }, () =>
    Array<number>(N).fill(leniency)
  );

  for (let i = 0; i < A.length; i++) {
    const a = A[i];
    const projected = forward([a.x, a.y]);
    for (let j = 0; j < B.length; j++) {
      const b = B[j];
      // Pre-existing objectIds dominate everything.
      if (a.objectId && b.objectId) {
        cost[i][j] =
          a.objectId === b.objectId ? HARD_FORCE : HARD_FORBID;
        continue;
      }
      if (a.categoryId !== b.categoryId) {
        cost[i][j] = HARD_FORBID;
        continue;
      }
      cost[i][j] = dist2(
        { x: projected[0], y: projected[1] },
        { x: b.x, y: b.y }
      );
    }
  }

  const assignment = computeMunkres(cost) as [number, number][];
  const candidates: MatchCandidate[] = [];

  for (const [ai, bj] of assignment) {
    const a = A[ai];
    const b = B[bj];

    if (a && b) {
      // Real-real match (could be confirmed already, could be a new proposal).
      const pairKey = makePairKey(a, b);
      candidates.push({
        pairKey,
        categoryId: a.categoryId,
        realA: a,
        realB: b,
        posA: { x: a.x, y: a.y },
        posB: { x: b.x, y: b.y },
        isShadowA: false,
        isShadowB: false,
        status: a.objectId && a.objectId === b.objectId ? 'accepted' : 'pending',
      });
      continue;
    }

    if (a && !b) {
      // Annotation in A with no partner. If it projects into B we propose
      // a shadow on B side. If it projects OUTSIDE B's bounds we still
      // emit a marker on A side as `informational` — the user shouldn't
      // think the image is unannotated just because the annotation is in
      // a non-overlapping region. The candidate is excluded from the
      // linking workflow (navigation, lock/accept, completion).
      const inside = projectsInside(a.x, a.y, forward, imageB.width, imageB.height);
      const pairKey = makePairKey(a);
      if (inside) {
        const projected = forward([a.x, a.y]);
        candidates.push({
          pairKey,
          categoryId: a.categoryId,
          realA: a,
          realB: undefined,
          posA: { x: a.x, y: a.y },
          posB: {
            x: Math.round(projected[0]),
            y: Math.round(projected[1]),
          },
          isShadowA: false,
          isShadowB: true,
          status: 'pending',
        });
      } else {
        candidates.push({
          pairKey,
          categoryId: a.categoryId,
          realA: a,
          realB: undefined,
          posA: { x: a.x, y: a.y },
          posB: null,
          isShadowA: false,
          isShadowB: false,
          status: 'pending',
          informational: true,
        });
      }
      continue;
    }

    if (!a && b) {
      const inside = projectsInside(b.x, b.y, backward, imageA.width, imageA.height);
      const pairKey = makePairKey(undefined, b);
      if (inside) {
        const projected = backward([b.x, b.y]);
        candidates.push({
          pairKey,
          categoryId: b.categoryId,
          realA: undefined,
          realB: b,
          posA: {
            x: Math.round(projected[0]),
            y: Math.round(projected[1]),
          },
          posB: { x: b.x, y: b.y },
          isShadowA: true,
          isShadowB: false,
          status: 'pending',
        });
      } else {
        candidates.push({
          pairKey,
          categoryId: b.categoryId,
          realA: undefined,
          realB: b,
          posA: null,
          posB: { x: b.x, y: b.y },
          isShadowA: false,
          isShadowB: false,
          status: 'pending',
          informational: true,
        });
      }
      continue;
    }
    // pad-pad: nothing to do.
  }

  return candidates;
}
