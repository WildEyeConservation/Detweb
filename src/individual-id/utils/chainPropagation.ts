import type { AnnotationType, ImageType } from '../../schemaTypes';
import type {
  ChainedPath,
  MatchCandidate,
  NeighbourPairWithMeta,
} from '../types';
import { isOov } from './identity';
import { makePairKey } from '../hooks/usePairWorkingState';

/** Minimum hops we consider — direct neighbours (hops=1) are Munkres' job. */
const CHAIN_MIN_HOPS = 2;

export interface BuildChainProposalsInput {
  pairs: NeighbourPairWithMeta[];
  annotationsByImage: Record<string, AnnotationType[]>;
  imagesById: Record<string, ImageType>;
  chainedTransforms: Map<string, Map<string, ChainedPath>>;
  /**
   * Anchor convergence radius (image pixels). If a real annotation in the
   * anchor image is within this distance of the projected position, the
   * chain converges onto that annotation instead of proposing a fresh
   * positioned shadow — accepting then merges the two chains.
   */
  leniency: number;
  categoryId?: string;
}

/**
 * Walks the chained-transform graph from every real annotation and emits
 * per-pair chain proposals: a real annotation links to an in-frame anchor
 * in an indirect neighbour (hops >= 2), with proposed-OOV markers on every
 * intermediate image of the path.
 *
 * The pass adapts as the chain commits in stages:
 *
 *  - Edges where BOTH sides already have chain members (the seed's
 *    `objectId`) are skipped — Munkres handles those via its OOV branch.
 *  - Edges where one side has a chain member (typically an OOV row created
 *    by an earlier accept) emit a candidate with the existing member as
 *    `realA`/`realB` (and `oovSide` if it's OOV) plus a `proposedOov*` flag
 *    on the other side, so the chain continues to extend.
 *  - At the last (anchor) edge, if a same-category real within `leniency`
 *    sits near the projected position, that real becomes the anchor
 *    (cross-chain convergence — accept merges the two chains). Otherwise
 *    the anchor renders as a positioned shadow at the predicted location.
 *
 * Returned shape: pairKey (`imageAId__imageBId`) → list of chain candidates.
 * The harness splices these alongside Munkres output; pair-view merge
 * logic decides per pairKey collision whether to enrich or skip.
 */
