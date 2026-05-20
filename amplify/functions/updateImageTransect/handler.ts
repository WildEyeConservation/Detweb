import type { SQSEvent, SQSBatchResponse, SQSBatchItemFailure } from 'aws-lambda';
import { env } from '$amplify/env/updateImageTransect';
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

const updateImageMutation = /* GraphQL */ `
  mutation UpdateImage($input: UpdateImageInput!) {
    updateImage(input: $input) { id group }
  }
`;

const decrementMutation = /* GraphQL */ `
  mutation Dec($id: ID!, $count: Int!) {
    decrementIndividualIdImageUpdates(id: $id, count: $count)
  }
`;

interface MessageBody {
  imageId: string;
  transectId: string;
  jobId: string;
}

async function executeGraphql<T>(
  query: string,
  variables: Record<string, any>
): Promise<T> {
  const resp = (await client.graphql({
    query,
    variables,
  } as any)) as GraphQLResult<T>;
  if (resp.errors && resp.errors.length > 0) {
    throw new Error(
      `GraphQL error: ${JSON.stringify(resp.errors.map((e) => e.message))}`
    );
  }
  if (!resp.data) throw new Error('GraphQL response missing data');
  return resp.data;
}

// Setting Image.transectId is idempotent (writing the same value twice is
// harmless). The pendingImageUpdates counter, however, is not — an SQS
// redelivery can over-decrement. We accept that: over-decrement only makes the
// counter reach 0 slightly early, and reconcileIndividualId additionally gates
// on the pretile manifest plus a launch deadline, so a job can neither be
// completed before its tiles are ready nor be stuck forever on a lost
// decrement. Under-counting (the dangerous case) is what the deadline guards.
export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchItemFailure[] = [];

  for (const record of event.Records) {
    let body: MessageBody;
    try {
      body = JSON.parse(record.body) as MessageBody;
    } catch (e) {
      // Unparseable — drop rather than redeliver forever.
      console.error(`Failed to parse message ${record.messageId}:`, e);
      continue;
    }

    if (!body.imageId || !body.transectId || !body.jobId) {
      console.warn(
        `Skipping malformed message ${record.messageId}: missing fields`
      );
      continue;
    }

    try {
      await executeGraphql(updateImageMutation, {
        input: { id: body.imageId, transectId: body.transectId },
      });
      await executeGraphql(decrementMutation, {
        id: body.jobId,
        count: 1,
      });
    } catch (e) {
      console.error(
        `Failed to assign image ${body.imageId} -> transect ${body.transectId} (job ${body.jobId}):`,
        e
      );
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
