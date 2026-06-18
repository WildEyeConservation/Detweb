import type { ImageNeighbourType, ImageType } from '../../schemaTypes';
import { buildNeighbourTransforms } from '../../individual-id/utils/transforms';
import type { ChainAnnotation, HerdDisplayPair } from '../types';

const identity = (c: [number, number]): [number, number] => [c[0], c[1]];

function compareImages(a: ImageType, b: ImageType): number {
  const aTime = a.timestamp ?? null;
  const bTime = b.timestamp ?? null;
  if (aTime !== null && bTime !== null && aTime !== bTime) {
    return aTime - bTime;
  }
  if (aTime !== null && bTime === null) return -1;
  if (aTime === null && bTime !== null) return 1;
  const byPath = (a.originalPath ?? '').localeCompare(b.originalPath ?? '');
  return byPath !== 0 ? byPath : a.id.localeCompare(b.id);
}

function cameraKey(image: ImageType): string {
  // Missing camera metadata must not merge unrelated images into one group.
  return image.cameraId ?? `missing-camera:${image.id}`;
}

function pairKey(image1Id: string, image2Id: string): string {
  return image1Id < image2Id
    ? `${image1Id}::${image2Id}`
    : `${image2Id}::${image1Id}`;
}

function intersects(a: Set<string>, b: Set<string>): boolean {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  for (const value of small) if (large.has(value)) return true;
  return false;
}

class DisjointSet {
  private readonly parent = new Map<string, string>();

  add(value: string): void {
    if (!this.parent.has(value)) this.parent.set(value, value);
  }

  find(value: string): string {
    const parent = this.parent.get(value);
    if (parent === undefined) {
      this.parent.set(value, value);
      return value;
    }
    if (parent === value) return value;
    const root = this.find(parent);
    this.parent.set(value, root);
    return root;
  }

  union(a: string, b: string): boolean {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA === rootB) return false;
    this.parent.set(rootB, rootA);
    return true;
  }
}

function syntheticPair(
  herdId: string,
  image1: ImageType,
  image2: ImageType
): HerdDisplayPair {
  const swap = compareImages(image2, image1) < 0;
  const imageA = swap ? image2 : image1;
  const imageB = swap ? image1 : image2;
  return {
    herdId,
    image1Id: imageA.id,
    image2Id: imageB.id,
    forward: identity,
    backward: identity,
    noHomography: false,
    skipped: false,
    imageA,
    imageB,
    crossover: false,
  };
}

function crossoverPair(
  herdId: string,
  neighbour: ImageNeighbourType,
  image1: ImageType,
  image2: ImageType
): HerdDisplayPair | null {
  const transforms = buildNeighbourTransforms(neighbour);
  if (transforms.noHomography) return null;
  const swap = compareImages(image2, image1) < 0;
  const imageA = swap ? image2 : image1;
  const imageB = swap ? image1 : image2;
  return {
    herdId,
    image1Id: imageA.id,
    image2Id: imageB.id,
    forward: swap ? transforms.backward : transforms.forward,
    backward: swap ? transforms.forward : transforms.backward,
    noHomography: false,
    skipped: false,
    imageA,
    imageB,
    rawNeighbour: neighbour,
    crossover: true,
  };
}

function comparePairs(a: HerdDisplayPair, b: HerdDisplayPair): number {
  const byA = compareImages(a.imageA, b.imageA);
  return byA !== 0 ? byA : compareImages(a.imageB, b.imageB);
}

/**
 * Build a minimum same-camera forest for one herd.
 *
 * Consecutive sightings of each chain are sufficient candidate edges to
 * connect every image containing that chain. Kruskal then removes redundant
 * chain overlaps, so N connected images produce N-1 displayed pairs. Every
 * retained pair is guaranteed to share a chain.
 */
function cameraPairs(
  herdId: string,
  images: ImageType[],
  chainsByImage: Map<string, Set<string>>
): HerdDisplayPair[] {
  const imagesByChain = new Map<string, ImageType[]>();
  for (const image of images) {
    for (const chain of chainsByImage.get(image.id) ?? []) {
      const sightings = imagesByChain.get(chain);
      if (sightings) sightings.push(image);
      else imagesByChain.set(chain, [image]);
    }
  }

  const candidates = new Map<string, HerdDisplayPair>();
  for (const sightings of imagesByChain.values()) {
    sightings.sort(compareImages);
    for (let i = 1; i < sightings.length; i++) {
      const image1 = sightings[i - 1];
      const image2 = sightings[i];
      candidates.set(
        pairKey(image1.id, image2.id),
        syntheticPair(herdId, image1, image2)
      );
    }
  }

  const forest = new DisjointSet();
  for (const image of images) forest.add(image.id);
  return [...candidates.values()]
    .sort(comparePairs)
    .filter((pair) => forest.union(pair.image1Id, pair.image2Id));
}

