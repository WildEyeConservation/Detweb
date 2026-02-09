import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/monitorModelProgress';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import {
  listProjects,
  userProjectMembershipsByProjectId,
  imagesByProjectId,
} from './graphql/queries';
import {
  updateProject,
  updateUserProjectMembership,
} from './graphql/mutations';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import { UserProjectMembership } from './graphql/API';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
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

interface PagedList<T> {
  items: T[];
  nextToken: string | null | undefined;
}

interface Project {
  id: string;
  name: string;
  status?: string | null;
  organizationId: string;
  tags?: string[] | null;
}

interface Image {
  id: string;
  projectId: string;
  originalPath: string;
}

interface ImageWithDetails {
  id: string;
  projectId: string;
  originalPath: string;
  locations?: {
    items: { id: string; source: string }[];
  };
  processedBy?: {
    items: { source: string }[];
  };
}


// Custom query to fetch images with nested locations and processedBy records
const imagesByProjectIdWithDetails = /* GraphQL */ `query ImagesByProjectIdWithDetails(
  $projectId: ID!
  $limit: Int
  $nextToken: String
  $source: String!
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
      locations(filter: { source: { contains: $source } }, limit: 1) {
        items {
          id
          source
        }
      }
      processedBy(filter: { source: { eq: $source } }, limit: 1) {
        items {
          source
        }
      }
    }
    nextToken
  }
}
`;

// Mutation to create ImageProcessedBy record
const createImageProcessedBy = /* GraphQL */ `mutation CreateImageProcessedBy(
  $input: CreateImageProcessedByInput!
) {
  createImageProcessedBy(input: $input) {
    imageId
    source
    projectId
    group
  }
}
`;

// Helper function to handle pagination for GraphQL queries
async function fetchAllPages<T, K extends string>(
  queryFn: (
    nextToken?: string
  ) => Promise<GraphQLResult<{ [key in K]: PagedList<T> }>>,
  queryName: K,
  onProgress?: (count: number) => void
): Promise<T[]> {
  const allItems: T[] = [];
  let nextToken: string | undefined;

  do {
    const response = await queryFn(nextToken);
    const items = response.data?.[queryName]?.items ?? [];
    allItems.push(...(items as T[]));
    nextToken = response.data?.[queryName]?.nextToken ?? undefined;
    
    // Log progress at 1000 intervals if callback provided
    if (onProgress && allItems.length % 1000 === 0) {
      onProgress(allItems.length);
    }
  } while (nextToken);

  console.log(
    `Completed fetching all ${queryName} pages. Total items: ${allItems.length}`
  );
  return allItems;
}

async function updateProgress(
  project: Project,
  projectImages: Image[],
  source: string
) {
  // Optimized approach: Fetch images with nested locations and processedBy in selection set
  // This avoids fetching all locations separately and just checks if at least one exists per image
  console.log(`Fetching images with processing status for project ${project.id} (source: ${source})`);
  
  const imagesWithDetails = await fetchAllPages<ImageWithDetails, 'imagesByProjectId'>(
    (nextToken) =>
      client.graphql({
        query: imagesByProjectIdWithDetails,
        variables: {
          projectId: project.id,
          source: source,
          limit: 1000,
          nextToken,
        },
      }) as Promise<GraphQLResult<{ imagesByProjectId: PagedList<ImageWithDetails> }>>,
    'imagesByProjectId',
    (count) => {
      console.log(`Fetched ${count} images with details for project ${project.id}`);
    }
  );

  console.log(`Found ${imagesWithDetails.length} total images for project ${project.id}`);
  
  const processedImageIds = new Set<string>();
  const imagesToUpdateProcessedBy: ImageWithDetails[] = [];

  // Check each image for processing status
  for (const image of imagesWithDetails) {
    const hasLocation = (image.locations?.items?.length ?? 0) > 0;
    const hasProcessedByRecord = (image.processedBy?.items?.length ?? 0) > 0;

    if (hasLocation || hasProcessedByRecord) {
      processedImageIds.add(image.id);
      
      // If it has a location but no processedBy record, we need to create one
      if (hasLocation && !hasProcessedByRecord) {
        imagesToUpdateProcessedBy.push(image);
      }
    }
  }

  console.log(`Processed images: ${processedImageIds.size}/${imagesWithDetails.length}`);
  console.log(`Images needing processedBy record update: ${imagesToUpdateProcessedBy.length}`);

  // Create processedBy records for images that have locations but no record
  if (imagesToUpdateProcessedBy.length > 0) {
    const BATCH_SIZE = 50;
    for (let i = 0; i < imagesToUpdateProcessedBy.length; i += BATCH_SIZE) {
      const batch = imagesToUpdateProcessedBy.slice(i, i + BATCH_SIZE);
      
      const createPromises = batch.map(async (image) => {
        try {
          await client.graphql({
            query: createImageProcessedBy,
            variables: {
              input: {
                imageId: image.id,
                source: source,
                projectId: project.id,
                group: project.organizationId,
              },
            },
          });
          console.log(`Created processedBy record for image ${image.id}`);
        } catch (error) {
          // Ignore duplicate key errors (record already exists)
          console.warn(`Could not create processedBy record for image ${image.id}:`, error);
        }
      });

      await Promise.all(createPromises);
    }
  }

  // Check if all images are processed
  const allImagesProcessed = imagesWithDetails.length > 0 && 
    imagesWithDetails.every((image) => processedImageIds.has(image.id));

  // Update project status if all images are processed
  if (allImagesProcessed) {
    console.log(
      `All images processed for project ${project.id}, updating status to "active"`
    );
    await client.graphql({
      query: updateProject,
      variables: {
        input: {
          id: project.id,
          status: 'active',
        },
      },
    });

    // Get all UserProjectMembership records for the project using indexed query
    const memberships = await fetchAllPages<
      UserProjectMembership,
      'userProjectMembershipsByProjectId'
    >(
      (nextToken) =>
        client.graphql({
          query: userProjectMembershipsByProjectId,
          variables: {
            projectId: project.id,
            limit: 1000,
            nextToken,
          },
        }) as Promise<
          GraphQLResult<{
            userProjectMembershipsByProjectId: PagedList<UserProjectMembership>;
          }>
        >,
      'userProjectMembershipsByProjectId'
    );

    // Dummy update the project memberships
    for (const membership of memberships) {
      await client.graphql({
        query: updateUserProjectMembership,
        variables: {
          input: {
            id: membership.id,
          },
        },
      });
    }
    console.log(
      `Successfully updated project ${project.id} status to "active"`
    );
  } else {
    console.log(
      `Project ${project.id} still has ${
        imagesWithDetails.length - processedImageIds.size
      } images to process`
    );
  }
}

