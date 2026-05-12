import type { RunImageRegistrationHandler } from '../../data/resource';
import { env } from '$amplify/env/runImageRegistration';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { authorizeRequest } from '../shared/authorizeRequest';
import { SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs';
import type { SendMessageBatchRequestEntry } from '@aws-sdk/client-sqs';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import {
  cameraOverlapsByProjectId,
  getImageNeighbour,
  imagesByProjectId,
  getProject,
} from './graphql/queries';
import {
  CameraOverlap,
  GetImageNeighbourQuery,
  GetProjectQuery,
} from '../runImageRegistration/graphql/API';

// Inline minimal mutation – return composite key fields + `group` to avoid
// nested-resolver auth failures while enabling subscription delivery via groupDefinedIn('group').
const createImageNeighbour = /* GraphQL */ `
  mutation CreateImageNeighbour($input: CreateImageNeighbourInput!) {
    createImageNeighbour(input: $input) { image1Id image2Id group cameraPairKey bucketIndex }
  }
`;

const deleteImageNeighbour = /* GraphQL */ `
  mutation DeleteImageNeighbour($input: DeleteImageNeighbourInput!) {
    deleteImageNeighbour(input: $input) { image1Id image2Id }
  }
`;

// Custom atomic upsert on RegistrationProgress. Called once at the end of this
// lambda to bump pairsCreated by the number of SQS messages we actually queued
// and to force cleanupState back to 'pending' so the monitor picks this run up.
const incrementRegistrationProgress = /* GraphQL */ `
  mutation IncrementRegistrationProgress(
    $projectId: ID!
    $pairsCreatedDelta: Int
    $pairsProcessedDelta: Int
    $resetCleanupState: Boolean
    $group: String
  ) {
    incrementRegistrationProgress(
      projectId: $projectId
      pairsCreatedDelta: $pairsCreatedDelta
      pairsProcessedDelta: $pairsProcessedDelta
      resetCleanupState: $resetCleanupState
      group: $group
    )
  }
`;

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

const client = generateClient({
  authMode: 'iam',
});

interface PagedList<T> {
  items: T[];
  nextToken: string | null | undefined;
}

type SqsEntry = SendMessageBatchRequestEntry;

// Minimal image fields needed for registration and pairing logic
interface MinimalImage {
  id: string;
  originalPath?: string | null;
  timestamp?: number | null;
  cameraId?: string | null;
}

// Simple exponential backoff for transient errors on GraphQL calls
async function gqlWithRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attemptIndex = 0; attemptIndex < attempts; attemptIndex++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      const delayMs = 300 * 2 ** attemptIndex + Math.random() * 200;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError as Error;
}

// Concurrency limiter for running many async tasks without overwhelming the runtime
async function withConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit: number
): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    for (
      let currentIndex = nextIndex++;
      currentIndex < tasks.length;
      currentIndex = nextIndex++
    ) {
      results[currentIndex] = await tasks[currentIndex]();
    }
  }

  const workerCount = Math.min(limit, tasks.length || 1);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

// Helper function to handle pagination for GraphQL queries
async function fetchAllPages<T, K extends string>(
  queryFn: (
    nextToken?: string
  ) => Promise<GraphQLResult<{ [key in K]: PagedList<T> }>>,
  queryName: K
): Promise<T[]> {
  const allItems: T[] = [];
  let nextToken: string | undefined;

  do {
    console.log(`Fetching ${queryName} next page`);
    const response = await queryFn(nextToken);
    const items = response.data?.[queryName]?.items ?? [];
    allItems.push(...(items as T[]));
    nextToken = response.data?.[queryName]?.nextToken ?? undefined;
  } while (nextToken);

  console.log(
    `Completed fetching all ${queryName} pages. Total items: ${allItems.length}`
  );
  return allItems;
}

