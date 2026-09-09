import { getErrorMessages } from '../../shared/errorMessage';
import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/releaseIndividualIdTransects';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import pLimit from 'p-limit';

// Mirrors the client-side idle ceiling in useActivityHeartbeat. A holder who
// hasn't heartbeated within this window is considered gone; their transect is
// returned to the pool so someone else can claim it.
const STALE_AFTER_MS = 30 * 60 * 1000;

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

const listTransectsQuery = /* GraphQL */ `
  query ListIndividualIdTransects($nextToken: String) {
    listIndividualIdTransects(limit: 500, nextToken: $nextToken) {
      items {
        id
        status
        assignedUserId
        assignedAt
        lastActiveAt
      }
      nextToken
    }
  }
`;

const updateTransectMutation = /* GraphQL */ `
  mutation UpdateIndividualIdTransect(
    $input: UpdateIndividualIdTransectInput!
    $condition: ModelIndividualIdTransectConditionInput
  ) {
    updateIndividualIdTransect(input: $input, condition: $condition) {
      id
      group
    }
  }
`;

type TransectRow = {
  id: string;
  status: string | null;
  assignedUserId: string | null;
  assignedAt: string | null;
  lastActiveAt: string | null;
};

type ListResult = {
  listIndividualIdTransects: {
    items: TransectRow[];
    nextToken?: string | null;
  };
};

async function executeGraphql<T>(
  query: string,
  variables: Record<string, unknown>
): Promise<T> {
  const resp = (await client.graphql<unknown>({
    query,
    variables,
  })) as GraphQLResult<T>;
  if (resp.errors && resp.errors.length > 0) {
    throw new Error(
      `GraphQL error: ${JSON.stringify(resp.errors.map((e) => e.message))}`
    );
  }
  if (!resp.data) throw new Error('GraphQL response missing data');
  return resp.data;
}

function isConditionalCheckFailed(error: unknown): boolean {
  return getErrorMessages(error).some(message => message.includes('ConditionalCheckFailed'));
}

export const handler: Handler = async () => {
  const startedAt = Date.now();

  const assigned: TransectRow[] = [];
  let nextToken: string | null = null;
  do {
    const data: ListResult = await executeGraphql<ListResult>(
      listTransectsQuery,
      { nextToken }
    );
    for (const row of data.listIndividualIdTransects.items) {
      if (row.status === 'assigned') assigned.push(row);
    }
    nextToken = data.listIndividualIdTransects.nextToken ?? null;
  } while (nextToken);

  const now = Date.now();
  const stale = assigned.filter((row) => {
    const ref = row.lastActiveAt ?? row.assignedAt;
    const refMs = ref ? Date.parse(ref) : NaN;
    // No usable timestamp on an assigned row => treat as stale.
    return !Number.isFinite(refMs) || now - refMs > STALE_AFTER_MS;
  });

  const limit = pLimit(10);
  let released = 0;
  let skipped = 0;
  await Promise.all(
    stale.map((row) =>
      limit(async () => {
        // Optimistic lock: only release if the row hasn't changed since we
        // read it (no heartbeat landed in between). Does NOT touch the job's
        // remainingTransects counter — only completion decrements that.
        const condition: Record<string, unknown> = { status: { eq: 'assigned' } };
        if (row.lastActiveAt) {
          condition.lastActiveAt = { eq: row.lastActiveAt };
        } else {
          condition.assignedUserId = { eq: row.assignedUserId };
        }
        try {
          await executeGraphql(updateTransectMutation, {
            input: {
              id: row.id,
              status: 'available',
              assignedUserId: null,
              assignedAt: null,
              lastActiveAt: null,
            },
            condition,
          });
          released++;
        } catch (err) {
          if (isConditionalCheckFailed(err)) {
            skipped++;
            return;
          }
          throw err;
        }
      })
    )
  );

  console.log(
    JSON.stringify({
      msg: 'release_iid_transects_done',
      elapsedMs: Date.now() - startedAt,
      assignedScanned: assigned.length,
      staleFound: stale.length,
      released,
      skipped,
    })
  );
};
