import { env } from '$amplify/env/deleteProject';
import { Amplify } from 'aws-amplify';
import type { DeleteProjectInFullHandler } from '../../data/resource';
import {
  getProject,
  listImageSets,
  listProjects,
  listUserProjectMemberships,
  categoriesByProjectId,
  locationSetsByProjectId,
  annotationSetsByProjectId,
  imagesByProjectId,
  listObjects,
  locationSetsByAnnotationSetId,
  imageSetMembershipsByImageSetId,
  listImageFiles,
  annotationsByAnnotationSetId,
  listLocations,
} from './graphql/queries';
import { generateClient, GraphQLResult } from 'aws-amplify/data';
import {
  Category,
  AnnotationSet,
  LocationSet,
  Project,
  UserProjectMembership,
  Image,
  Object,
  TasksOnAnnotationSet,
  ImageSetMembership,
  ImageFile,
  Annotation,
  Location,
} from './graphql/API';

// Inline minimal mutations – return key fields + `group` to avoid nested-resolver
// auth failures while still enabling subscription delivery via groupDefinedIn('group').
const deleteProject = /* GraphQL */ `
  mutation DeleteProject($input: DeleteProjectInput!) {
    deleteProject(input: $input) { id group }
  }
`;
const deleteUserProjectMembership = /* GraphQL */ `
  mutation DeleteUserProjectMembership($input: DeleteUserProjectMembershipInput!) {
    deleteUserProjectMembership(input: $input) { id group }
  }
`;
const deleteCategory = /* GraphQL */ `
  mutation DeleteCategory($input: DeleteCategoryInput!) {
    deleteCategory(input: $input) { id group }
  }
`;
const deleteImageSet = /* GraphQL */ `
  mutation DeleteImageSet($input: DeleteImageSetInput!) {
    deleteImageSet(input: $input) { id group }
  }
`;
const deleteLocationSet = /* GraphQL */ `
  mutation DeleteLocationSet($input: DeleteLocationSetInput!) {
    deleteLocationSet(input: $input) { id group }
  }
`;
const deleteAnnotationSet = /* GraphQL */ `
  mutation DeleteAnnotationSet($input: DeleteAnnotationSetInput!) {
    deleteAnnotationSet(input: $input) { id group }
  }
`;
const deleteImage = /* GraphQL */ `
  mutation DeleteImage($input: DeleteImageInput!) {
    deleteImage(input: $input) { id group }
  }
`;
const deleteObject = /* GraphQL */ `
  mutation DeleteObject($input: DeleteObjectInput!) {
    deleteObject(input: $input) { id group }
  }
`;
const deleteTasksOnAnnotationSet = /* GraphQL */ `
  mutation DeleteTasksOnAnnotationSet($input: DeleteTasksOnAnnotationSetInput!) {
    deleteTasksOnAnnotationSet(input: $input) { id group }
  }
`;
const deleteImageSetMembership = /* GraphQL */ `
  mutation DeleteImageSetMembership($input: DeleteImageSetMembershipInput!) {
    deleteImageSetMembership(input: $input) { id group }
  }
`;
const deleteImageFile = /* GraphQL */ `
  mutation DeleteImageFile($input: DeleteImageFileInput!) {
    deleteImageFile(input: $input) { id group }
  }
`;
const deleteAnnotation = /* GraphQL */ `
  mutation DeleteAnnotation($input: DeleteAnnotationInput!) {
    deleteAnnotation(input: $input) { id group }
  }
`;
const deleteLocation = /* GraphQL */ `
  mutation DeleteLocation($input: DeleteLocationInput!) {
    deleteLocation(input: $input) { id group }
  }
`;

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

// Helper function to handle pagination for GraphQL queries
async function fetchAllPages<T, K extends string>(
  queryFn: (
    nextToken?: string
  ) => Promise<GraphQLResult<{ [key in K]: PagedList<T> }>>,
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

  console.log(
    `Completed fetching all ${queryName} pages. Total items: ${allItems.length}`
  );
  return allItems;
}