async function handlePair(
  image1: MinimalImage,
  image2: MinimalImage,
  masks: number[][][],
  computeKey: (orig: string) => string,
  projectId: string,
  organizationId?: string,
  // Set only for cross-camera pairs. Same-camera pairs leave these null,
  // which keeps them out of the bucket-cleanup GSI.
  cameraPairKey?: string,
  bucketIndex?: number,
  // When true, skip pairs that already have suggestedPoints1 set (i.e.
  // LightGlue already tried and failed). Used by re-runs that want to fill
  // newly-introduced pairs without re-paying compute on known-failed ones.
  skipExistingSuggestions?: boolean
) {
  try {
    console.log(`Processing pair ${image1.id} and ${image2.id}`);

    if (!image1 || !image2) {
      console.log(
        `Skipping pair ${image1.id} and ${image2.id} because one of the images is null`
      );
      return null;
    }

    const neighbourResp = (await gqlWithRetry(() =>
      client.graphql({
        query: getImageNeighbour,
        variables: {
          image1Id: image1.id,
          image2Id: image2.id,
        },
      })
    )) as GraphQLResult<GetImageNeighbourQuery>;
    const existingNeighbour = neighbourResp.data?.getImageNeighbour;

    if (existingNeighbour?.homography) {
      console.log(
        `Homography already exists for pair ${image1.id} and ${image2.id}`
      );
      return null; // Return null for filtered pairs
    }

    if (skipExistingSuggestions) {
      // suggestedPoints1 isn't always typed on the generated client schema —
      // access via untyped cast so this works even if codegen is stale.
      const suggested = (existingNeighbour as { suggestedPoints1?: number[] | null } | null | undefined)?.suggestedPoints1;
      if (Array.isArray(suggested) && suggested.length > 0) {
        console.log(
          `Suggestions already exist for pair ${image1.id} and ${image2.id}; skipping (skipExistingSuggestions)`
        );
        return null;
      }
    }

    if (!existingNeighbour) {
      // bucketIndex is the GSI sort key — DynamoDB rejects an explicit null
      // ("Type mismatch ... Expected: N Actual: NULL"). For same-camera pairs
      // we want the attributes ABSENT, not null, so the row simply isn't
      // projected into the GSI. Build the input conditionally.
      const input: Record<string, unknown> = {
        image1Id: image1.id,
        image2Id: image2.id,
        group: organizationId,
      };
      if (cameraPairKey != null && bucketIndex != null) {
        input.cameraPairKey = cameraPairKey;
        input.bucketIndex = bucketIndex;
      }

      try {
        await gqlWithRetry(() =>
          client.graphql({
            query: createImageNeighbour,
            variables: { input },
          }) as Promise<GraphQLResult<any>>
        );
      } catch (e: unknown) {
        const errors = ((): unknown[] => {
          if (typeof e === 'object' && e !== null && 'errors' in e) {
            const maybe = (e as { errors?: unknown }).errors;
            if (Array.isArray(maybe)) return maybe;
          }
          return [];
        })();
        const isConditionalFailure = errors.some((x) => {
          if (typeof x === 'object' && x !== null && 'errorType' in x) {
            const errorType = (x as { errorType?: unknown }).errorType;
            return String(errorType ?? '').includes(
              'ConditionalCheckFailedException'
            );
          }
          return false;
        });
        if (isConditionalFailure) {
          console.log(
            `Neighbour already exists (created concurrently) for ${image1.id}/${image2.id}`
          );
        } else {
          throw e;
        }
      }
    }

    // Return the message instead of sending it immediately
    const originalPath1 = image1.originalPath ?? null;
    const originalPath2 = image2.originalPath ?? null;
    if (!originalPath1 || !originalPath2) {
      console.log(
        `Skipping pair ${image1.id} and ${image2.id} due to missing originalPath`
      );
      return null;
    }

    return {
      Id: `${image1.id}-${image2.id}`, // Required unique ID for batch entries
      MessageBody: JSON.stringify({
        image1Id: image1.id,
        image2Id: image2.id,
        keys: [computeKey(originalPath1), computeKey(originalPath2)],
        action: 'register',
        masks: masks.length > 0 ? masks : undefined,
        // Container uses these to write ImageProcessedBy and bucket counters.
        projectId,
        group: organizationId,
        cameraPairKey: cameraPairKey ?? null,
        bucketIndex: bucketIndex ?? null,
      }),
    };
  } catch (error: unknown) {
    console.error(
      `Error in handlePair for ${image1.id} and ${image2.id}:`,
      error
    );
    return null;
  }
}

function addAdjacentPairTasks(
  images: MinimalImage[],
  masks: number[][][],
  seenPairs: Set<string>,
  outTasks: Array<() => Promise<SqsEntry | null>>,
  computeKey: (orig: string) => string,
  projectId: string,
  organizationId?: string,
  skipExistingSuggestions?: boolean
) {
  for (let i = 0; i < images.length - 1; i++) {
    const image1 = images[i];
    const image2 = images[i + 1];
    const timeDeltaSeconds = (image2.timestamp ?? 0) - (image1.timestamp ?? 0);
    if (timeDeltaSeconds < 5) {
      const key = [image1.id, image2.id].sort().join('|');
      if (!seenPairs.has(key)) {
        seenPairs.add(key);
        outTasks.push(() =>
          handlePair(
            image1,
            image2,
            masks,
            computeKey,
            projectId,
            organizationId,
            undefined,
            undefined,
            skipExistingSuggestions
          )
        );
      }
    } else {
      console.log(
        `Skipping pair ${image1.id} and ${image2.id} because the time difference is greater than 5 seconds`,
        timeDeltaSeconds
      );
    }
  }
}

