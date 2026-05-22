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

// True if any image strictly between source and anchor on this path has a
// same-category real (not in the source's chain) within `leniency` of the
// projected source position. Such a real means the animal is visible
// there — Munkres on the direct (source, intermediate) pair already
// handles that match, and proposing an OOV alongside it would create a
// duplicate with a foreign name.
function pathPassesThroughForeignReal(
  source: AnnotationType,
  path: ChainedPath,
  reachedFromSource: Map<string, ChainedPath>,
  annotationsByImage: Record<string, AnnotationType[]>,
  imagesById: Record<string, ImageType>,
  leniency: number,
  categoryId?: string
): boolean {
  for (let i = 1; i < path.imageIds.length - 1; i++) {
    const interId = path.imageIds[i];
    const interImg = imagesById[interId];
    if (!interImg) continue;
    const interPath = reachedFromSource.get(interId);
    if (!interPath) continue;
    const [px, py] = interPath.forward([source.x, source.y]);
    if (px < 0 || py < 0 || px >= interImg.width || py >= interImg.height) {
      continue;
    }
    const anns = annotationsByImage[interId] ?? [];
    for (const b of anns) {
      if (isOov(b)) continue;
      if (categoryId && b.categoryId !== categoryId) continue;
      // Same-chain reals don't block — the chain legitimately extends through them.
      if (
        source.objectId &&
        (b.objectId === source.objectId || b.id === source.objectId)
      ) {
        continue;
      }
      const dx = b.x - px;
      const dy = b.y - py;
      if (Math.sqrt(dx * dx + dy * dy) <= leniency) return true;
    }
  }
  return false;
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
        // Don't propagate the chain through an intermediate image that
        // already has a same-category real near the projection — Munkres
        // on the direct pair handles that match, and an OOV alongside
        // the real would surface under a foreign chain name.
        if (
          pathPassesThroughForeignReal(
            a,
            path,
            reachable,
            annotationsByImage,
            imagesById,
            leniency,
            categoryId
          )
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

        // Position the source projection on `imageId` (or null if it doesn't
        // project in-frame). Source's own image returns its real coordinates.
        // Used to classify a non-member side as positioned shadow (in-frame)
        // vs OOV (out-of-frame) — the chain only proposes OOV where the
        // animal is genuinely hidden, mirroring what Munkres would do on a
        // direct pair.
        const projectOnto = (
          imageId: string
        ): { x: number; y: number } | null => {
          if (imageId === sourceId) return { x: a.x, y: a.y };
          const path = reachable.get(imageId);
          if (!path) return null;
          const [px, py] = path.forward([a.x, a.y]);
          const img = imagesById[imageId];
          if (!img) return null;
          if (px < 0 || py < 0 || px >= img.width || py >= img.height) {
            return null;
          }
          return { x: Math.round(px), y: Math.round(py) };
        };

        const placeNonMemberSide = (which: 'A' | 'B', imageId: string) => {
          const pos = projectOnto(imageId);
          if (pos) {
            if (which === 'A') {
              candidate.posA = pos;
              candidate.isShadowA = true;
            } else {
              candidate.posB = pos;
              candidate.isShadowB = true;
            }
          } else {
            if (which === 'A') candidate.proposedOovA = true;
            else candidate.proposedOovB = true;
          }
        };

        if (fromMember) {
          fillReal(fromWhich, fromMember);
        } else {
          placeNonMemberSide(fromWhich, fromId);
        }

        if (toMember) {
          fillReal(toWhich, toMember);
        } else if (isLastEdge) {
          // The anchor's projection is already computed at the top of the
          // anchor-selection loop; reuse it so the marker position matches
          // the in-frame check exactly.
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
        } else {
          placeNonMemberSide(toWhich, toId);
        }

        push(pkey, candidate);
      }
    }
  }

  return out;
}
