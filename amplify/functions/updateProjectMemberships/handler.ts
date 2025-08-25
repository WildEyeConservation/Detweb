import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/updateProjectMemberships';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import {
  listUserProjectMemberships,
  getProject,
  listOrganizationMemberships,
} from './graphql/queries';
import {
  updateUserProjectMembership,
  updateOrganizationMembership,
} from './graphql/mutations';
import { OrganizationMembership, UserProjectMembership } from './graphql/API';

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

async function fetchAllPages<T, K extends string>(
  queryFn: (
    nextToken?: string
  ) => Promise<GraphQLResult<{ [key in K]: PagedList<T> }>>,
  queryName: K
): Promise<T[]> {
  const allItems: T[] = [];
  let nextToken: string | undefined;

  do {
    console.log(`Fetching ${queryName} next page`);
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

export const handler: Handler = async (event, context) => {
  const { projectId } = event.arguments;

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
              eq: projectId,
            },
          },
          limit: 1000,
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

  const { data: project } = await client.graphql({
    query: getProject,
    variables: {
      id: projectId,
    },
  });

  const organizationId = project?.getProject?.organizationId;

  //get all organizationMemberships
  if (organizationId) {
    const orgMemberships = await fetchAllPages<
      OrganizationMembership,
      'listOrganizationMemberships'
    >(
      (nextToken) =>
        client.graphql({
          query: listOrganizationMemberships,
          variables: {
            filter: {
              organizationId: {
                eq: organizationId,
              },
            },
            nextToken,
            limit: 1000,
          },
        }) as Promise<
          GraphQLResult<{
            listOrganizationMemberships: PagedList<OrganizationMembership>;
          }>
        >,
      'listOrganizationMemberships'
    );

    //dummy update the organization memberships
    for (const membership of orgMemberships) {
      await client.graphql({
        query: updateOrganizationMembership,
        variables: {
          input: {
            organizationId: membership.organizationId,
            userId: membership.userId,
          },
        },
      });
    }
  }
};
