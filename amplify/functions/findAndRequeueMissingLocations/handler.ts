import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/findAndRequeueMissingLocations';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import {
  S3Client,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import {
  SQSClient,
  SendMessageBatchCommand,
  GetQueueAttributesCommand,
} from '@aws-sdk/client-sqs';
import { randomUUID } from 'crypto';
import pLimit from 'p-limit';
import {
  listQueues,
  observationsByAnnotationSetId,
  annotationsByImageIdAndSetId,
  getProject,
} from './graphql/queries';

// Inline minimal mutations – return key fields + `group` to avoid nested-resolver
// auth failures while still enabling subscription delivery via groupDefinedIn('group').
const updateQueue = /* GraphQL */ `
  mutation UpdateQueue($input: UpdateQueueInput!) {
    updateQueue(input: $input) { id group }
  }
`;

const createAdminActionLog = /* GraphQL */ `
  mutation CreateAdminActionLog($input: CreateAdminActionLogInput!) {
    createAdminActionLog(input: $input) { id group }
  }
`;

// Configure Amplify for IAM-based GraphQL access.
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

const client = generateClient({
  authMode: 'iam',
});

const s3Client = new S3Client({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
  },
});

const sqsClient = new SQSClient({
  region: env.AWS_REGION,
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    sessionToken: env.AWS_SESSION_TOKEN,
  },
});

// Constants
const EMPTY_QUEUE_WAIT_MINUTES = 10;
const MAX_REQUEUES = 1;

type QueueRecord = {
  id: string;
  projectId: string;
  name: string;
  url: string;
  tag?: string | null;
  approximateSize?: number | null;
  annotationSetId?: string | null;
  locationSetId?: string | null;
  launchedCount?: number | null;
  observedCount?: number | null;
  locationManifestS3Key?: string | null;
  emptyQueueTimestamp?: string | null;
  requeuesCompleted?: number | null;
};

type Location = {
  locationId: string;
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type Annotation = {
  id: string;
  x: number;
  y: number;
};

// Entry point invoked by EventBridge schedule.
export const handler: Handler = async () => {
  console.log('findAndRequeueMissingLocations invoked');

  try {
    // Find candidate queues: empty SQS, may have missing locations
    const candidateQueues = await fetchCandidateQueues();
    console.log('Found candidate queues', { count: candidateQueues.length });

    let requeuedTotal = 0;
    for (const queue of candidateQueues) {
      const requeued = await processQueue(queue);
      requeuedTotal += requeued;
    }

    console.log('Requeue check complete', {
      queuesChecked: candidateQueues.length,
      locationsRequeued: requeuedTotal,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Requeue check complete',
        queuesChecked: candidateQueues.length,
        locationsRequeued: requeuedTotal,
      }),
    };
  } catch (error: any) {
    console.error('Error in findAndRequeueMissingLocations', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Failed to check for missing locations',
        error: error?.message ?? 'Unknown error',
      }),
    };
  }
};

async function fetchCandidateQueues(): Promise<QueueRecord[]> {
  const queues: QueueRecord[] = [];
  let nextToken: string | null | undefined = undefined;

  do {
    const response = (await client.graphql({
      query: listQueues,
      variables: {
        limit: 100,
        nextToken,
      },
    } as any)) as GraphQLResult<{
      listQueues?: {
        items?: Array<QueueRecord | null>;
        nextToken?: string | null;
      };
    }>;

    if (response.errors && response.errors.length > 0) {
      throw new Error(
        `GraphQL error: ${JSON.stringify(response.errors.map((e) => e.message))}`
      );
    }

    const page = response.data?.listQueues;
    for (const item of page?.items || []) {
      if (item) {
        const isCandidate =
          item.approximateSize === 0 &&
          item.locationManifestS3Key &&
          item.launchedCount != null &&
          item.launchedCount > 0 &&
          item.observedCount != null &&
          item.observedCount < item.launchedCount &&
          (item.requeuesCompleted ?? 0) < MAX_REQUEUES;

        if (isCandidate) {
          console.log('Found candidate queue', {
            id: item.id,
            name: item.name,
            approximateSize: item.approximateSize,
            launchedCount: item.launchedCount,
            observedCount: item.observedCount,
            requeuesCompleted: item.requeuesCompleted,
          });
          queues.push(item);
        }
      }
    }
    nextToken = page?.nextToken ?? undefined;
  } while (nextToken);

  return queues;
}