// Median consecutive timestamp delta within a sorted image list. Returns null when
// there is insufficient data to estimate a firing interval. Median (vs mean) is robust
// to dropped frames, which would otherwise skew the estimate via long gaps.
function medianConsecutiveDelta(sortedImgs: MinimalImage[]): number | null {
  if (sortedImgs.length < 2) return null;
  const deltas: number[] = [];
  for (let i = 1; i < sortedImgs.length; i++) {
    const t1 = sortedImgs[i - 1].timestamp;
    const t2 = sortedImgs[i].timestamp;
    if (t1 != null && t2 != null) {
      const d = t2 - t1;
      if (d > 0) deltas.push(d);
    }
  }
  if (deltas.length === 0) return null;
  deltas.sort((a, b) => a - b);
  const mid = Math.floor(deltas.length / 2);
  return deltas.length % 2 === 0
    ? (deltas[mid - 1] + deltas[mid]) / 2
    : deltas[mid];
}

// Per-direction thresholds for cross-camera nearest-neighbour pairing.
// The gap from an image to its truly-synchronous partner on the other camera is ~0;
// the gap to the next-frame partner is the OTHER camera's firing interval. Half of that
// interval is the natural cutoff that separates "right partner" from "next-frame partner".
const DEFAULT_THRESHOLD_SECONDS = 1.0;
// Integer-second timestamps mean any threshold < 1.0s effectively requires
// pairs to share the exact same stored second — much stricter than the rig
// actually is. Bumping the floor to 2.0s opens it to Δt ∈ {0, 1, 2} which
// catches truncation-artifact straddles, clock drift, and near-boundary
// edges. The bucket cleanup absorbs any "wrong frame" partners pulled in.
const MIN_THRESHOLD_SECONDS = 2.0;
const MAX_THRESHOLD_SECONDS = 5.0;

function deriveCrossCameraThresholds(
  imgsA: MinimalImage[],
  imgsB: MinimalImage[]
): { thresholdToB: number; thresholdToA: number } {
  const medianA = medianConsecutiveDelta(imgsA);
  const medianB = medianConsecutiveDelta(imgsB);
  const clamp = (v: number) =>
    Math.max(MIN_THRESHOLD_SECONDS, Math.min(v, MAX_THRESHOLD_SECONDS));
  return {
    thresholdToB: clamp(0.5 * (medianB ?? medianA ?? DEFAULT_THRESHOLD_SECONDS)),
    thresholdToA: clamp(0.5 * (medianA ?? medianB ?? DEFAULT_THRESHOLD_SECONDS)),
  };
}

// Binary-search the index of the nearest candidate by timestamp, gated by a max
// gap. Returns -1 when no candidate is within threshold. `candidates` must be
// sorted ascending by timestamp.
function findNearestIndex(
  target: MinimalImage,
  candidates: MinimalImage[],
  thresholdSeconds: number
): number {
  if (candidates.length === 0 || target.timestamp == null) return -1;
  const t = target.timestamp;
  let lo = 0;
  let hi = candidates.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if ((candidates[mid].timestamp ?? 0) < t) lo = mid + 1;
    else hi = mid;
  }
  let bestIdx = -1;
  let bestDelta = Infinity;
  for (const i of [lo - 1, lo]) {
    if (i < 0 || i >= candidates.length) continue;
    const c = candidates[i];
    if (c.timestamp == null || c.id === target.id) continue;
    const delta = Math.abs(c.timestamp - t);
    if (delta < bestDelta) {
      bestDelta = delta;
      bestIdx = i;
    }
  }
  return bestIdx !== -1 && bestDelta <= thresholdSeconds ? bestIdx : -1;
}

// Canonical key for a camera-overlap pair. Sorting the IDs lexicographically
// makes the key independent of which side of the CameraOverlap row the user
// configured each camera on, and also fixes which camera we treat as the
// "A side" (= lower id) so the bucketIndex labels are consistent across the
// whole survey.
function canonicalCameraPairKey(camIdX: string, camIdY: string): string {
  return camIdX < camIdY ? `${camIdX}|${camIdY}` : `${camIdY}|${camIdX}`;
}

