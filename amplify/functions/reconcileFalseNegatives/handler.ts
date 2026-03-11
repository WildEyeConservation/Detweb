import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/reconcileFalseNegatives';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import pLimit from 'p-limit';

Amplify.configure(
  {
    API: {
      GraphQL: {
        endpoint: env.AMPLIFY_DATA_GRAPHQL_ENDPOINT,
        region: env.AWS_REGION,
        defaultAuthMode: 'iam',
      },
    },
  },
  {
    Auth: {
      credentialsProvider: {
        getCredentialsAndIdentityId: async () => ({
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            sessionToken: env.AWS_SESSION_TOKEN,
          },
        }),
        clearCredentialsAndIdentityId: () => {
          /* noop */
        },
      },
    },
  }
);

const client = generateClient({ authMode: 'iam' });

const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
  },
});

// ── Types ──

type MinimalTile = {
  id: string;
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type FnPool = {
  annotationSetId: string;
  poolCreatedAt: string;
  poolSize: number;
  items: MinimalTile[];
};

type FnLaunchEntry = {
  launchedAt: string;
  launchedCount: number;
  items: MinimalTile[];
};

type FnHistory = {
  annotationSetId: string;
  poolSize: number;
  totalLaunched: number;
  launches: FnLaunchEntry[];
};

type ReconcilePayload = {
  annotationSetId: string;
};

// ── Inline GraphQL queries ──

const normalAnnotationsQuery = /* GraphQL */ `
  query AnnotationsByAnnotationSetId(
    $setId: ID!
    $filter: ModelAnnotationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    annotationsByAnnotationSetId(
      setId: $setId
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        imageId
        x
        y
      }
      nextToken
    }
  }
`;

const normalObservationsQuery = /* GraphQL */ `
  query ObservationsByAnnotationSetIdWithLocations(
    $annotationSetId: ID!
    $filter: ModelObservationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    observationsByAnnotationSetId(
      annotationSetId: $annotationSetId
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        locationId
        location {
          id
          imageId
          x
          y
          width
          height
        }
      }
      nextToken
    }
  }
`;

const fnAnnotationsQuery = /* GraphQL */ `
  query FnAnnotationsByAnnotationSetId(
    $setId: ID!
    $filter: ModelAnnotationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    annotationsByAnnotationSetId(
      setId: $setId
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        imageId
        x
        y
      }
      nextToken
    }
  }
`;

const fnObservationsQuery = /* GraphQL */ `
  query FnObservationsByAnnotationSetId(
    $annotationSetId: ID!
    $filter: ModelObservationFilterInput
    $limit: Int
    $nextToken: String
  ) {
    observationsByAnnotationSetId(
      annotationSetId: $annotationSetId
      filter: $filter
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        locationId
      }
      nextToken
    }
  }
`;

const deleteAnnotationMutation = /* GraphQL */ `
  mutation DeleteAnnotation($input: DeleteAnnotationInput!) {
    deleteAnnotation(input: $input) {
      id
    }
  }
`;

const deleteObservationMutation = /* GraphQL */ `
  mutation DeleteObservation($input: DeleteObservationInput!) {
    deleteObservation(input: $input) {
      id
    }
  }
`;

// ── Handler ──

export const handler: Handler = async (event) => {
  try {
    const payload: ReconcilePayload =
      typeof event === 'string' ? JSON.parse(event) : event;

    const { annotationSetId } = payload;
    console.log('reconcileFalseNegatives invoked', { annotationSetId });

    // Load FN pool and history from S3
    const [pool, history] = await Promise.all([
      loadFnPool(annotationSetId),
      loadFnHistory(annotationSetId),
    ]);

    if (!pool || !history) {
      console.log('No FN pool/history found, nothing to reconcile');
      return { statusCode: 200, body: 'No FN data to reconcile' };
    }

    console.log('Loaded FN manifests', {
      poolSize: pool.poolSize,
      itemCount: pool.items.length,
      totalLaunched: history.totalLaunched,
      launchCount: history.launches.length,
    });

    // Fetch all NORMAL annotations and observations for this annotation set
    const [normalAnnotations, normalObservations] = await Promise.all([
      fetchNormalAnnotations(annotationSetId),
      fetchNormalObservations(annotationSetId),
    ]);

    console.log('Fetched normal work', {
      annotationImages: normalAnnotations.size,
      observationImages: normalObservations.size,
    });

    // Identify tiles that now have normal work
    const tilesToClean = new Set<string>();

    for (const tile of pool.items) {
      const annotations = normalAnnotations.get(tile.imageId) || [];
      const observations = normalObservations.get(tile.imageId) || [];

      const hasNormalAnnotation = annotations.some((pt) =>
        isInsideTile(pt.x, pt.y, tile)
      );
      const hasNormalObservation = observations.some((obs) =>
        tilesOverlap(tile, obs)
      );

      if (hasNormalAnnotation || hasNormalObservation) {
        tilesToClean.add(tile.id);
      }
    }

    if (tilesToClean.size === 0) {
      console.log('No tiles need cleaning');
      return { statusCode: 200, body: 'No tiles to clean' };
    }

    console.log('Tiles to clean', { count: tilesToClean.size });

    // Delete FN annotations and observations on affected tiles
    await deleteFnDataForTiles(annotationSetId, pool.items, tilesToClean);

    // Update pool: remove cleaned tiles
    const updatedPoolItems = pool.items.filter((t) => !tilesToClean.has(t.id));
    const updatedPool: FnPool = {
      ...pool,
      poolSize: updatedPoolItems.length,
      items: updatedPoolItems,
    };

    // Update history: remove cleaned tiles from all launches
    const updatedLaunches = history.launches.map((launch) => {
      const remaining = launch.items.filter((t) => !tilesToClean.has(t.id));
      return {
        ...launch,
        items: remaining,
        launchedCount: remaining.length,
      };
    });
    const updatedHistory: FnHistory = {
      ...history,
      poolSize: updatedPoolItems.length,
      totalLaunched: updatedLaunches.reduce(
        (sum, l) => sum + l.launchedCount,
        0
      ),
      launches: updatedLaunches,
    };

    // Save updated manifests
    await Promise.all([
      saveFnPool(annotationSetId, updatedPool),
      saveFnHistory(annotationSetId, updatedHistory),
    ]);

    console.log('Reconciliation complete', {
      tilesRemoved: tilesToClean.size,
      newPoolSize: updatedPool.poolSize,
      newTotalLaunched: updatedHistory.totalLaunched,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Reconciliation complete',
        tilesRemoved: tilesToClean.size,
        newPoolSize: updatedPool.poolSize,
      }),
    };
  } catch (error: any) {
    console.error('Error in reconcileFalseNegatives', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Reconciliation failed',
        error: error?.message ?? 'Unknown error',
      }),
    };
  }
};

