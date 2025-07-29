import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/runImageRegistration';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import { getImageNeighbour, imagesByProjectId } from './graphql/queries';
import { createImageNeighbour } from './graphql/mutations';

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

interface Image {
  id: string;
  originalPath: string;
  timestamp: number;
}

const client = generateClient({
  authMode: 'iam',
});

interface PagedList<T> {
  items: T[];
  nextToken: string | null | undefined;
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
  masks: number[][][]
) {
  try {
    console.log(`Processing pair ${image1.id} and ${image2.id}`);
    const {
      data: { getImageNeighbour: existingNeighbour },
    } = await client.graphql({
      query: getImageNeighbour,
      variables: {
        image1Id: image1.id,
        image2Id: image2.id,
      },
    });

    if (existingNeighbour?.homography) {
      console.log(
        `Homography already exists for pair ${image1.id} and ${image2.id}`
      );
      return null; // Return null for filtered pairs
    }

    if (!existingNeighbour) {
      await client.graphql({
        query: createImageNeighbour,
        variables: {
          input: {
            image1Id: image1.id,
            image2Id: image2.id,
          },
        },
      });
    }

    // Return the message instead of sending it immediately
    return {
      Id: `${image1.id}-${image2.id}`, // Required unique ID for batch entries
      MessageBody: JSON.stringify({
        image1Id: image1.id,
        image2Id: image2.id,
        keys: [image1.originalPath, image2.originalPath],
        action: 'register',
        masks: masks.length > 0 ? masks : undefined,
      }),
    };
  } catch (error: any) {
    console.error(`Error in handlePair for ${image1.id} and ${image2.id}:`, error);
    return null;
  }
}

export const handler: Handler = async (event, context) => {
  try {
    // projectId and optional images input
    const imagesFromEvent = event.arguments.images as string[] | undefined;
    const projectId = event.arguments.projectId as string;
    const metadata = JSON.parse(event.arguments.metadata as string) as {
      masks: number[][][];
      cameraSelection: [string, string[]];
      overlaps: { cameraA: string; cameraB: string }[];
      overlapInterval: number;
    };

    let originalEventImages = imagesFromEvent ?? [];
    if (originalEventImages.length === 0) {
      console.log(
        `No images provided, fetching images for project ${projectId}`
      );
      const fetchedItems = await fetchAllPages<Image, 'imagesByProjectId'>(
        (nextToken) =>
          client.graphql({
            query: imagesByProjectId,
            variables: { projectId, nextToken },
          }) as Promise<GraphQLResult<{ imagesByProjectId: PagedList<Image> }>>,
        'imagesByProjectId'
      );
      originalEventImages = fetchedItems.map(
        (item) => `${item.id}---${item.originalPath}---${item.timestamp}`
      );
    }
    const imageObjects = originalEventImages.map((imageStr) => {
      const [id, originalPath, timestamp] = imageStr.split('---');
      return {
        originalString: imageStr,
        id,
        originalPath,
        timestamp: Number(timestamp),
      };
    });

    imageObjects.sort((a, b) => a.timestamp - b.timestamp);
    const sortedImages = imageObjects.map(
      ({ id, originalPath, timestamp }) => ({ id, originalPath, timestamp })
    );
    const queueUrl = event.arguments.queueUrl as string;

    const selectionLevel = Number(metadata.cameraSelection[0]);
    const cameraNames = metadata.cameraSelection[1];
    const imagesByCamera: Record<string, Image[]> = {};
    for (const img of sortedImages) {
      const cameraName = img.originalPath.split('/')[selectionLevel];
      if (!imagesByCamera[cameraName]) {
        imagesByCamera[cameraName] = [];
      }
      imagesByCamera[cameraName].push(img);
    }
    cameraNames.forEach((cam) => {
      if (imagesByCamera[cam]) {
        imagesByCamera[cam].sort((a, b) => a.timestamp - b.timestamp);
      } else {
        imagesByCamera[cam] = [];
      }
    });
    const pairSet = new Set<string>();
    const pairPromises: Array<ReturnType<typeof handlePair>> = [];
    const halfIntervalS = metadata.overlapInterval / 2;
    const graceS = 1;
    const windowS = halfIntervalS + graceS;
    // Add window-based pairs for overlapping cameras
    metadata.overlaps.forEach(({ cameraA, cameraB }) => {
      [cameraA, cameraB].forEach((cam) => {
        const imgs = imagesByCamera[cam] || [];
        imgs.forEach((img) => {
          const windowStart = img.timestamp - windowS;
          const windowEnd = img.timestamp + windowS;
          [cameraA, cameraB].forEach((otherCam) => {
            const otherImgs = imagesByCamera[otherCam] || [];
            otherImgs.forEach((otherImg) => {
              if (otherImg.id === img.id) return;
              if (
                otherImg.timestamp >= windowStart &&
                otherImg.timestamp <= windowEnd
              ) {
                const key = [img.id, otherImg.id].sort().join('-');
                if (!pairSet.has(key)) {
                  pairSet.add(key);
                  pairPromises.push(handlePair(img, otherImg, metadata.masks));
                }
              }
            });
          });
        });
      });
    });
    // Add adjacent same-camera pairs to ensure direct neighbors
    cameraNames.forEach((cam) => {
      const imgs = imagesByCamera[cam] || [];
      for (let i = 0; i < imgs.length - 1; i++) {
        const img1 = imgs[i];
        const img2 = imgs[i + 1];
        const key = [img1.id, img2.id].sort().join('-');
        if (!pairSet.has(key)) {
          pairSet.add(key);
          pairPromises.push(handlePair(img1, img2, metadata.masks));
        }
      }
    });

    const messages = (await Promise.all(pairPromises)).filter(
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
      } catch (error: any) {
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
  } catch (error: any) {
    console.error('Error in runImageRegistration:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error running image registration',
        error: error.message,
      }),
    };
  }
};