/**
 * Build the chain viewer sequence.
 *
 * Chains define herds first: images are in the same herd only when connected
 * transitively by shared chain identities. Camera grouping is secondary. For
 * each herd we show a minimum same-camera forest, then only the earliest real
 * cross-camera neighbour needed to introduce each additional camera.
 *
 * Consequently every displayed pair shares at least one chain. Same-camera
 * pairs may be synthetic chronological adjacencies; cross-camera pairs always
 * use a registered homography neighbour.
 */
export function buildHerdDisplayPairs(
  imagesById: Record<string, ImageType>,
  rawNeighbours: ImageNeighbourType[],
  annotationsByImage: Record<string, ChainAnnotation[]>
): HerdDisplayPair[] {
  const chainsByImage = new Map<string, Set<string>>();
  const annotatedImages: ImageType[] = [];
  for (const [imageId, annotations] of Object.entries(annotationsByImage)) {
    const image = imagesById[imageId];
    if (!image) continue;
    const chains = new Set(annotations.map((a) => a.objectId ?? a.id));
    if (chains.size === 0) continue;
    chainsByImage.set(imageId, chains);
    annotatedImages.push(image);
  }
  annotatedImages.sort(compareImages);

  // Chain connectivity, not camera or neighbour connectivity, defines herds.
  const herdSet = new DisjointSet();
  const firstImageByChain = new Map<string, string>();
  for (const image of annotatedImages) {
    herdSet.add(image.id);
    for (const chain of chainsByImage.get(image.id) ?? []) {
      const firstImageId = firstImageByChain.get(chain);
      if (firstImageId) herdSet.union(firstImageId, image.id);
      else firstImageByChain.set(chain, image.id);
    }
  }

  const herdImages = new Map<string, ImageType[]>();
  for (const image of annotatedImages) {
    const root = herdSet.find(image.id);
    const images = herdImages.get(root);
    if (images) images.push(image);
    else herdImages.set(root, [image]);
  }
  const herds = [...herdImages.entries()]
    .map(([herdId, images]) => ({
      herdId,
      images: images.sort(compareImages),
    }))
    .sort((a, b) => compareImages(a.images[0], b.images[0]));

  const result: HerdDisplayPair[] = [];
  for (const { herdId, images } of herds) {
    const imageIds = new Set(images.map((image) => image.id));
    const imagesByCamera = new Map<string, ImageType[]>();
    for (const image of images) {
      const camera = cameraKey(image);
      const cameraImages = imagesByCamera.get(camera);
      if (cameraImages) cameraImages.push(image);
      else imagesByCamera.set(camera, [image]);
    }
    for (const cameraImages of imagesByCamera.values()) {
      cameraImages.sort(compareImages);
    }

    const crossovers: HerdDisplayPair[] = [];
    for (const neighbour of rawNeighbours) {
      if (neighbour.skipped) continue;
      const image1 = imagesById[neighbour.image1Id];
      const image2 = imagesById[neighbour.image2Id];
      if (
        !image1 ||
        !image2 ||
        !imageIds.has(image1.id) ||
        !imageIds.has(image2.id) ||
        cameraKey(image1) === cameraKey(image2)
      ) {
        continue;
      }
      const chains1 = chainsByImage.get(image1.id);
      const chains2 = chainsByImage.get(image2.id);
      if (!chains1 || !chains2 || !intersects(chains1, chains2)) continue;
      const pair = crossoverPair(herdId, neighbour, image1, image2);
      if (pair) crossovers.push(pair);
    }
    crossovers.sort(comparePairs);

    const cameraOrder = [...imagesByCamera.entries()]
      .sort((a, b) => compareImages(a[1][0], b[1][0]))
      .map(([camera]) => camera);
    const visited = new Set<string>();

    while (visited.size < cameraOrder.length) {
      if (visited.size === 0) {
        const firstCamera = cameraOrder[0];
        visited.add(firstCamera);
        result.push(
          ...cameraPairs(
            herdId,
            imagesByCamera.get(firstCamera) ?? [],
            chainsByImage
          )
        );
        continue;
      }

      // One crossover per newly introduced camera is the minimum needed.
      const crossover = crossovers.find((pair) => {
        const cameraA = cameraKey(pair.imageA);
        const cameraB = cameraKey(pair.imageB);
        return (
          (visited.has(cameraA) && !visited.has(cameraB)) ||
          (visited.has(cameraB) && !visited.has(cameraA))
        );
      });

      if (crossover) {
        result.push(crossover);
        const cameraA = cameraKey(crossover.imageA);
        const cameraB = cameraKey(crossover.imageB);
        const nextCamera = visited.has(cameraA) ? cameraB : cameraA;
        visited.add(nextCamera);
        result.push(
          ...cameraPairs(
            herdId,
            imagesByCamera.get(nextCamera) ?? [],
            chainsByImage
          )
        );
        continue;
      }

      // The chains still define one herd, but no registered crossover reaches
      // the remaining camera. Start its camera group without inventing a pair.
      const nextCamera = cameraOrder.find((camera) => !visited.has(camera));
      if (!nextCamera) break;
      visited.add(nextCamera);
      result.push(
        ...cameraPairs(
          herdId,
          imagesByCamera.get(nextCamera) ?? [],
          chainsByImage
        )
      );
    }
  }

  return result;
}
