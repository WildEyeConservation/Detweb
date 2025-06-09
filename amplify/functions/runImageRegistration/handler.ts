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
  masks: string
  // inputBucket: string
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

    const arrMasks = JSON.parse(masks) as any[];

    // Return the message instead of sending it immediately
    return {
      Id: `${image1.id}-${image2.id}`, // Required unique ID for batch entries
      MessageBody: JSON.stringify({
        // inputBucket,
        image1Id: image1.id,
        image2Id: image2.id,
        keys: [image1.originalPath, image2.originalPath],
        action: 'register',
        masks: arrMasks.length > 0 ? arrMasks : undefined,
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
    const sortedImageStrings = imageObjects.map(
      ({ originalString }) => originalString
    );
    const masks = event.arguments.masks as string;
    // const inputBucket = event.inputBucket as string;
    const queueUrl = event.arguments.queueUrl as string;

    const TIME_THRESHOLD_MS = 60000;
    const pairPromises: Array<ReturnType<typeof handlePair>> = [];
    for (let i = 0; i < sortedImages.length - 1; i++) {
      const remaining = context.getRemainingTimeInMillis();
      if (remaining < TIME_THRESHOLD_MS) {
        console.log(
          `Remaining time ${remaining}ms is less than threshold, re-invoking lambda with ${
            sortedImageStrings.length - i
          } remaining images`
        );
        const lambdaClient = new LambdaClient({
          region: env.AWS_REGION,
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            sessionToken: env.AWS_SESSION_TOKEN,
          },
        });
        const remainingImageStrings = sortedImageStrings.slice(i);
        await lambdaClient.send(
          new InvokeCommand({
            FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME!,
            InvocationType: 'Event',
            Payload: Buffer.from(
              JSON.stringify({
                images: remainingImageStrings,
                masks,
                // inputBucket,
                queueUrl,
              })
            ),
          })
        );
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'Lambda re-invoked with remaining images',
            remainingCount: remainingImageStrings.length,
          }),
        };
      }
      const image1 = sortedImages[i];
      const image2 = sortedImages[i + 1];
      if ((image2.timestamp ?? 0) - (image1.timestamp ?? 0) < 5) {
        pairPromises.push(handlePair(image1, image2, masks));
      } else {
        console.log(
          `Skipping pair ${image1.id} and ${image2.id} because the time difference is greater than 5 seconds`,
          image1.timestamp,
          image2.timestamp,
          (image2.timestamp ?? 0) - (image1.timestamp ?? 0)
        );
      }
    }

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
