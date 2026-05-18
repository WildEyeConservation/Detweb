import type {
  AnnotationType,
  ImageNeighbourType,
  ImageType,
} from '../../schemaTypes';
import { buildNeighbourTransforms } from './transforms';
import { buildMatchCandidates } from './munkres';
import { evaluatePairCompletion } from './completion';

/**
 * Munkres "leave unmatched" cost the harness opens every transect with
 * (IndividualIdHarness DEFAULT_LENIENCY). The launch-time completeness check
 * must use the same baseline so it agrees with what a user would see the
 * instant they take the transect.
 */
export const DEFAULT_INDIVIDUAL_ID_LENIENCY = 40;

export interface TransectCompletenessInput {
  /** Every project image, keyed by id (needs width/height for projectsInside). */
  imagesById: Record<string, ImageType>;
  /** transectId -> the ids of its images. */
  imageIdsByTransect: Map<string, Set<string>>;
  /** Project ImageNeighbour rows, already de-duped and skip-filtered. */
  rawNeighbours: ImageNeighbourType[];
  /** Annotations of the selected category only, indexed by imageId. */
  annotationsByImage: Record<string, AnnotationType[]>;
  categoryId: string;
  leniency?: number;
}

/**
 * Returns the transect ids that still have at least one *incomplete* pair for
 * the given category — the only transects worth launching an Individual ID
 * job for. This mirrors exactly how the harness decides a transect is done:
 * `buildMatchCandidates` + `evaluatePairCompletion` per registerable pair, a
 * transect being complete when no pair is `incomplete`.
 *
 * A transect with no registerable pair (no within-transect, non-skipped
 * neighbour carrying a valid homography) is treated as "no work" and omitted —
 * the same rows launchIndividualId already filters out, and the ones the
 * harness completion detector can never fire for.
 *
 * Pair orientation (which image is A vs B) is irrelevant here: swapping A/B
 * also swaps forward/backward, so the set of linkable-vs-informational
 * candidates and their accepted status are invariant. We therefore skip the
 * harness's chronological A/B normalisation and feed image1→A, image2→B.
 */
export function findIncompleteTransectIds(
  input: TransectCompletenessInput
): string[] {
  const {
    imagesById,
    imageIdsByTransect,
    rawNeighbours,
    annotationsByImage,
    categoryId,
  } = input;
  const leniency = input.leniency ?? DEFAULT_INDIVIDUAL_ID_LENIENCY;

  const transectOf = new Map<string, string>();
  for (const [tId, ids] of imageIdsByTransect) {
    for (const id of ids) transectOf.set(id, tId);
  }

  const neighboursByTransect = new Map<string, ImageNeighbourType[]>();
  for (const n of rawNeighbours) {
    const t1 = transectOf.get(n.image1Id);
    const t2 = transectOf.get(n.image2Id);
    if (!t1 || t1 !== t2) continue; // cross-transect / unassigned: not a pair
    let arr = neighboursByTransect.get(t1);
    if (!arr) {
      arr = [];
      neighboursByTransect.set(t1, arr);
    }
    arr.push(n);
  }

  const incomplete: string[] = [];
  for (const [tId, neighbours] of neighboursByTransect) {
    let hasPair = false;
    let anyIncomplete = false;
    for (const n of neighbours) {
      const tfs = buildNeighbourTransforms(n);
      if (tfs.noHomography) continue;
      const imageA = imagesById[n.image1Id];
      const imageB = imagesById[n.image2Id];
      if (!imageA || !imageB) continue;
      hasPair = true;
      const candidates = buildMatchCandidates({
        annotationsA: annotationsByImage[n.image1Id] ?? [],
        annotationsB: annotationsByImage[n.image2Id] ?? [],
        imageA,
        imageB,
        forward: tfs.forward,
        backward: tfs.backward,
        leniency,
        categoryFilter: categoryId,
      });
      if (evaluatePairCompletion(candidates).status === 'incomplete') {
        anyIncomplete = true;
        break;
      }
    }
    if (hasPair && anyIncomplete) incomplete.push(tId);
  }
  return incomplete;
}