export const handler: Handler = async (event, context) => {
  console.log('Starting monitorModelProgress function execution');
  try {
    // 1. List all projects with status "processing"
    console.log('Fetching projects with status "processing"');
    const processingProjects = await fetchAllPages<Project, 'listProjects'>(
      (nextToken) =>
        client.graphql({
          query: listProjects,
          variables: {
            filter: {
              status: {
                contains: 'processing',
              },
            },
            limit: 1000,
            nextToken,
          },
        }) as Promise<GraphQLResult<{ listProjects: PagedList<Project> }>>,
      'listProjects'
    );

    console.log(
      `Found ${processingProjects.length} projects in processing state`
    );

    // Process each project
    for (const project of processingProjects) {
      console.log(`Processing project ${project.name} (${project.id})`);

      const tagsRaw = project.tags ?? [];
      const tags = Array.isArray(tagsRaw)
        ? tagsRaw.filter((t): t is string => typeof t === 'string')
        : [];
      const isLegacyProject = tags.includes('legacy');

      // 2.1 List all images for the project
      console.log(`Fetching images for project ${project.id}`);
      const projectImages = await fetchAllPages<Image, 'imagesByProjectId'>(
        (nextToken) =>
          client.graphql({
            query: imagesByProjectId,
            variables: {
              projectId: project.id,
              limit: 1000,
              nextToken,
            },
          }) as Promise<GraphQLResult<{ imagesByProjectId: PagedList<Image> }>>,
        'imagesByProjectId'
      );

      console.log(
        `Found ${projectImages.length} images for project ${project.id}`
      );

      if (project.status?.includes('scoutbot')) {
        console.log(`Project ${project.id} is running scoutbot`);
        await updateProgress(project, projectImages, 'scoutbotv3');
      }

      if (project.status?.includes('mad')) {
        console.log(`Project ${project.id} is running MAD`);
        await updateProgress(project, projectImages, 'mad-v2');
      }

      if (project.status?.includes('heatmap-busy')) {
        console.log(`Project ${project.id} is running heatmapper`);

        const imagePaths = projectImages.map((image) => image.originalPath);

        const results = await Promise.all(
          imagePaths.map(async (path) => {
            const heatmapFilePath = isLegacyProject
              ? `heatmaps/${path}.h5`
              : `heatmaps/${project.organizationId}/${project.id}/${path}.h5`;
            try {
              await s3Client.send(
                new HeadObjectCommand({
                  Bucket: env.OUTPUTS_BUCKET_NAME,
                  Key: heatmapFilePath,
                })
              );
              console.info(`Heatmap file ${heatmapFilePath} available`);
              return true;
            } catch (err) {
              console.warn(`Heatmap file ${heatmapFilePath} not available yet`);
              return false;
            }
          })
        );

        const availableCount = results.filter((r) => r).length;

        if (availableCount === imagePaths.length) {
          console.log(`All heatmap files available for project ${project.id}`);
          await client.graphql({
            query: updateProject,
            variables: {
              input: { id: project.id, status: 'processing-heatmap-done' },
            },
          });
        }
      }

      if (project.status?.includes('heatmap-done')) {
        console.log(`Project ${project.id} is done running heatmapper`);
        const lambdaClient = new LambdaClient({
          region: env.AWS_REGION,
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            sessionToken: env.AWS_SESSION_TOKEN,
          },
        });

        await lambdaClient.send(
          new InvokeCommand({
            FunctionName: env.RUN_POINT_FINDER_FUNCTION_NAME,
            InvocationType: 'Event',
            Payload: Buffer.from(JSON.stringify({ projectId: project.id })),
          })
        );

        await client.graphql({
          query: updateProject,
          variables: {
            input: { id: project.id, status: 'processing-pointFinder' },
          },
        });
      }

      if (project.status?.includes('pointFinder')) {
        console.log(`Project ${project.id} is running pointFinder`);
        await updateProgress(project, projectImages, 'pointfinder');
      }
    }

    console.log('Project status monitoring completed successfully');
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Project status monitoring completed successfully',
      }),
    };
  } catch (error: any) {
    console.error('Error in monitorModelProgress:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
    });
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error monitoring project status',
        error: error.message,
      }),
    };
  }
};
