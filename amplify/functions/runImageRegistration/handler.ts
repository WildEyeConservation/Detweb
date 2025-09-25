import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/runImageRegistration';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs';
import type { SendMessageBatchRequestEntry } from '@aws-sdk/client-sqs';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import {
  cameraOverlapsByProjectId,
  getImageNeighbour,
  imagesByProjectId,
  getProject,
} from './graphql/queries';
import { createImageNeighbour } from './graphql/mutations';
import {
  CameraOverlap,
  Image,
  GetImageNeighbourQuery,
  GetProjectQuery,
} from '../runImageRegistration/graphql/API';

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
  image1: Image,
  image2: Image,
  masks: number[][][],
  computeKey: (orig: string) => string
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

    if (!existingNeighbour) {
      try {
        await gqlWithRetry(() =>
          client.graphql({
            query: createImageNeighbour,
            variables: {
              input: {
                image1Id: image1.id,
                image2Id: image2.id,
              },
            },
          })
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
  images: Image[],
  masks: number[][][],
  seenPairs: Set<string>,
  outTasks: Array<() => Promise<SqsEntry | null>>,
  computeKey: (orig: string) => string
) {
  for (let i = 0; i < images.length - 1; i++) {
    const image1 = images[i];
    const image2 = images[i + 1];
    const timeDeltaSeconds = (image2.timestamp ?? 0) - (image1.timestamp ?? 0);
    if (timeDeltaSeconds < 5) {
      const key = [image1.id, image2.id].sort().join('|');
      if (!seenPairs.has(key)) {
        seenPairs.add(key);
        outTasks.push(() => handlePair(image1, image2, masks, computeKey));
      }
    } else {
      console.log(
        `Skipping pair ${image1.id} and ${image2.id} because the time difference is greater than 5 seconds`,
        timeDeltaSeconds
      );
    }
  }
}

export const handler: Handler = async (event) => {
  try {
    const projectId = event.arguments.projectId as string;
    const metadata = JSON.parse(event.arguments.metadata) as {
      masks: number[][][];
    };
    const masks = metadata.masks;
    const queueUrl = event.arguments.queueUrl as string;

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

    const computeKey = (orig: string) =>
      !isLegacyProject && organizationId
        ? `${organizationId}/${projectId}/${orig}`
        : orig;

    const images = await fetchAllPages<Image, 'imagesByProjectId'>(
      (nextToken) =>
        client.graphql({
          query: imagesByProjectId,
          variables: { projectId, nextToken, limit: 1000 },
        }) as Promise<GraphQLResult<{ imagesByProjectId: PagedList<Image> }>>,
      'imagesByProjectId'
    );

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
          variables: { projectId, nextToken, limit: 1000 },
        }) as Promise<
          GraphQLResult<{ cameraOverlapsByProjectId: PagedList<CameraOverlap> }>
        >,
      'cameraOverlapsByProjectId'
    );

    // keep track of images with no camera information (this should never happen but just in case)
    const noCamImgs: Image[] = [];

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
    }, {} as Record<string, Image[]>);

    const tasks: Array<() => Promise<SqsEntry | null>> = [];
    const seenPairs = new Set<string>();

    // process images by camera
    Object.entries(imagesByCamera).forEach(([, images]) => {
      addAdjacentPairTasks(images, masks, seenPairs, tasks, computeKey);
    });

    // process images from overlapping cameras
    cameraOverlaps.forEach((overlap) => {
      const imgsA = imagesByCamera[overlap.cameraAId] ?? [];
      const imgsB = imagesByCamera[overlap.cameraBId] ?? [];

      // interleave images from the two cameras
      const mergedImages = [...imgsA, ...imgsB].sort(
        (a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0)
      );

      addAdjacentPairTasks(mergedImages, masks, seenPairs, tasks, computeKey);
    });

    // process images with no camera
    addAdjacentPairTasks(noCamImgs, masks, seenPairs, tasks, computeKey);

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
