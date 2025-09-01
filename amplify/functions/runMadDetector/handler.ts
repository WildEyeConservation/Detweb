import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/runMadDetector';
import { Amplify } from 'aws-amplify';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';

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
    const imagesFromEvent = event.arguments.images as string[];
    const projectId = event.arguments.projectId as string;
    const setId = event.arguments.setId as string;
    const bucket = event.arguments.bucket as string;

    const images = imagesFromEvent.map((imageStr) => {
      const [id, originalPath] = imageStr.split('---');
      return {
        id,
        originalPath,
      };
    });

    const queueUrl = event.arguments.queueUrl as string;

    const TIME_THRESHOLD_MS = 60000;
    const sqsClient = new SQSClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        sessionToken: env.AWS_SESSION_TOKEN,
      },
    });
    const lambdaClient = new LambdaClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        sessionToken: env.AWS_SESSION_TOKEN,
      },
    });
    const chunkSize = 4;
    let processed = 0;
    while (processed < images.length) {
      const chunk = images.slice(processed, processed + chunkSize);
      try {
        await sqsClient.send(
          new SendMessageCommand({
            QueueUrl: queueUrl,
            MessageBody: JSON.stringify({
              images: chunk.map((image) => ({
                imageId: image.id,
                key: 'images/' + image.originalPath,
              })),
              projectId,
              bucket,
              setId,
            }),
          })
        );
      } catch (err: any) {
        console.error(
          `Error sending SQS message for chunk starting at index ${processed}`,
          err
        );
      }
      processed += chunk.length;
      const remainingTime = context.getRemainingTimeInMillis();
      if (
        remainingTime < TIME_THRESHOLD_MS &&
        processed < images.length
      ) {
        const remainingImageStrings = imagesFromEvent.slice(processed);
        try {
          await lambdaClient.send(
            new InvokeCommand({
              FunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME!,
              InvocationType: 'Event',
              Payload: Buffer.from(
                JSON.stringify({
                  images: remainingImageStrings,
                  projectId,
                  setId,
                  bucket,
                  queueUrl,
                })
              ),
            })
          );
        } catch (err: any) {
          console.error(
            'Error re-invoking lambda with remaining images',
            err
          );
        }
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: 'Lambda re-invoked with remaining images',
            remainingCount: remainingImageStrings.length,
          }),
        };
      }
    }
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Images received',
        count: images.length,
      }),
    };
  } catch (error: any) {
    console.error('Error in runMadDetector:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error running mad detector',
        error: error.message,
      }),
    };
  }
};