// ── Data fetching ──

async function fetchNormalAnnotations(
  annotationSetId: string
): Promise<Map<string, Array<{ x: number; y: number }>>> {
  const map = new Map<string, Array<{ x: number; y: number }>>();
  let nextToken: string | null | undefined = undefined;

  do {
    const response = (await client.graphql({
      query: normalAnnotationsQuery,
      variables: {
        setId: annotationSetId,
        filter: {
          or: [
            { source: { notContains: 'false-negative' } },
            { source: { attributeExists: false } },
          ],
        },
        limit: 1000,
        nextToken,
      },
    } as any)) as GraphQLResult<{
      annotationsByAnnotationSetId?: {
        items?: Array<{
          imageId?: string | null;
          x?: number | null;
          y?: number | null;
        }>;
        nextToken?: string | null;
      };
    }>;

    if (response.errors?.length) {
      throw new Error(
        `GraphQL error fetching annotations: ${JSON.stringify(
          response.errors.map((e) => e.message)
        )}`
      );
    }

    const page = response.data?.annotationsByAnnotationSetId;
    for (const item of page?.items || []) {
      if (!item?.imageId) continue;
      const list = map.get(item.imageId) || [];
      list.push({ x: Number(item.x ?? 0), y: Number(item.y ?? 0) });
      map.set(item.imageId, list);
    }
    nextToken = page?.nextToken ?? undefined;
  } while (nextToken);

  return map;
}

async function fetchNormalObservations(
  annotationSetId: string
): Promise<
  Map<string, Array<{ x: number; y: number; width: number; height: number }>>
