/**
 * Global deduplication Lambda for homography queues.
 * Triggered by cleanupJobs when a homography queue is fully processed.
 *
 * For each annotation in the set, projects its (x,y) through homographies
 * into all chronologically older neighbouring images. If visible in any
 * older neighbour the annotation is Secondary (objectId = null), otherwise
 * Primary (objectId = annotation.id).
 */
import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/reconcileHomographies';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
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

// ── Types ──

type ImageMeta = {
  id: string;
  timestamp: number | null;
  width: number;
  height: number;
  originalPath: string | null;
};

type AnnotationRecord = {
  id: string;
  imageId: string;
  x: number;
  y: number;
  objectId: string | null;
};

/** Homography that maps FROM the owning image TO the neighbour */
type NeighbourEdge = {
  neighbourId: string;
  homography: number[]; // flat 9-element 3×3 matrix
};

// ── GraphQL queries ──

const getAnnotationSetQuery = /* GraphQL */ `
  query GetAnnotationSet($id: ID!) {
    getAnnotationSet(id: $id) {
      id
      projectId
    }
  }
`;

const imagesByProjectIdQuery = /* GraphQL */ `
  query ImagesByProjectId($projectId: ID!, $limit: Int, $nextToken: String) {
    imagesByProjectId(projectId: $projectId, limit: $limit, nextToken: $nextToken) {
      items {
        id
        timestamp
        width
        height
        originalPath
        leftNeighbours(limit: 100) {
          items {
            image2Id
            homography
            skipped
          }
        }
      }
      nextToken
    }
  }
`;

const annotationsBySetIdQuery = /* GraphQL */ `
  query AnnotationsBySetId($setId: ID!, $limit: Int, $nextToken: String) {
    annotationsByAnnotationSetId(setId: $setId, limit: $limit, nextToken: $nextToken) {
      items {
        id
        imageId
        x
        y
        objectId
      }
      nextToken
    }
  }
`;

const updateAnnotationMutation = /* GraphQL */ `
  mutation UpdateAnnotation($input: UpdateAnnotationInput!) {
    updateAnnotation(input: $input) {
      id
    }
  }
`;

// ── Homography math ──

/**
 * Apply a flat 9-element homography matrix to a 2D point.
 * H = [h11,h12,h13, h21,h22,h23, h31,h32,h33]
 * Returns the projected point in the target image's coordinate space.
 */
function applyHomography(H: number[], x: number, y: number): [number, number] {
  const w = H[6] * x + H[7] * y + H[8];
  return [(H[0] * x + H[1] * y + H[2]) / w, (H[3] * x + H[4] * y + H[5]) / w];
}

/**
 * Compute the inverse of a flat 9-element 3×3 matrix.
 * Returns a new flat 9-element array.
 */
function invertHomography(H: number[]): number[] {
  const [a, b, c, d, e, f, g, h, i] = H;
  const det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
  if (Math.abs(det) < 1e-10) throw new Error('Degenerate homography matrix');
  const inv = 1 / det;
  return [
    (e * i - f * h) * inv,
    (c * h - b * i) * inv,
    (b * f - c * e) * inv,
    (f * g - d * i) * inv,
    (a * i - c * g) * inv,
    (c * d - a * f) * inv,
    (d * h - e * g) * inv,
    (b * g - a * h) * inv,
    (a * e - b * d) * inv,
  ];
}

// ── Data fetching ──

async function fetchAnnotationSet(
  id: string
): Promise<{ id: string; projectId: string }> {
  const res = (await client.graphql({
    query: getAnnotationSetQuery,
    variables: { id },
  } as any)) as GraphQLResult<{
    getAnnotationSet?: { id: string; projectId: string } | null;
  }>;
  if (res.errors?.length)
    throw new Error(`Failed to fetch AnnotationSet: ${JSON.stringify(res.errors)}`);
  if (!res.data?.getAnnotationSet)
    throw new Error(`AnnotationSet ${id} not found`);
  return res.data.getAnnotationSet;
}

