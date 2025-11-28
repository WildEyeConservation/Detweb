import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/monitorModelProgress';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import {
  listProjects,
  listLocations,
  listUserProjectMemberships,
} from './graphql/queries';
import {
  updateProject,
  updateUserProjectMembership,
  deleteLocation,
} from './graphql/mutations';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import { UserProjectMembership } from './graphql/API';
import { imagesByProjectId } from './graphql/queries';
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

interface Location {
  id: string;
  imageId?: string | null;
  setId: string;
  height?: number | null;
  width?: number | null;
  x: number;
  y: number;
  source: string;
}

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
  // 2.2 Fetch all locations for the project at once
  console.log(`Fetching all locations for project ${project.id}`);
  const projectLocations = await fetchAllPages<Location, 'listLocations'>(
    (nextToken) =>
      client.graphql({
        query: listLocations,
        variables: {
          filter: {
            projectId: {
              eq: project.id,
            },
          },
          limit: 1000,
          nextToken,
        },
      }) as Promise<GraphQLResult<{ listLocations: PagedList<Location> }>>,
    'listLocations',
    (count) => {
      console.log(`Fetched ${count} locations for project ${project.id}`);
    }
  );

  console.log(
    `Found ${projectLocations.length} total locations for project ${project.id}`
  );
  const processedImages = new Set();

  // 2.3 Process each image using the project's locations
  for (const image of projectImages) {
    // Filter locations for this specific image
    const imageLocations = projectLocations.filter(
      (location) => location.imageId === image.id
    );

    // Check if any location has the correct source
    const hasCorrectSource = imageLocations.some((location) =>
      location.source.includes(source)
    );

    if (hasCorrectSource) {
      console.log(`Image ${image.id} has been processed by ${source}`);
      processedImages.add(image.id);
    } else {
      console.log(`Image ${image.id} has not been processed by ${source} yet`);
    }
  }

  // 2.4 Check if all images are processed
  const allImagesProcessed = projectImages.every((image) =>
    processedImages.has(image.id)
  );

  // Update project status if all images are processed
  if (allImagesProcessed) {
    // Delete all duplicate locations
    console.log(`Checking for duplicate locations in project ${project.id}`);

    // Create a map to track unique locations
    const uniqueLocations = new Map<string, Location>();
    const duplicateLocationIds: string[] = [];

    // Process each location
    for (const location of projectLocations) {
      // Skip locations without required fields
      if (!location.imageId || !location.setId) continue;

      // Create a unique key based on the specified criteria
      const locationKey = `${location.imageId}-${location.setId}-${location.height}-${location.width}-${location.x}-${location.y}`;

      if (uniqueLocations.has(locationKey)) {
        // This is a duplicate, add to deletion list
        duplicateLocationIds.push(location.id);
      } else {
        // This is a unique location, add to our map
        uniqueLocations.set(locationKey, location);
      }
    }

    // Delete all duplicate locations
    console.log(
      `Found ${duplicateLocationIds.length} duplicate locations to delete`
    );
    // Batch deletion in groups of 20, using Promise.all, continue regardless of failures
    const BATCH_SIZE = 20;
    for (let i = 0; i < duplicateLocationIds.length; i += BATCH_SIZE) {
      const batch = duplicateLocationIds.slice(i, i + BATCH_SIZE);

      const deletePromises = batch.map(async (locationId) => {
        try {
          await client.graphql({
            query: deleteLocation,
            variables: {
              input: {
                id: locationId,
              },
            },
          });
          console.log(`Successfully deleted duplicate location ${locationId}`);
        } catch (error) {
          console.error(
            `Failed to delete duplicate location ${locationId}:`,
            error
          );
        }
      });

      // Wait for the current batch to complete, even if some fail
      await Promise.all(deletePromises);
    }

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

    //get all UserProjectMembership records for the project
    const memberships = await fetchAllPages<
      UserProjectMembership,
      'listUserProjectMemberships'
    >(
      (nextToken) =>
        client.graphql({
          query: listUserProjectMemberships,
          variables: {
            filter: {
              projectId: {
                eq: project.id,
              },
            },
            nextToken,
          },
        }) as Promise<
          GraphQLResult<{
            listUserProjectMemberships: PagedList<UserProjectMembership>;
          }>
        >,
      'listUserProjectMemberships'
    );

    //dummy update the project memberships
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
        projectImages.length - processedImages.size
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
