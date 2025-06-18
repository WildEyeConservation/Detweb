import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/runHeatmapper';
import { Amplify } from 'aws-amplify';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';

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

export const handler: Handler = async (event, context) => {
  try {
    const imagePaths = event.arguments.images as string[];

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
              await sqsClient.send(
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