async function processQueue(queue: QueueRecord): Promise<number> {
  console.log('Processing queue', {
    queueId: queue.id,
    name: queue.name,
    tag: queue.tag,
    launchedCount: queue.launchedCount,
    observedCount: queue.observedCount,
    requeuesCompleted: queue.requeuesCompleted,
  });

  const now = new Date();

  // Step 1: If emptyQueueTimestamp not set, set it and return
  if (!queue.emptyQueueTimestamp) {
    console.log('Setting emptyQueueTimestamp for queue', { queueId: queue.id });
    await executeGraphql(updateQueue, {
      input: {
        id: queue.id,
        emptyQueueTimestamp: now.toISOString(),
      },
    });
    return 0;
  }

  // Step 2: Check if empty for at least EMPTY_QUEUE_WAIT_MINUTES
  const emptyTimestamp = new Date(queue.emptyQueueTimestamp);
  const minutesEmpty = (now.getTime() - emptyTimestamp.getTime()) / (1000 * 60);

  if (minutesEmpty < EMPTY_QUEUE_WAIT_MINUTES) {
    console.log('Queue not empty long enough', {
      queueId: queue.id,
      minutesEmpty: minutesEmpty.toFixed(1),
      required: EMPTY_QUEUE_WAIT_MINUTES,
    });
    return 0;
  }

  // Step 3: Verify SQS is still empty (double-check)
  const sqsEmpty = await checkSqsEmpty(queue.url);
  if (!sqsEmpty) {
    console.log('SQS queue not empty, clearing emptyQueueTimestamp', { queueId: queue.id });
    await executeGraphql(updateQueue, {
      input: {
        id: queue.id,
        emptyQueueTimestamp: null,
      },
    });
    return 0;
  }

  // Step 4: Download S3 manifest
  console.log('Downloading location manifest', { key: queue.locationManifestS3Key });
  const launchedLocations = await downloadManifest(queue.locationManifestS3Key!);
  const launchedLocationIds = launchedLocations.map((l) => l.locationId);
  console.log('Downloaded manifest', { locationCount: launchedLocations.length });

  // Step 5.1: Query observations to find observed locations
  console.log('Fetching observations', { annotationSetId: queue.annotationSetId });
  const observedLocationIds = await fetchObservedLocationIds(queue.annotationSetId!);
  console.log('Fetched observations result', {
    annotationSetId: queue.annotationSetId,
    observedCount: observedLocationIds.size,
  });

  // Some of the launched locations may have been annotated but not observed
  // Step 5.2: Query annotations to find annotated unobserved locations
  console.log('Fetching annotations', { annotationSetId: queue.annotationSetId });
  const unobservedLaunchedLocations = launchedLocations.filter((l) => !observedLocationIds.has(l.locationId));
  const annotatedUnobservedLocationIds = await fetchAnnotatedLocationIds(unobservedLaunchedLocations, queue.annotationSetId!);
  console.log('Fetched annotations result', {
    annotationSetId: queue.annotationSetId,
    annotatedCount: annotatedUnobservedLocationIds.size,
  });

  // Step 6: Compute missing locations
  const missingLocationIds = launchedLocationIds.filter(
    (id) => !observedLocationIds.has(id) && !annotatedUnobservedLocationIds.has(id)
  );
  console.log('Computed missing locations', {
    queueId: queue.id,
    launched: launchedLocationIds.length,
    observed: observedLocationIds.size,
    annotated: annotatedUnobservedLocationIds.size,
    missingCount: missingLocationIds.length,
  });

  if (missingLocationIds.length === 0) {
    console.log('No missing locations, updating requeuesCompleted', { queueId: queue.id });
    await executeGraphql(updateQueue, {
      input: {
        id: queue.id,
        emptyQueueTimestamp: null,
        requeuesCompleted: (queue.requeuesCompleted ?? 0) + 1,
      },
    });
    return 0;
  }

  // Step 7: Requeue missing locations
  console.log('Requeuing missing locations', {
    queueId: queue.id,
    count: missingLocationIds.length,
  });

  await requeueLocations(queue, missingLocationIds);

  // Step 8: Update queue record
  await executeGraphql(updateQueue, {
    input: {
      id: queue.id,
      emptyQueueTimestamp: null,
      requeuesCompleted: (queue.requeuesCompleted ?? 0) + 1,
      approximateSize: missingLocationIds.length,
    },
  });

  // Step 9: Log to AdminActionLog
  await logRequeueAction(queue, missingLocationIds.length);

  console.log('Requeue complete', {
    queueId: queue.id,
    requeuedCount: missingLocationIds.length,
    attemptNumber: (queue.requeuesCompleted ?? 0) + 1,
  });

  return missingLocationIds.length;
}

