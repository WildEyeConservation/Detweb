import computeMunkres from 'munkres-js';
import type { AnnotationType, ImageType } from '../../schemaTypes';
import type { MatchCandidate, PixelTransform } from '../types';
import { isInOverlap } from './transforms';
import { isOov } from './identity';

export interface BuildCandidatesInput {
  annotationsA: AnnotationType[];
  annotationsB: AnnotationType[];
  imageA: ImageType;
  imageB: ImageType;
  forward: PixelTransform;
  backward: PixelTransform;
  leniency: number;
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

// Prefer existing ObjectIds so identicons stay stable across re-renders.
function makePairKey(a?: AnnotationType, b?: AnnotationType): string {
  return (
    a?.objectId ??
    b?.objectId ??
    a?.id ??
    b?.id ??
    `pair-${crypto.randomUUID()}`
  );
}

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
  const all_A = annotationsA.filter((a) => passesCategory(a, categoryFilter));
  const all_B = annotationsB.filter((a) => passesCategory(a, categoryFilter));

  // OOV annotations have no on-image position — handled separately at the end.
  const oovA = all_A.filter((a) => isOov(a));
  const oovB = all_B.filter((a) => isOov(a));
  const posAllA = all_A.filter((a) => !isOov(a));
  const posAllB = all_B.filter((a) => !isOov(a));

  // Positioned annotations already chained to an OOV on the other image must
  // stay out of the Munkres matrix — they'd get a phantom shadow on the missing side.
  const chainSet = (list: AnnotationType[]) => {
    const s = new Set<string>();
    for (const o of list) {
      if (o.objectId) s.add(o.objectId);
      s.add(o.id);
    }
    return s;
  };
  const oovChainOnA = chainSet(oovA);
  const oovChainOnB = chainSet(oovB);
  const linkedToOtherOov = (
    ann: AnnotationType,
    otherChain: Set<string>
  ) => !!ann.objectId && otherChain.has(ann.objectId);

  const A = posAllA.filter((a) => !linkedToOtherOov(a, oovChainOnB));
  const B = posAllB.filter((b) => !linkedToOtherOov(b, oovChainOnA));

  const candidates: MatchCandidate[] = [];

  if (A.length + B.length > 0) {
    // Pad to a square matrix; pad rows/cols represent "leave unmatched" at cost = leniency.
    const N = A.length + B.length;
    const cost: number[][] = Array.from({ length: N }, () =>
      Array<number>(N).fill(leniency)
    );

    for (let i = 0; i < A.length; i++) {
      const a = A[i];
      const projected = forward([a.x, a.y]);
      for (let j = 0; j < B.length; j++) {
        const b = B[j];
        if (a.objectId && b.objectId && a.objectId === b.objectId) {
          cost[i][j] = HARD_FORCE;
          continue;
        }
        // Different objectIds intentionally fall through to the distance cost so a cross-chain match can be proposed (accepting merges the two chains).
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

    for (const [ai, bj] of assignment) {
      const a = A[ai];
      const b = B[bj];

      if (a && b) {
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
          status:
            a.objectId && a.objectId === b.objectId ? 'accepted' : 'pending',
        });
        continue;
      }

      if (a && !b) {
        // Out-of-overlap annotations become `informational` — visible on the map but excluded from completion.
        const inside = isInOverlap(
          a.x,
          a.y,
          backward,
          imageB.width,
          imageB.height
        );
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
        const inside = isInOverlap(
          b.x,
          b.y,
          forward,
          imageA.width,
          imageA.height
        );
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
    }
  }

  const sharesChain = (p: AnnotationType, o: AnnotationType) =>
    (!!p.objectId && (p.objectId === o.objectId || p.objectId === o.id)) ||
    (!!o.objectId && o.objectId === p.id);

  const pushOov = (o: AnnotationType, side: 'A' | 'B') => {
    const others = side === 'A' ? posAllB : posAllA;
    const partner = others.find((p) => sharesChain(p, o));
    const pairKey = o.objectId ?? (partner && partner.objectId) ?? o.id;
    if (partner) {
      candidates.push({
        pairKey,
        categoryId: o.categoryId,
        realA: side === 'A' ? o : partner,
        realB: side === 'A' ? partner : o,
        posA: side === 'A' ? null : { x: partner.x, y: partner.y },
        posB: side === 'A' ? { x: partner.x, y: partner.y } : null,
        isShadowA: false,
        isShadowB: false,
        status: 'accepted',
        oovSide: side,
      });
    } else {
      candidates.push({
        pairKey,
        categoryId: o.categoryId,
        realA: side === 'A' ? o : undefined,
        realB: side === 'A' ? undefined : o,
        posA: null,
        posB: null,
        isShadowA: false,
        isShadowB: false,
        status: 'pending',
        oovSide: side,
      });
    }
  };
  for (const o of oovA) pushOov(o, 'A');
  for (const o of oovB) pushOov(o, 'B');

  return candidates;
}