/**
 * Fetch all images for the project and build the bidirectional neighbour graph
 * in a single pass. Each image's nested `leftNeighbours` gives us every
 * ImageNeighbour record exactly once across all images.
 *
 * ImageNeighbour(image1Id, image2Id, H) stores H that maps image2→image1.
 * So: edge from image1→image2 needs invert(H), edge from image2→image1 uses H directly.
 */
async function fetchImagesAndGraph(
  projectId: string
): Promise<{ images: Map<string, ImageMeta>; graph: Map<string, NeighbourEdge[]> }> {
  const images = new Map<string, ImageMeta>();
  const graph = new Map<string, NeighbourEdge[]>();
  let nextToken: string | undefined;

  do {
    const res = (await client.graphql({
      query: imagesByProjectIdQuery,
      variables: { projectId, limit: 1000, nextToken },
    } as any)) as GraphQLResult<{
      imagesByProjectId?: {
        items?: Array<{
          id: string;
          timestamp: string | number | null;
          width: number;
          height: number;
          originalPath: string | null;
          leftNeighbours?: {
            items?: Array<{
              image2Id: string;
              homography: number[] | null;
              skipped: boolean | null;
            }>;
          };
        }>;
        nextToken?: string | null;
      };
    }>;
    if (res.errors?.length)
      throw new Error(`Failed to fetch images: ${JSON.stringify(res.errors)}`);

    for (const item of res.data?.imagesByProjectId?.items ?? []) {
      images.set(item.id, {
        id: item.id,
        timestamp: item.timestamp ? new Date(item.timestamp).getTime() : null,
        width: item.width,
        height: item.height,
        originalPath: item.originalPath ?? null,
      });

      for (const nb of item.leftNeighbours?.items ?? []) {
        if (nb.skipped || !nb.homography || nb.homography.length !== 9) continue;

        // image1 (item.id) → image2 (nb.image2Id): need inverse
        const invH = invertHomography(nb.homography);
        const edges1 = graph.get(item.id) ?? [];
        edges1.push({ neighbourId: nb.image2Id, homography: invH });
        graph.set(item.id, edges1);

        // image2 (nb.image2Id) → image1 (item.id): use H directly
        const edges2 = graph.get(nb.image2Id) ?? [];
        edges2.push({ neighbourId: item.id, homography: nb.homography });
        graph.set(nb.image2Id, edges2);
      }
    }
    nextToken = res.data?.imagesByProjectId?.nextToken ?? undefined;
  } while (nextToken);

  return { images, graph };
}

async function fetchAnnotations(setId: string): Promise<AnnotationRecord[]> {
  const annotations: AnnotationRecord[] = [];
  let nextToken: string | undefined;

  do {
    const res = (await client.graphql({
      query: annotationsBySetIdQuery,
      variables: { setId, limit: 1000, nextToken },
    } as any)) as GraphQLResult<{
      annotationsByAnnotationSetId?: {
        items?: Array<{
          id: string;
          imageId: string;
          x: number;
          y: number;
          objectId: string | null;
        }>;
        nextToken?: string | null;
      };
    }>;
    if (res.errors?.length)
      throw new Error(`Failed to fetch annotations: ${JSON.stringify(res.errors)}`);

    for (const item of res.data?.annotationsByAnnotationSetId?.items ?? []) {
      annotations.push({
        id: item.id,
        imageId: item.imageId,
        x: item.x,
        y: item.y,
        objectId: item.objectId ?? null,
      });
    }
    nextToken = res.data?.annotationsByAnnotationSetId?.nextToken ?? undefined;
  } while (nextToken);

  return annotations;
}

// ── Deduplication ──

/**
 * Deterministic ordering: compare by timestamp, then by originalPath as
 * tie-breaker (camera filenames are sequential / ascending).
 * Returns true if image A is strictly older than image B.
 */
function isOlder(a: ImageMeta, b: ImageMeta): boolean {
  if (a.timestamp !== null && b.timestamp !== null) {
    if (a.timestamp !== b.timestamp) return a.timestamp < b.timestamp;
    // Same timestamp — fall through to originalPath tie-breaker
  } else if (a.timestamp === null || b.timestamp === null) {
    // Images without timestamps cannot be ordered
    return false;
  }
  // Tie-breaker: camera filenames are ascending
  if (a.originalPath && b.originalPath) return a.originalPath < b.originalPath;
  return false;
}