async function checkSqsEmpty(queueUrl: string): Promise<boolean> {
  try {
    const response = await sqsClient.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible'],
      })
    );

    const visible = parseInt(response.Attributes?.ApproximateNumberOfMessages ?? '0');
    const notVisible = parseInt(response.Attributes?.ApproximateNumberOfMessagesNotVisible ?? '0');

    console.log('Checked SQS attributes', {
      queueUrl,
      visible,
      notVisible,
      isEmpty: visible === 0 && notVisible === 0,
    });

    return visible === 0 && notVisible === 0;
  } catch (error) {
    console.warn('Failed to check SQS attributes', error);
    // If we can't check, assume not empty to be safe
    return false;
  }
}

async function downloadManifest(key: string): Promise<Location[]> {
  const bucketName = env.OUTPUTS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error('OUTPUTS_BUCKET_NAME environment variable not set');
  }

  const response = await s3Client.send(
    new GetObjectCommand({
      Bucket: bucketName,
      Key: key,
    })
  );

  const bodyStr = await response.Body?.transformToString();
  if (!bodyStr) {
    throw new Error('Empty manifest file');
  }

  const manifest = JSON.parse(bodyStr);
  return manifest.items as Location[];
}

async function fetchAnnotatedLocationIds(locations: Location[], annotationSetId: string): Promise<Set<string>> {
  // fetch and cache annotations by image
  const annotationsByImage = new Map<string, Annotation[]>();
  const limit = pLimit(50);
  const imageIds = Array.from(new Set(locations.map((l) => l.imageId)));

  console.log('Fetching annotations for images', {
    imageCount: imageIds.length,
    annotationSetId,
  });

  await Promise.all(
    imageIds.map((imageId) =>
      limit(async () => {
        let nextToken: string | undefined = undefined;
        let totalImageAnnotations = 0;
        do {
          const response = (await client.graphql({
            query: annotationsByImageIdAndSetId,
            variables: {
              imageId,
              setId: { eq: annotationSetId },
              limit: 1000,
              nextToken,
            },
          } as any)) as GraphQLResult<{
            annotationsByImageIdAndSetId?: {
              items?: Array<Annotation | null>;
              nextToken?: string | null;
            };
          }>;

          if (response.errors && response.errors.length > 0) {
            console.error('GraphQL error in fetchAnnotatedLocationIds', {
              imageId,
              annotationSetId,
              errors: response.errors,
            });
            throw new Error(
              `GraphQL error: ${JSON.stringify(response.errors.map((e) => e.message))}`
            );
          }

          const page = response.data?.annotationsByImageIdAndSetId;
          const items = (page?.items || []).filter((item): item is Annotation => !!item);
          if (items.length > 0) {
            let imageAnnotations = annotationsByImage.get(imageId);
            if (!imageAnnotations) {
              imageAnnotations = [];
              annotationsByImage.set(imageId, imageAnnotations);
            }
            imageAnnotations.push(...items);
            totalImageAnnotations += items.length;
          }
          nextToken = page?.nextToken ?? undefined;
        } while (nextToken);

        if (totalImageAnnotations > 0) {
          console.log(`Fetched ${totalImageAnnotations} annotations for image ${imageId}`);
        }
      })
    )
  );

  const annotatedIds = new Set<string>();

  for (const location of locations) {
    const boundsxy: [number, number][] = [
      [location.x - location.width / 2, location.y - location.height / 2],
      [location.x + location.width / 2, location.y + location.height / 2],
    ];

    const isWithinBounds = (annotation: Annotation) => {
      return annotation.x >= boundsxy[0][0] &&
        annotation.y >= boundsxy[0][1] &&
        annotation.x <= boundsxy[1][0] &&
        annotation.y <= boundsxy[1][1];
    };

    const imageAnnotations = annotationsByImage.get(location.imageId);
    if (imageAnnotations) {
      for (const annotation of imageAnnotations) {
        if (isWithinBounds(annotation)) {
          annotatedIds.add(location.locationId);
          break;
        }
      }
    }
  }

  return annotatedIds;
}

