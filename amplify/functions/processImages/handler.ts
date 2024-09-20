import { publish } from './graphql/mutations'
import { Amplify } from "aws-amplify";
import { env } from '$amplify/env/processImages'
import { generateClient } from "aws-amplify/data";
import { Handler } from "aws-lambda";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3'

Amplify.configure(
    {
      API: {
        GraphQL: {
          endpoint: env.AMPLIFY_DATA_GRAPHQL_ENDPOINT,
          region: env.AWS_REGION,
                defaultAuthMode: 'apiKey',
                apiKey: env.API_KEY
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
  authMode: "apiKey",
});

async function existsOnS3(client: S3Client, bucket: string, prefix: string) {
  try {
    const data = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }),
    );
    const exists = (data.Contents?.length || 0) >= 494;
    return exists;
  } catch (error) {
    if (
      (error as any).$metadata?.httpStatusCode === 404) {
      return false;
    } else {
      throw error;
    }
  }
}

function publishToClients(message: string) {
  return client.graphql({
    query: publish,
    variables: {
        channelName: "lambdas/processImages",
        content: message,
    }
  });
}

export const handler: Handler = async (event, context) => {
  try {
    const s3Client = new S3Client({ region: env.AWS_REGION });
    const heatMapPath = 'heatmaps/' + event.arguments.s3key + '.h5'
    const exists = await existsOnS3(s3Client, env.OUTPUTS_BUCKET_NAME, heatMapPath);
    if (!exists) {
      const sqsClient = new SQSClient({ region: env.AWS_REGION })
      await publishToClients(`${heatMapPath} does not exist on ${env.OUTPUTS_BUCKET_NAME}. Submitting job to heatmapper`)
      await sqsClient.send(new SendMessageCommand({
        QueueUrl: env.PROCESS_QUEUE_URL,
        MessageBody: JSON.stringify({
          inputbucket: env.INPUTS_BUCKET_NAME,
          inputPath: 'images/' + event.arguments.s3key,
          outputbucket: env.OUTPUTS_BUCKET_NAME,
          heatmapPath: heatMapPath,
        }),
      }))
      console.log('Submitted job to heatmapper')
    } else {
      publishToClients(`${heatMapPath} exists on ${env.OUTPUTS_BUCKET_NAME}. Skipping`)
    }
  } catch (error) {
  console.error('Error publishing:', error);
    throw error;
  }
};