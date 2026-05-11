import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/registrationBucketCleanup';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import { SendMessageBatchCommand, SQSClient } from '@aws-sdk/client-sqs';
import type { SendMessageBatchRequestEntry } from '@aws-sdk/client-sqs';

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

interface PagedList<T> {
  items: T[];
  nextToken: string | null | undefined;
}

interface BucketStatRow {
  projectId: string;
  cameraPairKey: string;
  bucketIndex: number;
  successCount?: number | null;
}

interface NeighbourRow {
  image1Id: string;
  image2Id: string;
  cameraPairKey?: string | null;
  bucketIndex?: number | null;
}

const registrationBucketStatsByProjectId = /* GraphQL */ `
  query StatsByProject($projectId: ID!, $limit: Int, $nextToken: String) {
    registrationBucketStatsByProjectId(
      projectId: $projectId
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        projectId
        cameraPairKey
        bucketIndex
        successCount
      }
      nextToken
    }
  }
`;

// Composite-key query: partition by cameraPairKey, sort by bucketIndex (= eq).
// Identifies the cross-camera neighbour rows in a losing bucket so we can
// queue them for deletion. Same-camera rows have null cameraPairKey and are
// not projected into this GSI.
const imageNeighboursByCameraPairAndBucket = /* GraphQL */ `
  query NeighboursByPairAndBucket(
    $cameraPairKey: String!
    $bucketIndex: ModelIntKeyConditionInput!
    $limit: Int
    $nextToken: String
  ) {
    imageNeighboursByCameraPairAndBucket(
      cameraPairKey: $cameraPairKey
      bucketIndex: $bucketIndex
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        image1Id
        image2Id
        cameraPairKey
        bucketIndex
      }
      nextToken
    }
  }
`;

const updateRegistrationProgressStatus = /* GraphQL */ `
  mutation FinalizeCleanupState(
    $projectId: ID!
    $cleanupState: String!
    $expected: String!
  ) {
    updateRegistrationProgress(
      input: { projectId: $projectId, cleanupState: $cleanupState }
      condition: { cleanupState: { eq: $expected } }
    ) {
      projectId
      cleanupState
    }
  }
`;

async function fetchAllPages<T, K extends string>(
  queryFn: (nextToken?: string) => Promise<GraphQLResult<{ [key in K]: PagedList<T> }>>,
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
  return allItems;
}

// Tie-break: prefer bucket 0 (the truly-synchronous hypothesis), then the
// lower |index| (nearer offsets first), then the lower signed value.
function compareBuckets(a: number, b: number): number {
  if (a === 0 && b !== 0) return -1;
  if (b === 0 && a !== 0) return 1;
  const absDiff = Math.abs(a) - Math.abs(b);
  if (absDiff !== 0) return absDiff;
  return a - b;
}

function pickWinningBucket(stats: BucketStatRow[]): number {
  // Highest successCount wins; tie-break by compareBuckets.
  let bestIndex = stats[0].bucketIndex;
  let bestCount = stats[0].successCount ?? 0;
  for (let i = 1; i < stats.length; i++) {
    const c = stats[i].successCount ?? 0;
    if (
      c > bestCount ||
      (c === bestCount && compareBuckets(stats[i].bucketIndex, bestIndex) < 0)
    ) {
      bestIndex = stats[i].bucketIndex;
      bestCount = c;
    }
  }
  return bestIndex;
}

