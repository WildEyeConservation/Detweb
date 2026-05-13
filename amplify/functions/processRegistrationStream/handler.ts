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

// Marker for ImageNeighbour rows created out-of-band (e.g. DevActions
// launchRigStudyNeighbours for the oblique-camera study rig). These bypass
// the registration progress accounting entirely — the operator manages them
// directly and they shouldn't move pendingCount or trigger bucket cleanup.
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

// Best-effort backfill: writes projectId onto an ImageNeighbour row that was
// created before this denormalisation existed. Failure here is non-fatal —
// the row stays unprojected and the next stream event for it will retry.
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

// Resolve projectId for a stream record. Prefers the denormalised attribute on
// the row; falls back to a lookup against Image.image1Id and writes the value
// back so subsequent events for this row don't pay the lookup cost.
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

// Determine pendingCount delta for one stream record. Mirrors the table at
// the design: INSERT +1, fresh tracking transition -1, REMOVE-of-untracked -1.
// Anything else (manual homography save, suggestions write that doesn't toggle
// processedAt, REMOVE of an already-tracked row) is a no-op.
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

  // Skip rows that are explicitly opted out of registration progress
  // accounting (e.g. DevActions-launched study rig pairs). Check both NEW and
  // OLD so a REMOVE of an opted-out row also doesn't move the counter.
  if (isProgressOptOut(newRow) || isProgressOptOut(oldRow)) {
    return;
  }

  const delta = computeDelta(eventName, oldRow, newRow);
  if (delta === 0) {
    // INSERT and untracked-REMOVE are the only events that need projectId
    // resolution. A no-op MODIFY (manual save, second tracking write) doesn't
    // touch the counter so we skip the (potentially expensive) lookup.
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
      // Swallow per-record errors so a single poison record doesn't make Lambda
      // retry the whole batch (which would double-count successful records).
      // Counter drift is bounded and self-corrected by the staleness fallback
      // in monitorModelProgress.
      console.error(`Stream record ${record.eventID} failed:`, err);
    }
  }
};
