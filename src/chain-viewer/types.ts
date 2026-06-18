import type { ImageNeighbourType, ImageType } from '../schemaTypes';
import type { PixelTransform } from '../individual-id/types';

/**
 * Minimal annotation shape pulled up-front for the chain viewer. Image and
 * camera details are fetched lazily per chain via the harness, so we keep
 * the bulk fetch narrow.
 */
export interface ChainAnnotation {
  id: string;
  x: number;
  y: number;
  imageId: string;
  objectId: string | null;
  categoryId: string;
  obscured: boolean;
  /** True for "out of view" rows — animal is on this image but not visible (placeholder x/y). */
  oov: boolean;
  /** Image capture time (epoch seconds). Used to order annotations within a chain. */
  imageTimestamp: number | null;
}

/**
 * A group of annotations sharing the same objectId. `primaryId` is the
 * canonical objectId for the chain. `categoryId` reflects the primary
 * annotation; secondary annotations in a chain should agree but we don't
 * enforce.
 */
export interface Chain {
  primaryId: string;
  categoryId: string;
  annotations: ChainAnnotation[];
}

/**
 * Per-annotation image / camera metadata fetched on demand the first time a
 * chain becomes the current view. Keyed by annotation id.
 */
export interface AnnotationImageMeta {
  imageId: string;
  width: number;
  height: number;
  originalPath: string | null;
  cameraId: string | null;
  cameraName: string | null;
  cameraSerial: string | null;
  sourceKey: string | null;
}

/**
 * A pair shown by the herd viewer. Same-camera pairs are synthetic chronological
 * adjacencies and therefore have no neighbour row; camera crossovers always
 * carry the registered neighbour that supplies their homography.
 */
export interface HerdDisplayPair {
  /** Stable id of the chain-connected image component this pair belongs to. */
  herdId: string;
  image1Id: string;
  image2Id: string;
  forward: PixelTransform;
  backward: PixelTransform;
  noHomography: boolean;
  skipped: boolean;
  imageA: ImageType;
  imageB: ImageType;
  rawNeighbour?: ImageNeighbourType;
  crossover: boolean;
}
