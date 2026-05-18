import type {
  AnnotationType,
  ImageNeighbourType,
  ImageType,
} from '../../schemaTypes';
import { buildNeighbourTransforms } from './transforms';
import { buildMatchCandidates } from './munkres';
import { evaluatePairCompletion } from './completion';

// Must match IndividualIdHarness DEFAULT_LENIENCY so launch-time completeness agrees with runtime.
export const DEFAULT_INDIVIDUAL_ID_LENIENCY = 40;

export interface TransectCompletenessInput {
  imagesById: Record<string, ImageType>;
  imageIdsByTransect: Map<string, Set<string>>;
  rawNeighbours: ImageNeighbourType[];
  annotationsByImage: Record<string, AnnotationType[]>;
  categoryId: string;
  leniency?: number;
}

// Pair orientation is irrelevant — swapping A/B also swaps forward/backward, so candidate sets are invariant.
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
    if (!t1 || t1 !== t2) continue;
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
