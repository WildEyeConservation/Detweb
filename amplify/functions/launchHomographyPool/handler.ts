import type { AppSyncResolverHandler } from 'aws-lambda';
import { randomUUID } from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ddb } from '../shared/ddb';
import { GetCommand, PutCommand, QueryCommand, BatchGetCommand } from '@aws-sdk/lib-dynamodb';

const ANNOTATION_TABLE = process.env.ANNOTATION_TABLE!;
const NEIGHBOUR_TABLE = process.env.IMAGE_NEIGHBOUR_TABLE!;
const IMAGE_TABLE = process.env.IMAGE_TABLE!;
const BATCH_TABLE = process.env.HOMOGRAPHY_BATCH_TABLE!;
const POOL_TABLE = process.env.HOMOGRAPHY_POOL_TABLE!;
const PROJECT_TABLE = process.env.PROJECT_TABLE!;
const OUTPUTS_BUCKET = process.env.OUTPUTS_BUCKET!;
const NEIGHBOUR_PROJECT_INDEX = process.env.NEIGHBOUR_PROJECT_INDEX!;
const ANNOTATION_SET_INDEX = process.env.ANNOTATION_SET_INDEX!;

const s3 = new S3Client({});

interface LaunchArgs {
  projectId: string;
  annotationSetId: string;
  labelIds: string[];
  batchSize: number;
  name: string;
}

export const handler: AppSyncResolverHandler<LaunchArgs, string> = async (event) => {
  const { projectId, annotationSetId, labelIds, batchSize: rawBatchSize, name: poolName } = event.arguments;
  const callerSub = event.identity && 'sub' in event.identity ? event.identity.sub : '';
  const callerGroups: string[] = (event.identity && 'groups' in event.identity ? event.identity.groups : []) || [];
  const batchSize = Math.max(1, rawBatchSize);

  // Get project for org auth
  const project = (await ddb.send(new GetCommand({
    TableName: PROJECT_TABLE,
    Key: { id: projectId },
    ProjectionExpression: 'id, organizationId',
  }))).Item;
  if (!project) throw new Error(`Project ${projectId} not found`);
  const orgId = project.organizationId;

  // Auth check
  if (callerSub && !callerGroups.includes('sysadmin') && !callerGroups.includes(orgId)) {
    throw new Error('Unauthorized: user does not belong to the project organization');
  }

  // Step 1: Fetch annotations for the annotation set filtered by labelIds
  // Query by setId index, filter by categoryId in labelIds
  const annotations: any[] = [];
  let annLastKey: any = undefined;
  do {
    const result = await ddb.send(new QueryCommand({
      TableName: ANNOTATION_TABLE,
      IndexName: ANNOTATION_SET_INDEX,
      KeyConditionExpression: 'setId = :setId',
      FilterExpression: `categoryId IN (${labelIds.map((_, i) => `:cat${i}`).join(',')})`,
      ExpressionAttributeValues: {
        ':setId': annotationSetId,
        ...Object.fromEntries(labelIds.map((id, i) => [`:cat${i}`, id])),
      },
      ProjectionExpression: 'id, imageId',
      ...(annLastKey ? { ExclusiveStartKey: annLastKey } : {}),
    }));
    annotations.push(...(result.Items || []));
    annLastKey = result.LastEvaluatedKey;
  } while (annLastKey);

  const annotatedImageIds = new Set(annotations.map(a => a.imageId));
  if (annotatedImageIds.size === 0) throw new Error('No annotations found for the given filters');

  // Step 2: Fetch ImageNeighbour records for the project
  const allNeighbours: any[] = [];
  let nbLastKey: any = undefined;
  do {
    const result = await ddb.send(new QueryCommand({
      TableName: NEIGHBOUR_TABLE,
      IndexName: NEIGHBOUR_PROJECT_INDEX,
      KeyConditionExpression: 'projectId = :pid',
      ExpressionAttributeValues: { ':pid': projectId },
      ProjectionExpression: 'image1Id, image2Id, homography, skipped',
      ...(nbLastKey ? { ExclusiveStartKey: nbLastKey } : {}),
    }));
    allNeighbours.push(...(result.Items || []));
    nbLastKey = result.LastEvaluatedKey;
  } while (nbLastKey);

  // Filter: missing homography, not skipped
  const pendingNeighbours = allNeighbours.filter(
    n => !n.skipped && (!n.homography || n.homography.length !== 9)
  );

  // Filter to pairs where at least one image has annotations
  const relevantPairs = pendingNeighbours.filter(
    n => annotatedImageIds.has(n.image1Id) || annotatedImageIds.has(n.image2Id)
  );

  if (relevantPairs.length === 0) throw new Error('No image pairs found that need homography registration');

  // Step 3: Fetch image metadata for all unique images
  const allImageIds = new Set<string>();
  for (const p of relevantPairs) {
    allImageIds.add(p.image1Id);
    allImageIds.add(p.image2Id);
  }

  // BatchGetItem (max 100 per call)
  const images: Record<string, any> = {};
  const imageIdArray = [...allImageIds];
  for (let i = 0; i < imageIdArray.length; i += 100) {
    const batch = imageIdArray.slice(i, i + 100);
    const result = await ddb.send(new BatchGetCommand({
      RequestItems: {
        [IMAGE_TABLE]: {
          Keys: batch.map(id => ({ id })),
          ProjectionExpression: 'id, width, height, #ts, latitude, longitude, altitude_wgs84',
          ExpressionAttributeNames: { '#ts': 'timestamp' },
        },
      },
    }));
    for (const item of result.Responses?.[IMAGE_TABLE] || []) {
      images[item.id] = item;
    }
    // Handle unprocessed keys
    let unprocessed = result.UnprocessedKeys?.[IMAGE_TABLE]?.Keys;
    while (unprocessed && unprocessed.length > 0) {
      const retry = await ddb.send(new BatchGetCommand({
        RequestItems: {
          [IMAGE_TABLE]: {
            Keys: unprocessed as any,
            ProjectionExpression: 'id, width, height, #ts, latitude, longitude, altitude_wgs84',
            ExpressionAttributeNames: { '#ts': 'timestamp' },
          },
        },
      }));
      for (const item of retry.Responses?.[IMAGE_TABLE] || []) {
        images[item.id] = item;
      }
      unprocessed = retry.UnprocessedKeys?.[IMAGE_TABLE]?.Keys;
    }
  }

  // Step 4: Sort pairs by minimum timestamp
  relevantPairs.sort((a, b) => {
    const tsA = Math.min(
      new Date(images[a.image1Id]?.timestamp || 0).getTime(),
      new Date(images[a.image2Id]?.timestamp || 0).getTime()
    );
    const tsB = Math.min(
      new Date(images[b.image1Id]?.timestamp || 0).getTime(),
      new Date(images[b.image2Id]?.timestamp || 0).getTime()
    );
    return tsA - tsB;
  });

  // Step 5: Partition into batches and create records
  const totalPairs = relevantPairs.length;
  const totalBatches = Math.ceil(totalPairs / batchSize);
  const poolId = randomUUID();
  const now = new Date().toISOString();

  const errors: string[] = [];

  // Create batches (with concurrency limit)
  const batchPromises: Promise<string | null>[] = [];
  for (let i = 0; i < totalBatches; i++) {
    const start = i * batchSize;
    const end = Math.min(start + batchSize, totalPairs);
    const batchPairs = relevantPairs.slice(start, end);
    batchPromises.push(createBatch(poolId, projectId, annotationSetId, orgId, i, batchPairs, images, now, errors));
  }

  // Process in groups of 10
  const batchIds: string[] = [];
  for (let i = 0; i < batchPromises.length; i += 10) {
    const chunk = batchPromises.slice(i, i + 10);
    const results = await Promise.all(chunk);
    batchIds.push(...results.filter((id): id is string => id !== null));
  }

  if (errors.length > 0) {
    // Create error pool record
    await ddb.send(new PutCommand({
      TableName: POOL_TABLE,
      Item: {
        id: poolId, projectId, annotationSetId, name: poolName,
        labelIds, batchSize, totalPairs, totalBatches,
        completedBatches: 0, abandonedBatches: 0,
        status: 'error', createdBy: callerSub, group: orgId,
        __typename: 'HomographyPool', createdAt: now, updatedAt: now,
      },
    }));
    throw new Error(`Failed to create some batches: ${errors.join('; ')}`);
  }

  // Upload full pair list to S3
  const allPairsKey = `homography-batches/${poolId}/all-pairs.json`;
  const allPairKeys = relevantPairs.map(p => `${p.image1Id}::${p.image2Id}`);
  await s3.send(new PutObjectCommand({
    Bucket: OUTPUTS_BUCKET,
    Key: allPairsKey,
    Body: JSON.stringify(allPairKeys),
    ContentType: 'application/json',
  }));

  // Create HomographyPool record
  await ddb.send(new PutCommand({
    TableName: POOL_TABLE,
    Item: {
      id: poolId, projectId, annotationSetId, name: poolName,
      labelIds, batchSize, totalPairs, totalBatches,
      completedBatches: 0, abandonedBatches: 0,
      status: 'active', pairManifestS3Key: allPairsKey,
      createdBy: callerSub, group: orgId,
      __typename: 'HomographyPool', createdAt: now, updatedAt: now,
    },
  }));

  return JSON.stringify({ poolId, totalPairs, totalBatches, status: 'active' });
};

