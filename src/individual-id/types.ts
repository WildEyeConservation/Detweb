import type {
  AnnotationType,
  ImageNeighbourType,
  ImageType,
} from '../schemaTypes';

/**
 * A 2D pixel→pixel transform produced from a homography matrix. Always pure;
 * never reads from React state.
 */
export type PixelTransform = (c: [number, number]) => [number, number];

/**
 * A neighbour pair augmented with its forward and backward transform functions.
 * `noHomography` is true when the database row had a missing or invalid
 * homography. We deliberately exclude these from the individual-id workflow —
 * they are owned by the homography workflow.
 */
export interface NeighbourPair {
  image1Id: string;
  image2Id: string;
  /** Maps a coordinate in image1 to its predicted location in image2. */
  forward: PixelTransform;
  /** Maps a coordinate in image2 to its predicted location in image1. */
  backward: PixelTransform;
  noHomography: boolean;
  skipped: boolean;
}

/**
 * Status of a single annotation candidate inside a pair.
 *
 * `pending`  — proposed by Munkres or moved by the user, NOT committed yet.
 * `locked`   — user pressed space once: position is frozen for this candidate.
 * `accepted` — user pressed space twice: objectId written to DB on both sides.
 */
export type CandidateStatus = 'pending' | 'locked' | 'accepted';

/**
 * A single match candidate inside a pair: zero, one, or two real annotations
 * plus optional shadow positions on each side. Identified by `pairKey` which
 * is the same on both sides (used as the working `objectId`).
 */
export interface MatchCandidate {
  /** Stable id used as `proposedObjectId` and eventually as the linked `objectId`. */
  pairKey: string;
  /** The category every annotation in this candidate must share. */
  categoryId: string;
  /** Real annotation in image1, if any. */
  realA?: AnnotationType;
  /** Real annotation in image2, if any. */
  realB?: AnnotationType;
  /**
   * The position the user has dragged the marker on side A to. If realA exists
   * but is not yet accepted, `posA` may differ from `realA.{x,y}`.
   */
  posA: { x: number; y: number } | null;
  posB: { x: number; y: number } | null;
  /** True when side A is a Munkres-proposed shadow (no realA yet). */
  isShadowA: boolean;
  isShadowB: boolean;
  status: CandidateStatus;
  /**
   * Real annotation that has no partner in the overlap region — its
   * projected position falls outside the other image's bounds, so there's
   * nothing in this pair to link it to. Marker is still rendered so the
   * user knows the image is annotated; navigation, locking and completion
   * all skip it. The hover popup (Change Label, Delete) still works.
   */
  informational?: boolean;
}

export interface PairCompletionState {
  status: 'complete' | 'incomplete' | 'empty';
  /** Number of candidates that still need attention. */
  remaining: number;
  total: number;
}

export interface NeighbourPairWithMeta extends NeighbourPair {
  imageA: ImageType;
  imageB: ImageType;
  rawNeighbour: ImageNeighbourType;
}
