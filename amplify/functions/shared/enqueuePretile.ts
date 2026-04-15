import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import pLimit from 'p-limit';

const MANIFEST_PREFIX = 'pretile-launch-manifests';

// Images tiled more recently than this are considered "fresh" and only need
// their S3 tiles touched (CopyObject in place) to reset the lifecycle clock.
// Must be comfortably below the S3 lifecycle expiration (90 days) so there's
// no race between the freshness check and lifecycle deletion.
const REFRESH_MAX_AGE_DAYS = 75;

export type PretileWorkflow =
  | 'species-labelling'
  | 'false-negatives'
  | 'qc-review'
  | 'homography';

export type PretileManifest = {
  launchId: string;
  projectId: string;
  annotationSetId: string | null;
  workflow: PretileWorkflow;
  imageIds: string[];
  createdAt: string;
};

export type EnqueuePretileInput = {
  projectId: string;
  annotationSetId: string | null;
  workflow: PretileWorkflow;
  imageIds: string[];
  executeGraphql: <T>(query: string, variables: Record<string, any>) => Promise<T>;
  outputsBucket: string;
  queueUrl: string;
  refreshQueueUrl: string;
  sqsClient: SQSClient;
  s3Client: S3Client;
};

export type EnqueuePretileResult = {
  launchId: string;
  manifestKey: string;
  totalImages: number;
  enqueuedCount: number;
  refreshedCount: number;
  skippedNoSourceCount: number;
};

const getProjectQuery = /* GraphQL */ `
  query GetProject($id: ID!) {
    getProject(id: $id) {
      id
      organizationId
      tags
    }
  }
`;

const getImageTiledAtQuery = /* GraphQL */ `
  query GetImage($id: ID!) {
    getImage(id: $id) {
      id
      tiledAt
      originalPath
    }
  }
`;

const updateProjectMutation = /* GraphQL */ `
  mutation UpdateProject($input: UpdateProjectInput!) {
    updateProject(input: $input) {
      id
      group
    }
  }
`;

type ProjectRow = {
  id: string;
  organizationId: string;
  tags: string[] | null;
};

type ImageRow = {
  id: string;
  tiledAt: string | null;
  originalPath: string | null;
};

/**
 * Write a pretile manifest, stamp the Project with the manifest key, and enqueue
 * pretile SQS messages for each image that doesn't already have `tiledAt` set.
 *
 * Ordering guarantee: the manifest file and the Project pointer are written
 * BEFORE any SQS message is sent. This ensures the reconciler always sees the
 * pointer before workers start flipping `Image.tiledAt`, so it cannot miss a
 * launch that completes between reconciler ticks.
 */