async function fetchObservedLocationIds(annotationSetId: string): Promise<Set<string>> {
  const observedIds = new Set<string>();
  let nextToken: string | null | undefined = undefined;
  let pageCount = 0;

  do {
    pageCount++;
    const response = (await client.graphql({
      query: observationsByAnnotationSetId,
      variables: {
        annotationSetId,
        limit: 1000,
        nextToken,
      },
    } as any)) as GraphQLResult<{
      observationsByAnnotationSetId?: {
        items?: Array<{ id: string; locationId: string } | null>;
        nextToken?: string | null;
      };
    }>;

    if (response.errors && response.errors.length > 0) {
      console.error('GraphQL error in fetchObservedLocationIds', {
        annotationSetId,
        errors: response.errors,
      });
      throw new Error(
        `GraphQL error: ${JSON.stringify(response.errors.map((e) => e.message))}`
      );
    }

    const page = response.data?.observationsByAnnotationSetId;
    const items = page?.items || [];
    for (const item of items) {
      if (item?.locationId) {
        observedIds.add(item.locationId);
      }
    }

    console.log(`Fetched observations page ${pageCount}`, {
      annotationSetId,
      itemCount: items.length,
      totalSoFar: observedIds.size,
    });

    nextToken = page?.nextToken ?? undefined;
  } while (nextToken);

  return observedIds;
}

async function requeueLocations(queue: QueueRecord, locationIds: string[]): Promise<void> {
  const queueType = await getQueueType(queue.url);
  const groupId = randomUUID();
  const batchSize = 10;
  const limit = pLimit(10);
  const tasks: Array<Promise<void>> = [];

  console.log('Sending messages to SQS', {
    queueUrl: queue.url,
    queueType,
    totalLocationIds: locationIds.length,
    batchSize,
  });

  for (let i = 0; i < locationIds.length; i += batchSize) {
    const locationBatch = locationIds.slice(i, i + batchSize);
    const entries = locationBatch.map((locationId) => {
      const messageBody = JSON.stringify({
        location: {
          id: locationId,
          annotationSetId: queue.annotationSetId,
        },
        queueId: queue.id,
        allowOutside: true,
        taskTag: queue.tag ?? queue.name,
        skipLocationWithAnnotations: false,
        isRequeued: true,
      });

      if (queueType === 'FIFO') {
        return {
          Id: `msg-${locationId}`,
          MessageBody: messageBody,
          MessageGroupId: groupId,
          MessageDeduplicationId: `requeue-${queue.requeuesCompleted ?? 0}-${locationId}`.substring(0, 128),
        };
      }

      return {
        Id: `msg-${locationId}`,
        MessageBody: messageBody,
      };
    });

    tasks.push(
      limit(async () => {
        await sqsClient.send(
          new SendMessageBatchCommand({
            QueueUrl: queue.url,
            Entries: entries,
          })
        );
      })
    );
  }

  await Promise.all(tasks);
  console.log('Finished sending all SQS batches');
}

async function getQueueType(queueUrl: string): Promise<'FIFO' | 'Standard'> {
  try {
    const attributes = await sqsClient.send(
      new GetQueueAttributesCommand({
        QueueUrl: queueUrl,
        AttributeNames: ['All'],
      })
    );
    if (attributes.Attributes?.FifoQueue === 'true') {
      return 'FIFO';
    }
    return 'Standard';
  } catch (error) {
    console.warn('Unable to determine queue type, defaulting to Standard', error);
    return 'Standard';
  }
}

async function logRequeueAction(queue: QueueRecord, count: number): Promise<void> {
  // Fetch project name and organizationId
  let projectName = 'Unknown';
  let organizationId: string | undefined;
  try {
    const response = (await client.graphql({
      query: getProject,
      variables: { id: queue.projectId },
    } as any)) as GraphQLResult<{
      getProject?: { id: string; name: string; organizationId?: string };
    }>;
    projectName = response.data?.getProject?.name ?? 'Unknown';
    organizationId = response.data?.getProject?.organizationId ?? undefined;
  } catch (err) {
    console.warn('Failed to fetch project name', err);
  }

  const queueName = queue.tag || queue.name || 'Unknown';
  const attemptNumber = (queue.requeuesCompleted ?? 0) + 1;
  const message = `Requeued ${count} missing locations for queue "${queueName}" (attempt ${attemptNumber}/${MAX_REQUEUES}) in project "${projectName}"`;

  try {
    await executeGraphql(createAdminActionLog, {
      input: {
        userId: 'SurveyScope',
        message,
        projectId: queue.projectId,
        group: organizationId,
      },
    });
  } catch (logError) {
    console.warn('Failed to create admin action log', logError);
  }
}

async function executeGraphql<T>(
  query: string,
  variables: Record<string, any>
): Promise<T> {
  const response = (await client.graphql({
    query,
    variables,
  } as any)) as GraphQLResult<T>;

  if (response.errors && response.errors.length > 0) {
    throw new Error(
      `GraphQL error: ${JSON.stringify(response.errors.map((err) => err.message))}`
    );
  }

  if (!response.data) {
    throw new Error('GraphQL response missing data');
  }

  return response.data;
}
