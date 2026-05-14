import type { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { env } from '$amplify/env/deleteRegistrationNeighbour';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { GraphQLResult } from '@aws-amplify/api-graphql';

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

const deleteImageNeighbour = /* GraphQL */ `
  mutation DeleteImageNeighbour($input: DeleteImageNeighbourInput!) {
    deleteImageNeighbour(input: $input) {
      image1Id
      image2Id
    }
  }
`;

interface MessageBody {
  image1Id: string;
  image2Id: string;
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    try {
      const body = JSON.parse(record.body) as MessageBody;
      if (!body.image1Id || !body.image2Id) {
        console.warn(`Skipping malformed message ${record.messageId}: missing IDs`);
        continue;
      }

      try {
        (await client.graphql({
          query: deleteImageNeighbour,
          variables: {
            input: { image1Id: body.image1Id, image2Id: body.image2Id },
          },
        })) as GraphQLResult<unknown>;
      } catch (e) {
        // Already-deleted is the desired end state.
        const msg = e instanceof Error ? e.message : String(e);
        const isNotFound =
          msg.includes('ConditionalCheckFailedException') ||
          msg.includes('Cannot return null') ||
          msg.toLowerCase().includes('not found');
        if (!isNotFound) {
          console.error(
            `Failed to delete pair ${body.image1Id}/${body.image2Id}:`,
            e
          );
          batchItemFailures.push({ itemIdentifier: record.messageId });
          continue;
        }
      }
    } catch (e) {
      // Bad JSON — let it drop rather than redelivering forever.
      console.error(`Failed to parse message ${record.messageId}:`, e);
    }
  }

  return { batchItemFailures };
};