export async function enqueuePretile(
  input: EnqueuePretileInput
): Promise<EnqueuePretileResult> {
  const {
    projectId,
    annotationSetId,
    workflow,
    imageIds,
    executeGraphql,
    outputsBucket,
    queueUrl,
    refreshQueueUrl,
    sqsClient,
    s3Client,
  } = input;

  const dedupedIds = Array.from(new Set(imageIds));
  const launchId = randomUUID();
  const manifestKey = `${MANIFEST_PREFIX}/${launchId}.json`;

  const projectData = await executeGraphql<{ getProject?: ProjectRow | null }>(
    getProjectQuery,
    { id: projectId }
  );
  const project = projectData.getProject;
  if (!project) throw new Error(`enqueuePretile: project ${projectId} not found`);
  const isLegacy = project.tags?.includes('legacy') ?? false;
  const imageKeyPrefix = isLegacy ? 'images/' : `images/${project.organizationId}/${projectId}/`;

  const imageLookupLimit = pLimit(20);
  const imageRows = await Promise.all(
    dedupedIds.map((id) =>
      imageLookupLimit(async () => {
        const data = await executeGraphql<{ getImage?: ImageRow | null }>(
          getImageTiledAtQuery,
          { id }
        );
        const row = data.getImage;
        if (!row) {
          console.warn(
            JSON.stringify({ msg: 'enqueue_pretile_missing_image', imageId: id })
          );
          return null;
        }
        return row;
      })
    )
  );

  // Partition images by what we need to do with them:
  //   - needsTiling:    no tiledAt (or tiledAt is stale) AND we have a source
  //                     → queue to pretileImage, which generates tiles from scratch
  //   - needsRefresh:   tiledAt is recent → tiles still exist on S3
  //                     → queue to refreshTiles, which CopyObject-in-place to
  //                       reset the 90-day lifecycle clock
  //   - skippedNoSource: no tiledAt AND no source path → can't do anything
  const refreshCutoff = Date.now() - REFRESH_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const validRows = imageRows.filter((r): r is ImageRow => r !== null);
  const needsTiling: ImageRow[] = [];
  const needsRefresh: ImageRow[] = [];
  const skippedNoSource: ImageRow[] = [];
  for (const row of validRows) {
    if (!row.originalPath) {
      // Without originalPath we can't build the S3 key for either worker.
      skippedNoSource.push(row);
      continue;
    }
    const tiledAtMs = row.tiledAt ? Date.parse(row.tiledAt) : NaN;
    const isFresh = Number.isFinite(tiledAtMs) && tiledAtMs >= refreshCutoff;
    if (isFresh) {
      needsRefresh.push(row);
    } else {
      needsTiling.push(row);
    }
  }

  if (skippedNoSource.length > 0) {
    console.warn(
      JSON.stringify({
        msg: 'enqueue_pretile_skipped_no_source',
        count: skippedNoSource.length,
        sample: skippedNoSource.slice(0, 5).map((r) => r.id),
      })
    );
  }

  const manifestCreatedAt = new Date().toISOString();
  const manifest: PretileManifest = {
    launchId,
    projectId,
    annotationSetId,
    workflow,
    imageIds: dedupedIds,
    createdAt: manifestCreatedAt,
  };

  await s3Client.send(
    new PutObjectCommand({
      Bucket: outputsBucket,
      Key: manifestKey,
      Body: JSON.stringify(manifest),
      ContentType: 'application/json',
    })
  );

  await executeGraphql(updateProjectMutation, {
    input: { id: projectId, pretileManifestS3Key: manifestKey },
  });

  // Fan out SQS sends for both queues in parallel. Each row produces a message
  // with the same shape regardless of which queue it goes to — the refresh
  // worker derives the slippymaps prefix from sourceKey just like pretile.
  async function fanOut(
    rows: ImageRow[],
    targetQueueUrl: string,
    idPrefix: string
  ): Promise<void> {
    if (rows.length === 0) return;
    const sqsBatchSize = 10;
    const sendLimit = pLimit(10);
    const sendTasks: Array<Promise<void>> = [];
    for (let i = 0; i < rows.length; i += sqsBatchSize) {
      const batch = rows.slice(i, i + sqsBatchSize);
      const entries = batch.map((row, j) => ({
        Id: `${idPrefix}-${i + j}`,
        MessageBody: JSON.stringify({
          imageId: row.id,
          projectId,
          sourceKey: `${imageKeyPrefix}${row.originalPath}`,
          launchId,
          manifestCreatedAt,
        }),
      }));
      sendTasks.push(
        sendLimit(async () => {
          const resp = await sqsClient.send(
            new SendMessageBatchCommand({
              QueueUrl: targetQueueUrl,
              Entries: entries,
            })
          );
          if (resp.Failed && resp.Failed.length > 0) {
            throw new Error(
              `SQS batch failed for ${idPrefix} enqueue: ${JSON.stringify(resp.Failed)}`
            );
          }
        })
      );
    }
    await Promise.all(sendTasks);
  }

  await Promise.all([
    fanOut(needsTiling, queueUrl, 'pre'),
    fanOut(needsRefresh, refreshQueueUrl, 'ref'),
  ]);

  const result: EnqueuePretileResult = {
    launchId,
    manifestKey,
    totalImages: dedupedIds.length,
    enqueuedCount: needsTiling.length,
    refreshedCount: needsRefresh.length,
    skippedNoSourceCount: skippedNoSource.length,
  };

  console.log(JSON.stringify({ msg: 'enqueue_pretile_complete', ...result }));
  return result;
}