// For each image on the "A" side (lower-id camera), create up to three pairs
// with images on the "B" side: bucket 0 = A's nearest B, bucket -1 = the B
// one frame earlier on B's track, bucket +1 = one frame later. The nearest
// lookup is threshold-gated (drops A's with no plausibly-synchronous B), but
// once a nearest exists the ±1 partners are taken unconditionally — they're
// the "wrong-frame" hypotheses we want to measure against the nearest.
// Pairs are stored with image1 = earlier-timestamp to match existing ordering.
// bucketIndex is always computed from A's perspective (offset on B's track),
// so the same physical rig-offset lands in the same bucket across all A's.
function addNearestBucketTasks(
  imgsACam: MinimalImage[],
  imgsBCam: MinimalImage[],
  thresholdToB: number,
  cameraPairKey: string,
  masks: number[][][],
  seenPairs: Set<string>,
  outTasks: Array<() => Promise<SqsEntry | null>>,
  computeKey: (orig: string) => string,
  projectId: string,
  organizationId?: string,
  skipExistingSuggestions?: boolean
) {
  const queue = (
    x: MinimalImage,
    y: MinimalImage,
    bucketIndex: number
  ) => {
    const [first, second] =
      (x.timestamp ?? 0) <= (y.timestamp ?? 0) ? [x, y] : [y, x];
    const key = [first.id, second.id].sort().join('|');
    if (seenPairs.has(key)) return;
    seenPairs.add(key);
    outTasks.push(() =>
      handlePair(
        first,
        second,
        masks,
        computeKey,
        projectId,
        organizationId,
        cameraPairKey,
        bucketIndex,
        skipExistingSuggestions
      )
    );
  };

  for (const a of imgsACam) {
    const nIdx = findNearestIndex(a, imgsBCam, thresholdToB);
    if (nIdx === -1) continue;
    // bucket -1 (predecessor on B's track) — skipped at the start of B's track
    if (nIdx - 1 >= 0) queue(a, imgsBCam[nIdx - 1], -1);
    // bucket 0 (the nearest itself)
    queue(a, imgsBCam[nIdx], 0);
    // bucket +1 (successor on B's track) — skipped at the end of B's track
    if (nIdx + 1 < imgsBCam.length) queue(a, imgsBCam[nIdx + 1], 1);
  }
}

// For each maximal contiguous run of session images flanked by boundary images,
// queue a deletion of the now-stale direct pair between those flanking images.
// Runs in O(n) — one pass through the sorted list per camera/overlap group.
function addStalePairDeletionTasks(
  images: MinimalImage[],
  sessionIdSet: Set<string>,
  outTasks: Array<() => Promise<void>>
) {
  let leftBoundary: MinimalImage | null = null;
  let hasSessionSince = false;

  for (const img of images) {
    if (sessionIdSet.has(img.id)) {
      hasSessionSince = true;
    } else {
      if (leftBoundary && hasSessionSince) {
        const lb = leftBoundary;
        const rb = img;
        outTasks.push(async () => {
          const resp = (await gqlWithRetry(() =>
            client.graphql({
              query: getImageNeighbour,
              variables: { image1Id: lb.id, image2Id: rb.id },
            })
          )) as GraphQLResult<GetImageNeighbourQuery>;
          if (resp.data?.getImageNeighbour) {
            await gqlWithRetry(() =>
              client.graphql({
                query: deleteImageNeighbour,
                variables: { input: { image1Id: lb.id, image2Id: rb.id } },
              }) as Promise<GraphQLResult<any>>
            );
            console.log(`Deleted stale pair ${lb.id} / ${rb.id}`);
          }
        });
      }
      leftBoundary = img;
      hasSessionSince = false;
    }
  }
}

