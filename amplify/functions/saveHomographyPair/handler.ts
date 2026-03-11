import type { AppSyncResolverHandler } from 'aws-lambda';
import { ddb } from '../shared/ddb';
import { GetCommand, UpdateCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import {
  applyHomography,
  invertHomography,
  projectCorners,
  clipPolygonToRect,
  pointInPolygon,
} from '../shared/homography-math';

const BATCH_TABLE = process.env.HOMOGRAPHY_BATCH_TABLE!;
const POOL_TABLE = process.env.HOMOGRAPHY_POOL_TABLE!;
const NEIGHBOUR_TABLE = process.env.IMAGE_NEIGHBOUR_TABLE!;
const IMAGE_TABLE = process.env.IMAGE_TABLE!;
const ANNOTATION_TABLE = process.env.ANNOTATION_TABLE!;
const NEIGHBOUR_IMAGE2_INDEX = process.env.NEIGHBOUR_IMAGE2_INDEX!;
const ANN_IMAGE_SET_INDEX = process.env.ANNOTATION_IMAGE_SET_INDEX!;

interface SaveArgs {
  batchId: string;
  pairIndex: number;
  image1Id: string;
  image2Id: string;
  homography?: number[] | null;
  skip: boolean;
}

export const handler: AppSyncResolverHandler<SaveArgs, string> = async (event) => {
  const { batchId, pairIndex, image1Id, image2Id, homography, skip } = event.arguments;
  const callerSub = event.identity && 'sub' in event.identity ? event.identity.sub : '';

  // 1. Load and validate batch
  const batch = (await ddb.send(new GetCommand({
    TableName: BATCH_TABLE,
    Key: { id: batchId },
  }))).Item;

  if (!batch) throw new Error(`Batch ${batchId} not found`);
  if (batch.status !== 'assigned') throw new Error(`Batch is not in assigned state (current: ${batch.status})`);
  if (batch.assignedUserId !== callerSub) throw new Error('Batch is not assigned to you');
  if (batch.currentIndex !== pairIndex) throw new Error(`Pair index mismatch: expected ${batch.currentIndex}, got ${pairIndex}`);

  const annotationSetId = batch.annotationSetId;

  // 2. Find the ImageNeighbour record (try both key orders)
  let nb = (await ddb.send(new GetCommand({
    TableName: NEIGHBOUR_TABLE,
    Key: { image1Id, image2Id },
    ProjectionExpression: 'image1Id, image2Id',
  }))).Item;

  if (!nb) {
    nb = (await ddb.send(new GetCommand({
      TableName: NEIGHBOUR_TABLE,
      Key: { image1Id: image2Id, image2Id: image1Id },
      ProjectionExpression: 'image1Id, image2Id',
    }))).Item;
  }

  if (!nb) throw new Error(`ImageNeighbour not found for ${image1Id} and ${image2Id}`);

  const actualImage1 = nb.image1Id;
  const actualImage2 = nb.image2Id;
  const isReversed = actualImage1 !== image1Id;

  // 3. Save or skip
  if (skip) {
    await ddb.send(new UpdateCommand({
      TableName: NEIGHBOUR_TABLE,
      Key: { image1Id: actualImage1, image2Id: actualImage2 },
      UpdateExpression: 'SET skipped = :t, updatedAt = :now',
      ExpressionAttributeValues: { ':t': true, ':now': new Date().toISOString() },
    }));
  } else {
    if (!homography || homography.length !== 9) throw new Error('Invalid homography matrix (expected 9 elements)');

    let finalH = homography;
    if (isReversed) {
      finalH = invertHomography(homography);
    }

    await ddb.send(new UpdateCommand({
      TableName: NEIGHBOUR_TABLE,
      Key: { image1Id: actualImage1, image2Id: actualImage2 },
      UpdateExpression: 'SET homography = :h, homographySource = :src, updatedAt = :now',
      ExpressionAttributeValues: {
        ':h': finalH,
        ':src': 'manual',
        ':now': new Date().toISOString(),
      },
    }));

    // Run deduplication walk (non-fatal)
    try {
      await runDeduplicationWalk(actualImage1, actualImage2, finalH, annotationSetId);
    } catch (e) {
      console.error('Deduplication walk error (non-fatal):', e);
    }
  }

  // 4. Advance batch
  const newIndex = pairIndex + 1;
  const now = new Date().toISOString();

  if (newIndex >= batch.pairCount) {
    // Batch complete
    await ddb.send(new UpdateCommand({
      TableName: BATCH_TABLE,
      Key: { id: batchId },
      UpdateExpression: 'SET currentIndex = :idx, #s = :completed, completedAt = :now, updatedAt = :now',
      ExpressionAttributeNames: { '#s': 'status' },
      ExpressionAttributeValues: { ':idx': newIndex, ':completed': 'completed', ':now': now },
    }));

    // Update pool completed count
    const pool = (await ddb.send(new GetCommand({
      TableName: POOL_TABLE,
      Key: { id: batch.poolId },
      ProjectionExpression: 'id, completedBatches, totalBatches',
    }))).Item;

    if (pool) {
      const newCompleted = (pool.completedBatches || 0) + 1;
      const updateExpr = newCompleted >= pool.totalBatches
        ? 'SET completedBatches = :c, #s = :completed, updatedAt = :now'
        : 'SET completedBatches = :c, updatedAt = :now';
      const exprNames: Record<string, string> = {};
      const exprValues: Record<string, any> = { ':c': newCompleted, ':now': now };
      if (newCompleted >= pool.totalBatches) {
        exprNames['#s'] = 'status';
        exprValues[':completed'] = 'completed';
      }

      await ddb.send(new UpdateCommand({
        TableName: POOL_TABLE,
        Key: { id: batch.poolId },
        UpdateExpression: updateExpr,
        ...(Object.keys(exprNames).length > 0 ? { ExpressionAttributeNames: exprNames } : {}),
        ExpressionAttributeValues: exprValues,
      }));
    }
  } else {
    await ddb.send(new UpdateCommand({
      TableName: BATCH_TABLE,
      Key: { id: batchId },
      UpdateExpression: 'SET currentIndex = :idx, lastHeartbeat = :now, updatedAt = :now',
      ExpressionAttributeValues: { ':idx': newIndex, ':now': now },
    }));
  }

  return JSON.stringify({ batchId, currentIndex: newIndex, completed: newIndex >= batch.pairCount });
};

// --- Deduplication Walk ---

async function getImage(imageId: string) {
  const result = await ddb.send(new GetCommand({
    TableName: IMAGE_TABLE,
    Key: { id: imageId },
    ProjectionExpression: 'id, width, height, #ts',
    ExpressionAttributeNames: { '#ts': 'timestamp' },
  }));
  return result.Item;
}

async function fetchAnnotationsForImage(imageId: string, setId: string) {
  const items: any[] = [];
  let lastKey: any = undefined;
  do {
    const result = await ddb.send(new QueryCommand({
      TableName: ANNOTATION_TABLE,
      IndexName: ANN_IMAGE_SET_INDEX,
      KeyConditionExpression: 'imageId = :imgId AND setId = :setId',
      ExpressionAttributeValues: { ':imgId': imageId, ':setId': setId },
      ProjectionExpression: 'id, x, y, objectId',
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    }));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function queryNeighboursByImage1(imageId: string) {
  // image1Id is the table's partition key, so we can query the main table directly
  const items: any[] = [];
  let lastKey: any = undefined;
  do {
    const result = await ddb.send(new QueryCommand({
      TableName: NEIGHBOUR_TABLE,
      KeyConditionExpression: 'image1Id = :id',
      ExpressionAttributeValues: { ':id': imageId },
      ProjectionExpression: 'image1Id, image2Id, homography, skipped',
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    }));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function queryNeighboursByImage2(imageId: string) {
  const items: any[] = [];
  let lastKey: any = undefined;
  do {
    const result = await ddb.send(new QueryCommand({
      TableName: NEIGHBOUR_TABLE,
      IndexName: NEIGHBOUR_IMAGE2_INDEX,
      KeyConditionExpression: 'image2Id = :id',
      ExpressionAttributeValues: { ':id': imageId },
      ProjectionExpression: 'image1Id, image2Id, homography, skipped',
      ...(lastKey ? { ExclusiveStartKey: lastKey } : {}),
    }));
    items.push(...(result.Items || []));
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);
  return items;
}

async function runDeduplicationWalk(
  image1Id: string,
  image2Id: string,
  hFlat: number[],
  annotationSetId: string,
) {
  // Fetch image metadata
  const [img1, img2] = await Promise.all([getImage(image1Id), getImage(image2Id)]);
  if (!img1 || !img2) {
    console.warn('Could not fetch image metadata for dedup walk');
    return;
  }

  // Determine initial overlap zones
  let H1to2 = hFlat; // image1 -> image2
  if (img1.timestamp > img2.timestamp) {
    // We want a stable direction or just handle both. Let's just keep IDs for now.
  }

  const cornersInImg2 = projectCorners(H1to2, img1.width, img1.height);
  const zoneIn2 = clipPolygonToRect(cornersInImg2, img2.width, img2.height);

  const H2to1 = invertHomography(H1to2);
  const cornersInImg1 = projectCorners(H2to1, img2.width, img2.height);
  const zoneIn1 = clipPolygonToRect(cornersInImg1, img1.width, img1.height);

  // We have a new "disturbed" area. Any images that overlap these zones might need re-evaluation.
  const affectedImages = new Map<string, [number, number][]>(); // imageId -> zone polygon
  
  async function discover(imageId: string, currentZone: [number, number][], depth: number) {
    if (depth > 15 || currentZone.length < 3) return;
    
    // Add or merge zone for this image
    const existing = affectedImages.get(imageId);
    if (existing) {
        // For simplicity, we just check if we've been here. 
        // A more complex merge would involve polygon union, but usually image chains are linear-ish.
        return; 
    }
    affectedImages.set(imageId, currentZone);

    const [n1, n2] = await Promise.all([
      queryNeighboursByImage1(imageId),
      queryNeighboursByImage2(imageId)
    ]);

    const neighbours = [...n1, ...n2.map(n => ({ ...n, image1Id: n.image2Id, image2Id: n.image1Id, homography: n.homography ? invertHomography(n.homography) : null }))];

    for (const nb of neighbours) {
      if (!nb.homography || nb.skipped) continue;

      // Project currentZone into the neighbour
      const projected = currentZone.map(([x, y]) => applyHomography(nb.homography!, x, y)) as [number, number][];
      
      const otherImg = await getImage(nb.image2Id);
      if (!otherImg) continue;

      const clipped = clipPolygonToRect(projected, otherImg.width, otherImg.height);
      if (clipped.length >= 3) {
        // This neighbour overlaps with our "disturbed" zone. 
        await discover(nb.image2Id, clipped, depth + 1);
      }
    }
  }

  // Start discovery from both images of the new pair
  await Promise.all([
    discover(image1Id, zoneIn1, 0),
    discover(image2Id, zoneIn2, 0)
  ]);

  console.log(`Deduplication walk found ${affectedImages.size} affected images`);

  // For each affected image, re-evaluate ALL annotations
  const updatePromises: Promise<any>[] = [];
  
  for (const [imageId, zone] of affectedImages.entries()) {
    const [img, anns, n1, n2] = await Promise.all([
      getImage(imageId),
      fetchAnnotationsForImage(imageId, annotationSetId),
      queryNeighboursByImage1(imageId),
      queryNeighboursByImage2(imageId)
    ]);

    if (!img) continue;

    // Direct neighbours with valid homographies
    const neighbours = [
        ...n1, 
        ...n2.map(n => ({ 
            ...n, 
            image1Id: n.image2Id, 
            image2Id: n.image1Id, 
            homography: n.homography ? invertHomography(n.homography) : null 
        }))
    ].filter(n => n.homography && !n.skipped);

    // Fetch older neighbours metadata to check for "seen earlier"
    const olderNeighbourData = await Promise.all(
        neighbours.map(async n => {
            const meta = await getImage(n.image2Id);
            if (meta && meta.timestamp < img.timestamp) {
                return { meta, homography: n.homography! };
            }
            return null;
        })
    );
    const validOlderNeighbours = olderNeighbourData.filter((n): n is { meta: any, homography: number[] } => n !== null);

    for (const ann of anns) {
      // We only care about annotations that fall within the "affected" zones discovered in the walk
      if (!pointInPolygon(ann.x, ann.y, zone)) continue;

      // Determine if this point is visible in ANY older neighbour
      let seenEarlier = false;
      for (const parent of validOlderNeighbours) {
        const projected = applyHomography(parent.homography, ann.x, ann.y);
        if (
          projected[0] >= 0 &&
          projected[1] >= 0 &&
          projected[0] < parent.meta.width &&
          projected[1] < parent.meta.height
        ) {
          seenEarlier = true;
          break;
        }
      }

      const expectedObjectId = seenEarlier ? null : ann.id;

      if (ann.objectId !== expectedObjectId) {
        console.log(`Updating annotation ${ann.id} on image ${imageId}: objectId ${ann.objectId} -> ${expectedObjectId}`);
        if (expectedObjectId === null) {
          updatePromises.push(
            ddb.send(new UpdateCommand({
              TableName: ANNOTATION_TABLE,
              Key: { id: ann.id },
              UpdateExpression: 'REMOVE objectId SET updatedAt = :now',
              ExpressionAttributeValues: { ':now': new Date().toISOString() },
            }))
          );
        } else {
          updatePromises.push(
            ddb.send(new UpdateCommand({
              TableName: ANNOTATION_TABLE,
              Key: { id: ann.id },
              UpdateExpression: 'SET objectId = :oid, updatedAt = :now',
              ExpressionAttributeValues: { ':oid': expectedObjectId, ':now': new Date().toISOString() },
            }))
          );
        }
      }
    }
  }

  await Promise.all(updatePromises);
}