> {
  const map = new Map<
    string,
    Array<{ x: number; y: number; width: number; height: number }>
  >();
  let nextToken: string | null | undefined = undefined;

  do {
    const response = (await client.graphql({
      query: normalObservationsQuery,
      variables: {
        annotationSetId,
        filter: {
          or: [
            { source: { notContains: 'false-negative' } },
            { source: { attributeExists: false } },
          ],
        },
        limit: 1000,
        nextToken,
      },
    } as any)) as GraphQLResult<{
      observationsByAnnotationSetId?: {
        items?: Array<{
          locationId?: string | null;
          location?: {
            id?: string | null;
            imageId?: string | null;
            x?: number | null;
            y?: number | null;
            width?: number | null;
            height?: number | null;
          } | null;
        }>;
        nextToken?: string | null;
      };
    }>;

    if (response.errors?.length) {
      throw new Error(
        `GraphQL error fetching observations: ${JSON.stringify(
          response.errors.map((e) => e.message)
        )}`
      );
    }

    const page = response.data?.observationsByAnnotationSetId;
    for (const item of page?.items || []) {
      const location = item?.location;
      if (!location?.imageId) continue;
      const list = map.get(location.imageId) || [];
      list.push({
        x: Number(location.x ?? 0),
        y: Number(location.y ?? 0),
        width: Number(location.width ?? 0),
        height: Number(location.height ?? 0),
      });
      map.set(location.imageId, list);
    }
    nextToken = page?.nextToken ?? undefined;
  } while (nextToken);

  return map;
}

// ── FN data deletion ──

async function deleteFnDataForTiles(
  annotationSetId: string,
  poolTiles: MinimalTile[],
  tilesToClean: Set<string>
): Promise<void> {
  console.log('Deleting FN data for tiles', { count: tilesToClean.size });

  // Build a lookup from tile ID to tile geometry for annotation matching
  const tileById = new Map<string, MinimalTile>();
  for (const tile of poolTiles) {
    if (tilesToClean.has(tile.id)) {
      tileById.set(tile.id, tile);
    }
  }

  // Also build imageId -> tiles lookup for annotation geometric matching
  const tilesByImage = new Map<string, MinimalTile[]>();
  for (const tile of tileById.values()) {
    const list = tilesByImage.get(tile.imageId) || [];
    list.push(tile);
    tilesByImage.set(tile.imageId, list);
  }

  const deleteLimit = pLimit(50);

  // Delete FN annotations that fall within tiles to clean
  let deletedAnnotations = 0;
  let nextToken: string | null | undefined = undefined;

  do {
    const response = (await client.graphql({
      query: fnAnnotationsQuery,
      variables: {
        setId: annotationSetId,
        filter: { source: { contains: 'false-negative' } },
        limit: 1000,
        nextToken,
      },
    } as any)) as GraphQLResult<{
      annotationsByAnnotationSetId?: {
        items?: Array<{
          id?: string | null;
          imageId?: string | null;
          x?: number | null;
          y?: number | null;
        }>;
        nextToken?: string | null;
      };
    }>;

    if (response.errors?.length) {
      throw new Error(
        `GraphQL error fetching FN annotations: ${JSON.stringify(
          response.errors.map((e) => e.message)
        )}`
      );
    }

    const page = response.data?.annotationsByAnnotationSetId;
    const items = page?.items || [];

    const deleteTasks = items
      .filter((item) => {
        if (!item?.id || !item?.imageId) return false;
        // Check if this annotation falls within any tile being cleaned
        const tiles = tilesByImage.get(item.imageId);
        if (!tiles) return false;
        return tiles.some((tile) =>
          isInsideTile(Number(item.x ?? 0), Number(item.y ?? 0), tile)
        );
      })
      .map((item) =>
        deleteLimit(async () => {
          try {
            await client.graphql({
              query: deleteAnnotationMutation,
              variables: { input: { id: item!.id } },
            } as any);
            deletedAnnotations++;
          } catch (err) {
            console.warn('Failed to delete annotation', {
              id: item!.id,
              error: err,
            });
          }
        })
      );

    await Promise.all(deleteTasks);
    nextToken = page?.nextToken ?? undefined;
  } while (nextToken);

  // Delete FN observations whose locationId matches a tile being cleaned
  let deletedObservations = 0;
  let nextTokenObs: string | null | undefined = undefined;

  do {
    const response = (await client.graphql({
      query: fnObservationsQuery,
      variables: {
        annotationSetId,
        filter: { source: { contains: 'false-negative' } },
        limit: 1000,
        nextToken: nextTokenObs,
      },
    } as any)) as GraphQLResult<{
      observationsByAnnotationSetId?: {
        items?: Array<{
          id?: string | null;
          locationId?: string | null;
        }>;
        nextToken?: string | null;
      };
    }>;

    if (response.errors?.length) {
      throw new Error(
        `GraphQL error fetching FN observations: ${JSON.stringify(
          response.errors.map((e) => e.message)
        )}`
      );
    }

    const page = response.data?.observationsByAnnotationSetId;
    const items = page?.items || [];

    const deleteTasks = items
      .filter(
        (item) =>
          item?.id && item?.locationId && tilesToClean.has(item.locationId)
      )
      .map((item) =>
        deleteLimit(async () => {
          try {
            await client.graphql({
              query: deleteObservationMutation,
              variables: { input: { id: item!.id } },
            } as any);
            deletedObservations++;
          } catch (err) {
            console.warn('Failed to delete observation', {
              id: item!.id,
              error: err,
            });
          }
        })
      );

    await Promise.all(deleteTasks);
    nextTokenObs = page?.nextToken ?? undefined;
  } while (nextTokenObs);

  console.log('Deleted FN data', {
    annotations: deletedAnnotations,
    observations: deletedObservations,
  });
}