async function createBatch(
  poolId: string, projectId: string, annotationSetId: string, orgId: string,
  batchIndex: number, batchPairs: any[], images: Record<string, any>,
  now: string, errors: string[],
): Promise<string | null> {
  const batchId = randomUUID();
  try {
    const pairKeys: string[] = [];
    const pairsManifest: any[] = [];

    for (const p of batchPairs) {
      const img1 = images[p.image1Id] || {};
      const img2 = images[p.image2Id] || {};
      pairKeys.push(`${p.image1Id}::${p.image2Id}`);
      pairsManifest.push({
        image1: {
          id: p.image1Id, width: img1.width || 0, height: img1.height || 0,
          timestamp: img1.timestamp, lat: img1.latitude, lon: img1.longitude, altitude: img1.altitude_wgs84,
        },
        image2: {
          id: p.image2Id, width: img2.width || 0, height: img2.height || 0,
          timestamp: img2.timestamp, lat: img2.latitude, lon: img2.longitude, altitude: img2.altitude_wgs84,
        },
        existingHomography: null,
      });
    }

    const manifest = { poolId, batchId, annotationSetId, pairs: pairsManifest };
    const s3Key = `homography-batches/${poolId}/${batchId}/manifest.json`;

    await s3.send(new PutObjectCommand({
      Bucket: OUTPUTS_BUCKET,
      Key: s3Key,
      Body: JSON.stringify(manifest),
      ContentType: 'application/json',
    }));

    await ddb.send(new PutCommand({
      TableName: process.env.HOMOGRAPHY_BATCH_TABLE!,
      Item: {
        id: batchId, poolId, projectId, batchIndex,
        status: 'available', pairKeys, pairCount: batchPairs.length,
        currentIndex: 0, pairManifestS3Key: s3Key,
        annotationSetId, group: orgId,
        __typename: 'HomographyBatch', createdAt: now, updatedAt: now,
      },
    }));

    return batchId;
  } catch (e: any) {
    errors.push(e.message || String(e));
    return null;
  }
}
