import type { DynamoDBStreamHandler, DynamoDBRecord } from 'aws-lambda';
import { env } from '$amplify/env/processRegistrationStream';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import type { AttributeValue } from '@aws-sdk/client-dynamodb';

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

const incrementRegistrationProgress = /* GraphQL */ `
  mutation IncrementRegistrationProgress(
    $projectId: ID!
    $pendingCountDelta: Int
    $group: String
  ) {
    incrementRegistrationProgress(
      projectId: $projectId
      pendingCountDelta: $pendingCountDelta
      group: $group
    )
  }
`;

const getImage = /* GraphQL */ `
  query GetImage($id: ID!) {
    getImage(id: $id) {
      id
      projectId
    }
  }
`;

const updateImageNeighbour = /* GraphQL */ `
  mutation BackfillNeighbourProjectId($input: UpdateImageNeighbourInput!) {
    updateImageNeighbour(input: $input) {
      image1Id
      image2Id
      projectId
    }
  }
`;

interface NeighbourRow {
  image1Id?: string;
  image2Id?: string;
  projectId?: string | null;
  group?: string | null;
  registrationProcessedAt?: string | null;
  registrationFailedAt?: string | null;
  homographySource?: string | null;
}

const isTracked = (row: NeighbourRow | null): boolean => {
  if (!row) return false;
  return Boolean(row.registrationProcessedAt) || Boolean(row.registrationFailedAt);
};

// Out-of-band rows (e.g. DevActions rig-study) bypass pendingCount accounting.
const PROGRESS_OPT_OUT_SOURCES = new Set(['rig-study']);
const isProgressOptOut = (row: NeighbourRow | null): boolean => {
  if (!row) return false;
  return Boolean(
    row.homographySource && PROGRESS_OPT_OUT_SOURCES.has(row.homographySource)
  );
};

const decode = (
  image:
    | Record<string, AttributeValue>
    | undefined
    | null
): NeighbourRow | null => {
  if (!image) return null;
  return unmarshall(image as Record<string, AttributeValue>) as NeighbourRow;
};

// Failure is non-fatal — next stream event for this row will retry.
async function backfillProjectId(
  image1Id: string,
  image2Id: string,
  projectId: string
): Promise<void> {
  try {
    await client.graphql({
      query: updateImageNeighbour,
      variables: { input: { image1Id, image2Id, projectId } },
    });
  } catch (err) {
    console.warn(
      `Backfill of projectId on ImageNeighbour ${image1Id}/${image2Id} failed:`,
      err
    );
  }
}

// Falls back to Image lookup and writes the value back so subsequent events
// don't repeat it.
async function resolveProjectId(
  newRow: NeighbourRow | null,
  oldRow: NeighbourRow | null
): Promise<{ projectId: string | null; group: string | null }> {
  const candidate = newRow ?? oldRow;
  if (candidate?.projectId) {
    return { projectId: candidate.projectId, group: candidate.group ?? null };
  }
  const lookupId = candidate?.image1Id;
  if (!lookupId) return { projectId: null, group: candidate?.group ?? null };

  try {
    const resp = (await client.graphql({
      query: getImage,
      variables: { id: lookupId },
    })) as GraphQLResult<{ getImage: { id: string; projectId: string } | null }>;
    const projectId = resp.data?.getImage?.projectId ?? null;
    if (projectId && newRow?.image1Id && newRow?.image2Id) {
      await backfillProjectId(newRow.image1Id, newRow.image2Id, projectId);
    }
    return { projectId, group: candidate?.group ?? null };
  } catch (err) {
    console.warn(`Image lookup for ${lookupId} failed:`, err);
    return { projectId: null, group: candidate?.group ?? null };
  }
}

// INSERT +1, fresh tracking transition -1, REMOVE-of-untracked -1; else no-op.
function computeDelta(
  eventName: string,
  oldRow: NeighbourRow | null,
  newRow: NeighbourRow | null
): number {
  if (eventName === 'INSERT') return 1;
  if (eventName === 'REMOVE') return isTracked(oldRow) ? 0 : -1;
  if (eventName === 'MODIFY') {
    if (!isTracked(oldRow) && isTracked(newRow)) return -1;
    return 0;
  }
  return 0;
}

async function processRecord(record: DynamoDBRecord): Promise<void> {
  const eventName = record.eventName;
  if (!eventName) return;

  const oldRow = decode(record.dynamodb?.OldImage as Record<string, AttributeValue> | undefined);
  const newRow = decode(record.dynamodb?.NewImage as Record<string, AttributeValue> | undefined);

  // Check both NEW and OLD so a REMOVE of an opted-out row doesn't move the counter.
  if (isProgressOptOut(newRow) || isProgressOptOut(oldRow)) {
    return;
  }

  const delta = computeDelta(eventName, oldRow, newRow);
  if (delta === 0) {
    // Skip the potentially-expensive projectId lookup on no-op events.
    return;
  }

  const { projectId, group } = await resolveProjectId(newRow, oldRow);
  if (!projectId) {
    console.warn(
      `No projectId resolved for ${record.eventID} (${eventName}); skipping pendingCount update`
    );
    return;
  }

  try {
    await client.graphql({
      query: incrementRegistrationProgress,
      variables: { projectId, pendingCountDelta: delta, group },
    });
  } catch (err) {
    console.error(
      `incrementRegistrationProgress failed for ${projectId} delta=${delta}:`,
      err
    );
  }
}

export const handler: DynamoDBStreamHandler = async (event) => {
  for (const record of event.Records) {
    try {
      await processRecord(record);
    } catch (err) {
      // Swallow so one poison record doesn't retry the whole batch and
      // double-count. Staleness fallback in monitorModelProgress self-corrects.
      console.error(`Stream record ${record.eventID} failed:`, err);
    }
  }
};