// ── S3 manifest helpers ──

async function loadFnPool(
  annotationSetId: string
): Promise<FnPool | null> {
  const bucketName = env.OUTPUTS_BUCKET_NAME;
  if (!bucketName) return null;
  const key = `false-negative-pools/${annotationSetId}.json`;
  try {
    const response = await s3Client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: key })
    );
    const bodyStr = await response.Body?.transformToString();
    if (!bodyStr) return null;
    return JSON.parse(bodyStr) as FnPool;
  } catch (error: any) {
    if (error?.name === 'NoSuchKey' || error?.Code === 'NoSuchKey') return null;
    console.warn('Failed to load FN pool', { key, error: error?.message });
    return null;
  }
}

async function loadFnHistory(
  annotationSetId: string
): Promise<FnHistory | null> {
  const bucketName = env.OUTPUTS_BUCKET_NAME;
  if (!bucketName) return null;
  const key = `false-negative-history/${annotationSetId}.json`;
  try {
    const response = await s3Client.send(
      new GetObjectCommand({ Bucket: bucketName, Key: key })
    );
    const bodyStr = await response.Body?.transformToString();
    if (!bodyStr) return null;
    return JSON.parse(bodyStr) as FnHistory;
  } catch (error: any) {
    if (error?.name === 'NoSuchKey' || error?.Code === 'NoSuchKey') return null;
    console.warn('Failed to load FN history', { key, error: error?.message });
    return null;
  }
}

async function saveFnPool(
  annotationSetId: string,
  pool: FnPool
): Promise<void> {
  const bucketName = env.OUTPUTS_BUCKET_NAME;
  if (!bucketName) {
    console.warn('OUTPUTS_BUCKET_NAME not set, cannot save FN pool');
    return;
  }
  const key = `false-negative-pools/${annotationSetId}.json`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: JSON.stringify(pool),
      ContentType: 'application/json',
    })
  );
  console.log('Saved updated FN pool', { key, poolSize: pool.poolSize });
}

async function saveFnHistory(
  annotationSetId: string,
  history: FnHistory
): Promise<void> {
  const bucketName = env.OUTPUTS_BUCKET_NAME;
  if (!bucketName) {
    console.warn('OUTPUTS_BUCKET_NAME not set, cannot save FN history');
    return;
  }
  const key = `false-negative-history/${annotationSetId}.json`;
  await s3Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: JSON.stringify(history),
      ContentType: 'application/json',
    })
  );
  console.log('Saved updated FN history', {
    key,
    totalLaunched: history.totalLaunched,
  });
}

// ── Geometric helpers ──

function isInsideTile(px: number, py: number, tile: MinimalTile): boolean {
  const halfW = tile.width / 2;
  const halfH = tile.height / 2;
  return (
    px >= tile.x - halfW &&
    px <= tile.x + halfW &&
    py >= tile.y - halfH &&
    py <= tile.y + halfH
  );
}

function tilesOverlap(
  tile1: MinimalTile,
  tile2: { x: number; y: number; width: number; height: number }
): boolean {
  const halfW1 = tile1.width / 2;
  const halfH1 = tile1.height / 2;
  const halfW2 = tile2.width / 2;
  const halfH2 = tile2.height / 2;

  return (
    tile1.x - halfW1 < tile2.x + halfW2 &&
    tile1.x + halfW1 > tile2.x - halfW2 &&
    tile1.y - halfH1 < tile2.y + halfH2 &&
    tile1.y + halfH1 > tile2.y - halfH2
  );
}
