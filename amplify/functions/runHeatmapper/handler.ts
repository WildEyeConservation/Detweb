import type { RunHeatmapperHandler } from '../../data/resource';
import { env } from '$amplify/env/runHeatmapper';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { authorizeRequest } from '../shared/authorizeRequest';

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

const gqlClient = generateClient({ authMode: 'iam' });

const getProjectOrganizationId = /* GraphQL */ `
  query GetProject($id: ID!) {
    getProject(id: $id) { organizationId }
  }
`;

export const handler: RunHeatmapperHandler = async (event) => {
  try {
    const projectId = event.arguments.projectId;

    // Authorize: fetch project org and verify user membership
    const projResp = (await gqlClient.graphql({
      query: getProjectOrganizationId,
      variables: { id: projectId },
    })) as GraphQLResult<{ getProject?: { organizationId?: string | null } }>;
    const organizationId = projResp.data?.getProject?.organizationId;
    if (organizationId) {
      authorizeRequest(event.identity, organizationId);
    }

    const imagePaths = event.arguments.images ?? [];

    //log a sample
    console.log('imagePath sample', imagePaths[0]);
    console.log('queue url', env.PROCESS_QUEUE_URL);

    const sqsClient = new SQSClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        sessionToken: env.AWS_SESSION_TOKEN,
      },
    });

    const s3Client = new S3Client({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        sessionToken: env.AWS_SESSION_TOKEN,
      },
    });

    try {
      await Promise.all(
        imagePaths.map(async (path) => {
          const heatmapFilePath = 'heatmaps/' + path + '.h5';

          try {
            await s3Client.send(
              new HeadObjectCommand({
                Bucket: env.OUTPUTS_BUCKET_NAME,
                Key: heatmapFilePath,
              })
            );
            console.info(`Heatmap file ${heatmapFilePath} available`);
          } catch (err) {
            console.warn(`Heatmap file ${heatmapFilePath} not available yet`);
            try {
              const result = await sqsClient.send(
                new SendMessageCommand({
                  QueueUrl: env.PROCESS_QUEUE_URL,
                  MessageBody: JSON.stringify({
                    inputbucket: env.INPUTS_BUCKET_NAME,
                    inputPath: 'images/' + path,
                    outputbucket: env.OUTPUTS_BUCKET_NAME,
                    heatmapPath: heatmapFilePath,
                  }),
                })
              );
              console.log(`message sent for ${path}:`, result);
            } catch (err) {
              console.error('Error submitting job to heatmapper:', err);
            }
          }
        })
      );
    } catch (error: any) {
      console.error('Error in runHeatmapper:', error);
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
        count: imagePaths.length,
      }),
    };
  } catch (error: any) {
    console.error('Error in runHeatmapper:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error running heatmapper',
        error: error.message,
      }),
    };
  }
};