export const handler: DeleteProjectInFullHandler = async (
  event,
  context
) => {
  try {
    const projectId = event.arguments.projectId;

    console.log(`Deleting project ${projectId}`);

    const project = (
      await client.graphql({
        query: getProject,
        variables: {
          id: projectId,
        },
      })
    ).data?.getProject;

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    //delete project
    await client.graphql({
      query: deleteProject,
      variables: {
        input: {
          id: projectId,
        },
      },
    });

    // get all projects for the same organization
    const allProjectsInOrganization = await fetchAllPages<
      Project,
      'listProjects'
    >(
      (nextToken) =>
        client.graphql({
          query: listProjects,
          variables: {
            filter: {
              organizationId: {
                eq: project.organizationId,
              },
            },
            nextToken,
          },
        }) as Promise<GraphQLResult<{ listProjects: PagedList<Project> }>>,
      'listProjects'
    );

    // get the image set for the project we want to delete
    const [imageSet] = (
      await client.graphql({
        query: listImageSets,
        variables: {
          filter: {
            projectId: { eq: projectId },
          },
        },
      })
    ).data?.listImageSets.items;

    // delete the image set for the project
    await client.graphql({
      query: deleteImageSet,
      variables: { input: { id: imageSet.id } },
    });

    // if there are other projects in the organization, check if they have an image set with the same name - this means they're sharing S3 data
    let deleteS3Data = true;
    if (allProjectsInOrganization.length !== 1) {
      for (const project of allProjectsInOrganization) {
        if (project.id === projectId) {
          continue;
        }

        const [otherImageSet] = (
          await client.graphql({
            query: listImageSets,
            variables: {
              filter: {
                projectId: { eq: project.id },
              },
            },
          })
        ).data?.listImageSets.items;

        // can't delete S3 data since another project references it
        if (otherImageSet?.name === imageSet?.name) {
          deleteS3Data = false;
          break;
        }
      }
    }

    if (deleteS3Data) {
      console.log(`Deleting S3 data for project ${projectId}`);
      console.warn('S3 data deletion is not implemented yet');
      //TODO: We can't wait for the delete to complete within a lambda - need to rethink how we handle this
    } else {
      console.log(
        `Not deleting S3 data for project ${projectId} since it's shared with other projects`
      );
    }

    const userMemberships = await fetchAllPages<
      UserProjectMembership,
      'listUserProjectMemberships'
    >(
      (nextToken) =>
        client.graphql({
          query: listUserProjectMemberships,
          variables: { filter: { projectId: { eq: projectId } }, nextToken },
        }) as Promise<
          GraphQLResult<{
            listUserProjectMemberships: PagedList<UserProjectMembership>;
          }>
        >,
      'listUserProjectMemberships'
    );

    // delete all user memberships for the project
    await Promise.all(
      userMemberships.map(async (membership) => {
        await client.graphql({
          query: deleteUserProjectMembership,
          variables: { input: { id: membership.id } },
        });
      })
    );

    // delete all categories for the project
    const categories = await fetchAllPages<Category, 'categoriesByProjectId'>(
      (nextToken) =>
        client.graphql({
          query: categoriesByProjectId,
          variables: { projectId: projectId, nextToken },
        }) as Promise<
          GraphQLResult<{ categoriesByProjectId: PagedList<Category> }>
        >,
      'categoriesByProjectId'
    );

    await Promise.all(
      categories.map(async (category) => {
        await client.graphql({
          query: deleteCategory,
          variables: { input: { id: category.id } },
        });
      })
    );

    // delete all location sets
    const locationSets = await fetchAllPages<
      LocationSet,
      'locationSetsByProjectId'
    >(
      (nextToken) =>
        client.graphql({
          query: locationSetsByProjectId,
          variables: { projectId: projectId, nextToken },
        }) as Promise<
          GraphQLResult<{ locationSetsByProjectId: PagedList<LocationSet> }>
        >,
      'locationSetsByProjectId'
    );

    await Promise.all(
      locationSets.map(async (locationSet) => {
        await client.graphql({
          query: deleteLocationSet,
          variables: { input: { id: locationSet.id } },
        });
      })
    );

    // delete all annotation sets
    const annotationSets = await fetchAllPages<
      AnnotationSet,
      'annotationSetsByProjectId'
    >(
      (nextToken) =>
        client.graphql({
          query: annotationSetsByProjectId,
          variables: { projectId: projectId, nextToken },
        }) as Promise<
          GraphQLResult<{ annotationSetsByProjectId: PagedList<AnnotationSet> }>
        >,
      'annotationSetsByProjectId'
    );

    await Promise.all(
      annotationSets.map(async (annotationSet) => {
        await client.graphql({
          query: deleteAnnotationSet,
          variables: { input: { id: annotationSet.id } },
        });
      })
    );

    // delete all images
    const images = await fetchAllPages<Image, 'imagesByProjectId'>(
      (nextToken) =>
        client.graphql({
          query: imagesByProjectId,
          variables: { projectId: projectId, nextToken },
        }) as Promise<GraphQLResult<{ imagesByProjectId: PagedList<Image> }>>,
      'imagesByProjectId'
    );

    await Promise.all(
      images.map(async (image) => {
        await client.graphql({
          query: deleteImage,
          variables: { input: { id: image.id } },
        });
      })
    );

    // delete all tasks on annotation sets
    for (const annotationSet of annotationSets) {
      const tasksOnAnnotationSet = await fetchAllPages<
        TasksOnAnnotationSet,
        'locationSetsByAnnotationSetId'
      >(
        (nextToken) =>
          client.graphql({
            query: locationSetsByAnnotationSetId,
            variables: { annotationSetId: annotationSet.id, nextToken },
          }) as Promise<
            GraphQLResult<{
              locationSetsByAnnotationSetId: PagedList<TasksOnAnnotationSet>;
            }>
          >,
        'locationSetsByAnnotationSetId'
      );

      await Promise.all(
        tasksOnAnnotationSet.map(async (task) => {
          await client.graphql({
            query: deleteTasksOnAnnotationSet,
            variables: { input: { id: task.id } },
          });
        })
      );
    }

    // delete image set memberships
    const imageSetMemberships = await fetchAllPages<
      ImageSetMembership,
      'imageSetMembershipsByImageSetId'
    >(
      (nextToken) =>
        client.graphql({
          query: imageSetMembershipsByImageSetId,
          variables: { imageSetId: imageSet.id, nextToken },
        }) as Promise<
          GraphQLResult<{
            imageSetMembershipsByImageSetId: PagedList<ImageSetMembership>;
          }>
        >,
      'imageSetMembershipsByImageSetId'
    );

    await Promise.all(
      imageSetMemberships.map(async (imageSetMembership) => {
        await client.graphql({
          query: deleteImageSetMembership,
          variables: { input: { id: imageSetMembership.id } },
        });
      })
    );

    // delete all image files
    const imageFiles = await fetchAllPages<ImageFile, 'listImageFiles'>(
      (nextToken) =>
        client.graphql({
          query: listImageFiles,
          variables: { filter: { imageId: { eq: imageSet.id } }, nextToken },
        }) as Promise<GraphQLResult<{ listImageFiles: PagedList<ImageFile> }>>,
      'listImageFiles'
    );

    await Promise.all(
      imageFiles.map(async (imageFile) => {
        await client.graphql({
          query: deleteImageFile,
          variables: { input: { id: imageFile.id } },
        });
      })
    );

    // delete all objects
    const objects = await fetchAllPages<Object, 'listObjects'>(
      (nextToken) =>
        client.graphql({
          query: listObjects,
          variables: { filter: { projectId: { eq: projectId } }, nextToken },
        }) as Promise<GraphQLResult<{ listObjects: PagedList<Object> }>>,
      'listObjects'
    );

    await Promise.all(
      objects.map(async (object) => {
        await client.graphql({
          query: deleteObject,
          variables: { input: { id: object.id } },
        });
      })
    );

    // delete all annotations
    for (const annotationSet of annotationSets) {
      const annotations = await fetchAllPages<
        Annotation,
        'annotationsByAnnotationSetId'
      >(
        (nextToken) =>
          client.graphql({
            query: annotationsByAnnotationSetId,
            variables: { setId: annotationSet.id, nextToken },
          }) as Promise<
            GraphQLResult<{
              annotationsByAnnotationSetId: PagedList<Annotation>;
            }>
          >,
        'annotationsByAnnotationSetId'
      );

      await Promise.all(
        annotations.map(async (annotation) => {
          await client.graphql({
            query: deleteAnnotation,
            variables: { input: { id: annotation.id } },
          });
        })
      );
    }

    // delete all locations
    const locations = await fetchAllPages<Location, 'listLocations'>(
      (nextToken) =>
        client.graphql({
          query: listLocations,
          variables: { filter: { projectId: { eq: projectId } }, nextToken },
        }) as Promise<GraphQLResult<{ listLocations: PagedList<Location> }>>,
      'listLocations'
    );

    await Promise.all(
      locations.map(async (location) => {
        await client.graphql({
          query: deleteLocation,
          variables: { input: { id: location.id } },
        });
      })
    );

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: 'Project deleted',
      }),
    };
  } catch (error: any) {
    console.error('Error details:', error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error deleting project',
        error: error.message,
      }),
    };
  }
};