export const handler: RunImageRegistrationHandler = async (event, context) => {
  try {
    // Do not wait for open handles after we return a response
    context.callbackWaitsForEmptyEventLoop = false;
    const projectId = event.arguments.projectId;
    const metadata = JSON.parse(event.arguments.metadata) as {
      masks?: number[][][];
      images?: Array<{
        id: string;
        originalPath: string;
        timestamp?: number | null;
        cameraId?: string | null;
      }>;
      sessionIds?: string[];
      skipExistingSuggestions?: boolean;
    };
    const masks = Array.isArray(metadata?.masks) ? (metadata.masks as number[][][]) : [];
    const skipExistingSuggestions = !!metadata?.skipExistingSuggestions;
    const queueUrl = event.arguments.queueUrl;

    // Fetch project info to determine key prefixing
    let organizationId: string | undefined = undefined;
    let isLegacyProject = false;
    try {
      const projResp = (await client.graphql({
        query: getProject,
        variables: { id: projectId },
      })) as GraphQLResult<GetProjectQuery>;
      organizationId = projResp.data?.getProject?.organizationId;
      const tagsRaw = projResp.data?.getProject?.tags ?? [];
      const tags = Array.isArray(tagsRaw)
        ? tagsRaw.filter((t): t is string => typeof t === 'string')
        : [];
      isLegacyProject = tags.includes('legacy');
    } catch (e) {
      console.warn(
        'Unable to fetch project tags; defaulting to legacy=false behavior'
      );
    }

    if (organizationId) {
      authorizeRequest(event.identity, organizationId);
    }

    const computeKey = (orig: string) =>
      !isLegacyProject && organizationId
        ? `${organizationId}/${projectId}/${orig}`
        : orig;

    // If a batch of images was provided in metadata, use that to avoid scanning the entire project.
    // Otherwise, fall back to fetching all project images (legacy behavior).
    const providedBatch = Array.isArray(metadata?.images)
      ? metadata.images.filter((it): it is NonNullable<typeof it> => Boolean(it))
      : [];

    const images: MinimalImage[] = providedBatch.length
      ? providedBatch.map((it) => ({
        id: it.id,
        originalPath: it.originalPath,
        timestamp:
          typeof it.timestamp === 'number' ? (it.timestamp as number) : null,
        cameraId: (it.cameraId ?? null) as string | null,
      }))
      : (await fetchAllPages<
        // Fetch full Image records then map down to MinimalImage to keep types narrow
        { id: string; originalPath?: string | null; timestamp?: number | null; cameraId?: string | null },
        'imagesByProjectId'
      >(
        (nextToken) =>
          client.graphql({
            query: imagesByProjectId,
            variables: { projectId, nextToken, limit: 10000 },
          }) as Promise<
            GraphQLResult<{
              imagesByProjectId: PagedList<{
                id: string;
                originalPath?: string | null;
                timestamp?: number | null;
                cameraId?: string | null;
              }>;
            }>
          >,
        'imagesByProjectId'
      )).map((img) => ({
        id: img.id,
        originalPath: img.originalPath ?? null,
        timestamp: typeof img.timestamp === 'number' ? img.timestamp : null,
        cameraId: (img.cameraId ?? null) as string | null,
      }));

    const sortedImages = images.sort(
      (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
    );

    const cameraOverlaps = await fetchAllPages<
      CameraOverlap,
      'cameraOverlapsByProjectId'
    >(
      (nextToken) =>
        client.graphql({
          query: cameraOverlapsByProjectId,
          variables: { projectId, nextToken, limit: 10000 },
        }) as Promise<
          GraphQLResult<{ cameraOverlapsByProjectId: PagedList<CameraOverlap> }>
        >,
      'cameraOverlapsByProjectId'
    );

    // keep track of images with no camera information (this should never happen but just in case)
    const noCamImgs: MinimalImage[] = [];

    // group images by camera
    const imagesByCamera = sortedImages.reduce((acc, image) => {
      if (!image.cameraId) {
        noCamImgs.push(image);
        return acc;
      }

      const cameraId = image.cameraId;
      if (!acc[cameraId]) {
        acc[cameraId] = [];
      }
      acc[cameraId].push(image);

      return acc;
    }, {} as Record<string, MinimalImage[]>);

    const tasks: Array<() => Promise<SqsEntry | null>> = [];
    const seenPairs = new Set<string>();
    const deletionTasks: Array<() => Promise<void>> = [];
    const sessionIdSet = new Set<string>(
      Array.isArray(metadata?.sessionIds) ? metadata.sessionIds : []
    );

    // process images by camera
    Object.entries(imagesByCamera).forEach(([, images]) => {
      addAdjacentPairTasks(
        images,
        masks,
        seenPairs,
        tasks,
        computeKey,
        projectId,
        organizationId,
        skipExistingSuggestions
      );
      if (sessionIdSet.size > 0) {
        addStalePairDeletionTasks(images, sessionIdSet, deletionTasks);
      }
    });

    // process images from overlapping cameras using 3-nearest bucket pairing.
    // For each image on the lower-id camera (canonically "A"), we create up to
    // three pairs with images on the other camera ("B"): the nearest in time
    // (bucket 0) plus the immediate predecessor/successor on B's track (-1,
    // +1). Stats aggregated per bucket let monitorModelProgress's cleanup pick
    // the winning offset and delete losers. Stale-pair deletion at this layer
    // is deferred — the bucket cleanup absorbs the responsibility.
    cameraOverlaps.forEach((overlap) => {
      const camIdLow =
        overlap.cameraAId < overlap.cameraBId
          ? overlap.cameraAId
          : overlap.cameraBId;
      const camIdHigh =
        overlap.cameraAId < overlap.cameraBId
          ? overlap.cameraBId
          : overlap.cameraAId;
      const imgsACam = imagesByCamera[camIdLow] ?? [];
      const imgsBCam = imagesByCamera[camIdHigh] ?? [];
      if (imgsACam.length === 0 || imgsBCam.length === 0) return;

      const cameraPairKey = canonicalCameraPairKey(camIdLow, camIdHigh);
      // thresholdToB is the only one we need — we only iterate A and look up
      // B. It's gated by B's median firing interval (half-interval = the
      // boundary between "synchronous B" and "next-frame B").
      const { thresholdToB } = deriveCrossCameraThresholds(imgsACam, imgsBCam);
      console.log(
        `CameraOverlap ${cameraPairKey}: thresholdToB=${thresholdToB.toFixed(3)}s, |A|=${imgsACam.length}, |B|=${imgsBCam.length}`
      );

      addNearestBucketTasks(
        imgsACam,
        imgsBCam,
        thresholdToB,
        cameraPairKey,
        masks,
        seenPairs,
        tasks,
        computeKey,
        projectId,
        organizationId,
        skipExistingSuggestions
      );
    });

    // process images with no camera
    addAdjacentPairTasks(
      noCamImgs,
      masks,
      seenPairs,
      tasks,
      computeKey,
      projectId,
      organizationId,
      skipExistingSuggestions
    );
    if (sessionIdSet.size > 0 && noCamImgs.length > 0) {
      addStalePairDeletionTasks(noCamImgs, sessionIdSet, deletionTasks);
    }

    // Delete stale pairs before queuing new registration work
    if (deletionTasks.length > 0) {
      console.log(`Deleting ${deletionTasks.length} stale neighbour pair(s)`);
      await withConcurrency(deletionTasks, 10);
    }

    // Limit concurrency to prevent exhausting file descriptors and network resources
    const messages = (await withConcurrency<SqsEntry | null>(tasks, 10)).filter(
      (msg): msg is NonNullable<typeof msg> => msg !== null
    );

    const sqsClient = new SQSClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        sessionToken: env.AWS_SESSION_TOKEN,
      },
    });

    for (let i = 0; i < messages.length; i += 10) {
      const batch = messages.slice(i, i + 10);
      try {
        await sqsClient.send(
          new SendMessageBatchCommand({
            QueueUrl: queueUrl,
            Entries: batch,
          })
        );
      } catch (error: unknown) {
        console.error(`Error sending SQS batch at index ${i}:`, error);
      }
    }

    // Atomically bump pairsCreated by the number of pairs we actually queued
    // and force cleanupState back to 'pending'. The monitor will flip this to
    // 'in-progress' once the container has matched pairsProcessed up to
    // pairsCreated, which then invokes the bucket cleanup. No-op SQS sends
    // (messages.length === 0) still re-arm cleanupState so a previously-'done'
    // cycle gets re-evaluated on the next monitor pass.
    if (messages.length > 0 || sessionIdSet.size > 0) {
      try {
        await gqlWithRetry(() =>
          client.graphql({
            query: incrementRegistrationProgress,
            variables: {
              projectId,
              pairsCreatedDelta: messages.length,
              resetCleanupState: true,
              group: organizationId ?? null,
            },
          }) as Promise<GraphQLResult<any>>
        );
        console.log(
          `RegistrationProgress: pairsCreated += ${messages.length} for project ${projectId}`
        );
      } catch (e) {
        console.error('Failed to increment RegistrationProgress:', e);
      }
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Images received',
        count: sortedImages.length,
      }),
    };
  } catch (error: unknown) {
    console.error('Error in runImageRegistration:', error);
    const errorDetails = (() => {
      if (error instanceof Error) {
        return { message: error.message, stack: error.stack, name: error.name };
      }
      return { message: String(error) };
    })();
    console.error('Error details:', errorDetails);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error running image registration',
        error:
          error instanceof Error ? error.message : 'Unknown error occurred',
      }),
    };
  }
};