export function buildChainProposals({
  pairs,
  annotationsByImage,
  imagesById,
  chainedTransforms,
  leniency,
  categoryId,
}: BuildChainProposalsInput): Map<string, MatchCandidate[]> {
  const pairByEdge = new Map<string, NeighbourPairWithMeta>();
  for (const p of pairs) {
    pairByEdge.set(`${p.image1Id}__${p.image2Id}`, p);
    pairByEdge.set(`${p.image2Id}__${p.image1Id}`, p);
  }

  const out = new Map<string, MatchCandidate[]>();
  const emitted = new Set<string>();
  const push = (pkey: string, cand: MatchCandidate) => {
    const dedup = `${pkey}__${cand.pairKey}`;
    if (emitted.has(dedup)) return;
    emitted.add(dedup);
    let arr = out.get(pkey);
    if (!arr) {
      arr = [];
      out.set(pkey, arr);
    }
    arr.push(cand);
  };

  for (const [sourceId, reachable] of chainedTransforms.entries()) {
    const anns = annotationsByImage[sourceId] ?? [];
    for (const a of anns) {
      if (isOov(a)) continue;
      if (categoryId && a.categoryId !== categoryId) continue;

      // Closest indirect anchor wins. Within an in-frame candidate we also
      // look for a same-category real annotation within `leniency` to
      // converge with.
      const sorted = Array.from(reachable.entries()).sort(
        (p, q) => p[1].hops - q[1].hops
      );
      let anchorPath: ChainedPath | null = null;
      let anchorPos: [number, number] | null = null;
      let anchorRealMatch: AnnotationType | null = null;
      for (const [targetId, path] of sorted) {
        if (path.hops < CHAIN_MIN_HOPS) continue;
        const targetImg = imagesById[targetId];
        if (!targetImg) continue;
        const proj = path.forward([a.x, a.y]);
        const px = proj[0];
        const py = proj[1];
        if (
          px < 0 ||
          py < 0 ||
          px >= targetImg.width ||
          py >= targetImg.height
        ) {
          continue;
        }
        let bestMatch: AnnotationType | null = null;
        let bestDist = Infinity;
        const targetAnns = annotationsByImage[targetId] ?? [];
        for (const b of targetAnns) {
          if (isOov(b)) continue;
          if (categoryId && b.categoryId !== categoryId) continue;
          // Same-chain members are handled in the per-edge logic below.
          if (
            a.objectId &&
            (b.objectId === a.objectId || b.id === a.objectId)
          ) {
            continue;
          }
          const dx = b.x - px;
          const dy = b.y - py;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d <= leniency && d < bestDist) {
            bestDist = d;
            bestMatch = b;
          }
        }
        anchorPath = path;
        anchorPos = [px, py];
        anchorRealMatch = bestMatch;
        break;
      }

      if (!anchorPath || !anchorPos) continue;

      // Skip seeding when the anchor image already contains a same-chain
      // member — there's nothing left for the chain to add. Per-edge logic
      // handles partial coverage.
      if (a.objectId) {
        const anchorImgId = anchorPath.imageIds[anchorPath.imageIds.length - 1];
        const targetAnns = annotationsByImage[anchorImgId] ?? [];
        const anchorAlreadyChained = targetAnns.some(
          (b) => b.objectId === a.objectId || b.id === a.objectId
        );
        if (anchorAlreadyChained) continue;
      }

      const chainKey = a.objectId ?? a.id;
      const ids = anchorPath.imageIds;

      for (let i = 0; i < ids.length - 1; i++) {
        const fromId = ids[i];
        const toId = ids[i + 1];
        const pair = pairByEdge.get(`${fromId}__${toId}`);
        if (!pair) continue;
        const pkey = makePairKey(pair.image1Id, pair.image2Id);
        const fromIsA = pair.image1Id === fromId;
        const isLastEdge = i === ids.length - 2;
        const fromWhich: 'A' | 'B' = fromIsA ? 'A' : 'B';
        const toWhich: 'A' | 'B' = fromIsA ? 'B' : 'A';

        // Existing same-chain members on each side.
        let fromMember: AnnotationType | null = null;
        let toMember: AnnotationType | null = null;
        if (a.objectId) {
          fromMember =
            (annotationsByImage[fromId] ?? []).find(
              (b) =>
                b.objectId === a.objectId || b.id === a.objectId
            ) ?? null;
          toMember =
            (annotationsByImage[toId] ?? []).find(
              (b) =>
                b.objectId === a.objectId || b.id === a.objectId
            ) ?? null;
        } else if (fromId === sourceId) {
          fromMember = a;
        }

        // Cross-chain anchor: same-category real near the projected pos.
        if (isLastEdge && !toMember && anchorRealMatch) {
          toMember = anchorRealMatch;
        }

        if (fromMember && toMember) continue; // Munkres handles fully-bridged edges.

        const candidate: MatchCandidate = {
          pairKey: chainKey,
          categoryId: a.categoryId,
          posA: null,
          posB: null,
          isShadowA: false,
          isShadowB: false,
          status: 'pending',
        };

        const fillReal = (which: 'A' | 'B', member: AnnotationType) => {
          const oov = isOov(member);
          if (which === 'A') {
            candidate.realA = member;
            if (!oov) candidate.posA = { x: member.x, y: member.y };
            if (oov) candidate.oovSide = 'A';
          } else {
            candidate.realB = member;
            if (!oov) candidate.posB = { x: member.x, y: member.y };
            if (oov) candidate.oovSide = 'B';
          }
        };

        if (fromMember) {
          fillReal(fromWhich, fromMember);
        } else if (fromWhich === 'A') {
          candidate.proposedOovA = true;
        } else {
          candidate.proposedOovB = true;
        }

        if (toMember) {
          fillReal(toWhich, toMember);
        } else if (isLastEdge) {
          // Positioned shadow at the predicted anchor location.
          if (toWhich === 'A') {
            candidate.posA = {
              x: Math.round(anchorPos[0]),
              y: Math.round(anchorPos[1]),
            };
            candidate.isShadowA = true;
          } else {
            candidate.posB = {
              x: Math.round(anchorPos[0]),
              y: Math.round(anchorPos[1]),
            };
            candidate.isShadowB = true;
          }
        } else if (toWhich === 'A') {
          candidate.proposedOovA = true;
        } else {
          candidate.proposedOovB = true;
        }

        push(pkey, candidate);
      }
    }
  }

  return out;
}
