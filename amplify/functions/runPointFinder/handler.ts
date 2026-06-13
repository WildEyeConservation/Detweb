import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/runPointFinder';
import { Amplify } from 'aws-amplify';
import {
  SendMessageBatchCommand,
  SQSClient,
  type SendMessageBatchRequestEntry,
} from '@aws-sdk/client-sqs';
import { generateClient, GraphQLResult } from 'aws-amplify/data';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

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

interface PagedList<T> {
  items: T[];
  nextToken: string | null | undefined;
}

interface Image {
  id: string;
  projectId: string;
  originalPath: string;
}

interface LocationSet {
  id: string;
  name: string;
}

const getPointFinderProject = /* GraphQL */ `
  query GetPointFinderProject($id: ID!) {
    getProject(id: $id) {
      id
      organizationId
      tags
    }
  }
`;

const pointFinderImagesByProjectId = /* GraphQL */ `
  query PointFinderImagesByProjectId(
    $projectId: ID!
    $limit: Int
    $nextToken: String
  ) {
    imagesByProjectId(
      projectId: $projectId
      limit: $limit
      nextToken: $nextToken
    ) {
      items {
        id
        projectId
        originalPath
      }
      nextToken
    }
  }
`;

const pointFinderLocationSetsByProjectId = /* GraphQL */ `
  query PointFinderLocationSetsByProjectId($projectId: ID!) {
    locationSetsByProjectId(projectId: $projectId, limit: 100) {
      items {
        id
        name
      }
    }
  }
`;

const IMAGE_PAGE_SIZE = 1000;
const SQS_BATCH_SIZE = 10;
const SQS_BATCH_CONCURRENCY = 10;
const MAX_BATCH_ATTEMPTS = 3;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function sendBatchWithRetry(
  sqsClient: SQSClient,
  queueUrl: string,
  entries: SendMessageBatchRequestEntry[]
): Promise<void> {
  let pending = entries;

  for (let attempt = 1; attempt <= MAX_BATCH_ATTEMPTS; attempt++) {
    const result = await sqsClient.send(
      new SendMessageBatchCommand({
        QueueUrl: queueUrl,
        Entries: pending,
      })
    );
    const failedIds = new Set((result.Failed ?? []).map((item) => item.Id));

    if (failedIds.size === 0) {
      return;
    }

    pending = pending.filter((entry) => failedIds.has(entry.Id!));
    console.warn(
      `Point-finder SQS batch attempt ${attempt} failed for ${pending.length} message(s)`
    );
  }

  throw new Error(
    `Failed to submit ${pending.length} point-finder message(s) after ${MAX_BATCH_ATTEMPTS} attempts`
  );
}

async function enqueueImagePage(
  sqsClient: SQSClient,
  queueUrl: string,
  images: Image[],
  options: {
    isLegacyProject: boolean;
    organizationId: string;
    projectId: string;
    locationSetId: string;
  }
): Promise<void> {
  const entries = images.map(
    (image, index): SendMessageBatchRequestEntry => ({
      Id: index.toString(),
      MessageBody: JSON.stringify({
        imageId: image.id,
        projectId: image.projectId,
        key: options.isLegacyProject
          ? `heatmaps/${image.originalPath}.h5`
          : `heatmaps/${options.organizationId}/${options.projectId}/${image.originalPath}.h5`,
        width: 1024,
        height: 1024,
        threshold: 0.95,
        bucket: env.OUTPUTS_BUCKET_NAME,
        setId: options.locationSetId,
      }),
    })
  );
  const batches = chunk(entries, SQS_BATCH_SIZE);

  for (let i = 0; i < batches.length; i += SQS_BATCH_CONCURRENCY) {
    await Promise.all(
      batches
        .slice(i, i + SQS_BATCH_CONCURRENCY)
        .map((batch) => sendBatchWithRetry(sqsClient, queueUrl, batch))
    );
  }
}

export const handler: Handler = async (event) => {
  const projectId = event.arguments?.projectId ?? (event.projectId as string);
  if (!projectId) {
    console.error('projectId not provided');
    throw new Error('projectId not provided');
  }
  try {
    const projectResponse = (await client.graphql({
      query: getPointFinderProject,
      variables: { id: projectId },
    })) as GraphQLResult<{
      getProject: {
        id: string;
        organizationId: string;
        tags?: string[] | null;
      } | null;
    }>;

    const project = projectResponse.data?.getProject;
    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const organizationId = project.organizationId;
    const tagsRaw = projectResponse.data?.getProject?.tags ?? [];
    const tags = Array.isArray(tagsRaw)
      ? tagsRaw.filter((t): t is string => typeof t === 'string')
      : [];
    const isLegacyProject = tags.includes('legacy');

    const locationSetsResponse = (await client.graphql({
      query: pointFinderLocationSetsByProjectId,
      variables: {
        projectId,
      },
    })) as GraphQLResult<{
      locationSetsByProjectId: PagedList<LocationSet>;
    }>;

    const locationSet = locationSetsResponse.data?.locationSetsByProjectId.items.find((locationSet) =>
      locationSet.name.includes('elephant-detection-nadir')
    );

    if (!locationSet) {
      console.error('Location set not found');
      throw new Error('Location set not found');
    }

    const ssmClient = new SSMClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        sessionToken: env.AWS_SESSION_TOKEN,
      },
    });

    const { Parameter } = await ssmClient.send(
      new GetParameterCommand({ Name: env.POINT_FINDER_QUEUE_URL_PARAM })
    );
    const queueUrl = Parameter!.Value!;

    const sqsClient = new SQSClient({
      region: env.AWS_REGION,
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
        sessionToken: env.AWS_SESSION_TOKEN,
      },
    });

    let nextToken: string | undefined;
    let submittedCount = 0;
    let pageNumber = 0;

    do {
      const imagesResponse = (await client.graphql({
        query: pointFinderImagesByProjectId,
        variables: {
          projectId,
          limit: IMAGE_PAGE_SIZE,
          nextToken,
        },
      })) as GraphQLResult<{
        imagesByProjectId: PagedList<Image>;
      }>;
      const page = imagesResponse.data?.imagesByProjectId;
      const images = page?.items ?? [];

      await enqueueImagePage(sqsClient, queueUrl, images, {
        isLegacyProject,
        organizationId,
        projectId,
        locationSetId: locationSet.id,
      });

      submittedCount += images.length;
      pageNumber += 1;
      nextToken = page?.nextToken ?? undefined;
      console.log(
        `Submitted point-finder page ${pageNumber}: ${images.length} messages ` +
          `(${submittedCount} total)`
      );
    } while (nextToken);

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Images received',
        count: submittedCount,
      }),
    };
  } catch (error: unknown) {
    const errorDetails =
      error instanceof Error
        ? { message: error.message, stack: error.stack, name: error.name }
        : { message: String(error), stack: undefined, name: 'UnknownError' };
    console.error('Error in runPointFinder:', error);
    console.error('Error details:', errorDetails);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error running point finder',
        error: errorDetails.message,
      }),
    };
  }
};