function deduplicate(
  annotations: AnnotationRecord[],
  images: Map<string, ImageMeta>,
  graph: Map<string, NeighbourEdge[]>
): Array<{ id: string; objectId: string | null }> {
  const updates: Array<{ id: string; objectId: string | null }> = [];

  for (const ann of annotations) {
    const currentImg = images.get(ann.imageId);
    if (!currentImg) continue;

    const neighbours = graph.get(ann.imageId) ?? [];

    let seenEarlier = false;
    for (const edge of neighbours) {
      const neighbourImg = images.get(edge.neighbourId);
      if (!neighbourImg) continue;
      if (!isOlder(neighbourImg, currentImg)) continue;

      // Project annotation into the older neighbour's coordinate space
      const [px, py] = applyHomography(edge.homography, ann.x, ann.y);

      if (px >= 0 && px < neighbourImg.width && py >= 0 && py < neighbourImg.height) {
        seenEarlier = true;
        break;
      }
    }

    const correctObjectId = seenEarlier ? null : ann.id;

    // Only queue an update if the status actually changed
    if (ann.objectId !== correctObjectId) {
      updates.push({ id: ann.id, objectId: correctObjectId });
    }
  }

  return updates;
}

// ── Batch update ──

async function batchUpdate(
  updates: Array<{ id: string; objectId: string | null }>
): Promise<void> {
  const limit = pLimit(100);
  let completed = 0;

  const tasks = updates.map((update) =>
    limit(async () => {
      try {
        await client.graphql({
          query: updateAnnotationMutation,
          variables: { input: update },
        } as any);
        completed++;
        if (completed % 1000 === 0) {
          console.log(`Updated ${completed}/${updates.length} annotations`);
        }
      } catch (err) {
        console.warn('Failed to update annotation', { id: update.id, error: err });
      }
    })
  );

  await Promise.all(tasks);
  console.log(`Completed ${completed}/${updates.length} annotation updates`);
}

// ── Handler ──

export const handler: Handler = async (event) => {
  try {
    const payload = typeof event === 'string' ? JSON.parse(event) : event;
    const { annotationSetId } = payload;

    if (!annotationSetId) {
      console.error('Missing annotationSetId in event');
      return { statusCode: 400, body: 'Missing annotationSetId' };
    }

    console.log('reconcileHomographies invoked', { annotationSetId });

    // 1. Get projectId from the annotation set
    const annotationSet = await fetchAnnotationSet(annotationSetId);
    console.log('Fetched annotation set', { projectId: annotationSet.projectId });

    // 2. Fetch all images + neighbour graph in a single pass
    const { images, graph } = await fetchImagesAndGraph(annotationSet.projectId);
    console.log('Fetched images and graph', {
      images: images.size,
      imagesWithNeighbours: graph.size,
      totalEdges: Array.from(graph.values()).reduce((sum, edges) => sum + edges.length, 0),
    });

    // 3. Fetch all annotations for the set
    const annotations = await fetchAnnotations(annotationSetId);
    console.log('Fetched annotations', { count: annotations.length });

    if (annotations.length === 0) {
      console.log('No annotations to reconcile');
      return { statusCode: 200, body: JSON.stringify({ updated: 0 }) };
    }

    // 4. Run deduplication
    const updates = deduplicate(annotations, images, graph);
    console.log('Deduplication complete', {
      total: annotations.length,
      changed: updates.length,
      primary: annotations.length - updates.filter((u) => u.objectId === null).length,
      secondary: updates.filter((u) => u.objectId === null).length,
    });

    // 5. Batch update changed annotations
    if (updates.length > 0) {
      await batchUpdate(updates);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        total: annotations.length,
        updated: updates.length,
      }),
    };
  } catch (error: any) {
    console.error('reconcileHomographies failed', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Reconciliation failed',
        error: error?.message ?? 'Unknown error',
      }),
    };
  }
};
