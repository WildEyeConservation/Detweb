import type { DataClient } from '../../../amplify/shared/data-schema.generated';

import { SUGGESTED_POINT_ID_PREFIX } from './homographyWorkflowStats';
import { type Point } from './homographyMath';

export function flatToPoints(flat: (number | null | undefined)[] | null | undefined): Point[] {
  if (!flat || flat.length < 2) return [];
  const out: Point[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) {
    const x = flat[i];
    const y = flat[i + 1];
    if (typeof x !== 'number' || typeof y !== 'number') continue;
    out.push({ id: `${SUGGESTED_POINT_ID_PREFIX}${i / 2}`, x, y });
  }
  return out;
}

export type NeighbourRecord = {
  image1Id: string;
  image2Id: string;
  isForward: boolean;
  suggestedPoints1: (number | null | undefined)[] | null | undefined;
  suggestedPoints2: (number | null | undefined)[] | null | undefined;
  /** Stored 3x3 homography in row-major order, image1→image2. */
  homography: (number | null | undefined)[] | null | undefined;
};

export async function resolveNeighbourDirection(
  client: DataClient,
  primaryId: string,
  secondaryId: string
): Promise<NeighbourRecord> {
  const fwdResp = await client.models.ImageNeighbour.get({
    image1Id: primaryId,
    image2Id: secondaryId,
  });
  if (fwdResp?.data) {
    return {
      image1Id: primaryId,
      image2Id: secondaryId,
      isForward: true,
      suggestedPoints1: fwdResp.data.suggestedPoints1,
      suggestedPoints2: fwdResp.data.suggestedPoints2,
      homography: fwdResp.data.homography,
    };
  }
  const revResp = await client.models.ImageNeighbour.get({
    image1Id: secondaryId,
    image2Id: primaryId,
  });
  if (revResp?.data) {
    return {
      image1Id: secondaryId,
      image2Id: primaryId,
      isForward: false,
      suggestedPoints1: revResp.data.suggestedPoints1,
      suggestedPoints2: revResp.data.suggestedPoints2,
      homography: revResp.data.homography,
    };
  }
  throw new Error(
    `ImageNeighbour record not found in either direction for ${primaryId} / ${secondaryId}`
  );
}