export const handler: Handler = async (event, _context) => {
  const projectId = (event as { projectId?: string }).projectId;
  if (!projectId) {
    console.error('registrationBucketCleanup invoked without projectId');
    return { statusCode: 400, body: 'projectId required' };
  }
  console.log(`Starting registrationBucketCleanup for project ${projectId}`);

  try {
    // 1. Fetch all bucket-stat rows for the project.
    const stats = await fetchAllPages<BucketStatRow, 'registrationBucketStatsByProjectId'>(
      (nextToken) =>
        client.graphql({
          query: registrationBucketStatsByProjectId,
          variables: { projectId, limit: 1000, nextToken },
        }) as Promise<GraphQLResult<{ registrationBucketStatsByProjectId: PagedList<BucketStatRow> }>>,
      'registrationBucketStatsByProjectId'
    );

    console.log(`Found ${stats.length} RegistrationBucketStat row(s) for ${projectId}`);

    // 2. Group by cameraPairKey, pick winner per group.
    const byPair = new Map<string, BucketStatRow[]>();
    for (const row of stats) {
      const list = byPair.get(row.cameraPairKey) ?? [];
      list.push(row);
      byPair.set(row.cameraPairKey, list);
    }

    const winners = new Map<string, number>();
    for (const [pairKey, rows] of byPair) {
      const winner = pickWinningBucket(rows);
      winners.set(pairKey, winner);
      const total = rows.reduce((acc, r) => acc + (r.successCount ?? 0), 0);
      console.log(
        `Pair ${pairKey}: winner=bucket${winner} ` +
        `(${rows.map((r) => `${r.bucketIndex}=${r.successCount ?? 0}`).join(', ')}; total=${total})`
      );
    }

    // 3. For each pair, query losing-bucket neighbours via the GSI and batch
    // them onto the deletion queue. We stream — pagination keeps memory flat
    // even at 100k+ loser rows per pair.
    const queueUrl = env.REGISTRATION_DELETE_QUEUE_URL;
    const sqsClient = new SQSClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        sessionToken: env.AWS_SESSION_TOKEN,
      },
    });

    let totalEnqueued = 0;
    const buffer: SendMessageBatchRequestEntry[] = [];
    const flush = async () => {
      if (buffer.length === 0) return;
      try {
        await sqsClient.send(
          new SendMessageBatchCommand({
            QueueUrl: queueUrl,
            Entries: buffer.splice(0, buffer.length),
          })
        );
      } catch (e) {
        console.error('Failed to send deletion batch (continuing):', e);
      }
    };

    for (const [pairKey, winner] of winners) {
      const rows = byPair.get(pairKey) ?? [];
      const losers = rows
        .map((r) => r.bucketIndex)
        .filter((idx) => idx !== winner);
      for (const loserBucket of losers) {
        console.log(`Enumerating losers in pair ${pairKey} bucket ${loserBucket}`);
        let nextToken: string | undefined;
        do {
          const resp = (await client.graphql({
            query: imageNeighboursByCameraPairAndBucket,
            variables: {
              cameraPairKey: pairKey,
              bucketIndex: { eq: loserBucket },
              limit: 1000,
              nextToken,
            },
          })) as GraphQLResult<{
            imageNeighboursByCameraPairAndBucket: PagedList<NeighbourRow>;
          }>;
          const items = resp.data?.imageNeighboursByCameraPairAndBucket?.items ?? [];
          nextToken = resp.data?.imageNeighboursByCameraPairAndBucket?.nextToken ?? undefined;
          for (const row of items) {
            buffer.push({
              Id: `${row.image1Id}-${row.image2Id}`.slice(0, 80),
              MessageBody: JSON.stringify({
                image1Id: row.image1Id,
                image2Id: row.image2Id,
              }),
            });
            totalEnqueued += 1;
            if (buffer.length >= 10) await flush();
          }
        } while (nextToken);
      }
    }
    await flush();

    console.log(
      `registrationBucketCleanup enqueued ${totalEnqueued} deletion(s) for project ${projectId}`
    );

    // 4. Mark cleanupState='done' iff still 'in-progress'. A concurrent
    // runImageRegistration that reset state to 'pending' loses this CAS and
    // the next monitor pass will re-run cleanup over the updated bucket stats.
    try {
      await client.graphql({
        query: updateRegistrationProgressStatus,
        variables: {
          projectId,
          cleanupState: 'done',
          expected: 'in-progress',
        },
      });
      console.log(`RegistrationProgress for ${projectId} set to 'done'`);
    } catch (e) {
      console.log(
        `Could not finalize cleanupState='done' for ${projectId} (likely re-armed by runImageRegistration):`,
        e
      );
    }

    return { statusCode: 200, body: JSON.stringify({ projectId, enqueued: totalEnqueued }) };
  } catch (error: unknown) {
    console.error('registrationBucketCleanup error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
};
