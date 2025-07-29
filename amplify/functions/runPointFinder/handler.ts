import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/runPointFinder';
import { Amplify } from 'aws-amplify';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { generateClient, GraphQLResult } from 'aws-amplify/data';
import { imagesByProjectId, locationSetsByProjectId } from './graphql/queries';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

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

interface Image {
  id: string;
  projectId: string;
  originalPath: string;
}

async function fetchAllPages<T, K extends string>(
  queryFn: (
    nextToken?: string
  ) => Promise<GraphQLResult<{ [key in K]: PagedList<T> }>>,
  queryName: K
): Promise<T[]> {
  const allItems: T[] = [];
  let nextToken: string | undefined;

  do {
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

export const handler: Handler = async (event, context) => {
  const projectId = event.arguments?.projectId ?? (event.projectId as string);
  if (!projectId) {
    console.error('projectId not provided');
    throw new Error('projectId not provided');
  }
  try {
    const images = await fetchAllPages<Image, 'imagesByProjectId'>(
      (nextToken) =>
        client.graphql({
          query: imagesByProjectId,
          variables: {
            projectId,
            limit: 1000,
            nextToken,
          },
        }) as Promise<GraphQLResult<{ imagesByProjectId: PagedList<Image> }>>,
      'imagesByProjectId'
    );

    const {
      data: { locationSetsByProjectId: locationSets },
    } = await client.graphql({
      query: locationSetsByProjectId,
      variables: {
        projectId,
      },
    });

    const locationSet = locationSets.items.find((locationSet) =>
      locationSet.name.includes('elephant-detection-nadir')
    );

    if (!locationSet) {
      console.error('Location set not found');
      throw new Error('Location set not found');
    }

    const ssmClient = new SSMClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        sessionToken: env.AWS_SESSION_TOKEN,
      },
    });

    const { Parameter } = await ssmClient.send(
      new GetParameterCommand({ Name: env.POINT_FINDER_QUEUE_URL_PARAM })
    );
    const queueUrl = Parameter!.Value!;

    const sqsClient = new SQSClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        sessionToken: env.AWS_SESSION_TOKEN,
      },
    });

    try {
      await Promise.all(
        images.map(async (image) => {
          try {
            await sqsClient.send(
              new SendMessageCommand({
                QueueUrl: queueUrl,
                MessageBody: JSON.stringify({
                  imageId: image.id,
                  projectId: image.projectId,
                  key: 'heatmaps/' + image.originalPath + '.h5',
                  width: 1024,
                  height: 1024,
                  threshold: 0.95,
                  bucket: env.OUTPUTS_BUCKET_NAME,
                  setId: locationSet.id,
                }),
              })
            );
            console.info(
              `Point finder job submitted for ${image.originalPath}`
            );
          } catch (err) {
            console.warn(
              `Error submitting point finder job for ${image.originalPath}:`,
              err
            );
          }
        })
      );
    } catch (error: any) {
      console.error('Error in runPointFinder:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    }
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Images received',
        count: images.length,
      }),
    };
  } catch (error: any) {
    console.error('Error in runPointFinder:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error running point finder',
        error: error.message,
      }),
    };
  }
};
