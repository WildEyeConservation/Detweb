import type { UpdateProjectMembershipsHandler } from '../../data/resource';
import { env } from '$amplify/env/updateProjectMemberships';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import { authorizeRequest } from '../shared/authorizeRequest';

// Inline minimal queries/mutations – return key fields + `group` to avoid nested-resolver
// auth failures while still enabling subscription delivery via groupDefinedIn('group').
const listUserProjectMembershipsQuery = /* GraphQL */ `
  query ListUserProjectMemberships($filter: ModelUserProjectMembershipFilterInput, $limit: Int, $nextToken: String) {
    listUserProjectMemberships(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items { id group }
      nextToken
    }
  }
`;

const getProjectQuery = /* GraphQL */ `
  query GetProject($id: ID!) {
    getProject(id: $id) { organizationId }
  }
`;

const listOrganizationMembershipsQuery = /* GraphQL */ `
  query ListOrganizationMemberships($filter: ModelOrganizationMembershipFilterInput, $limit: Int, $nextToken: String, $organizationId: ID, $sortDirection: ModelSortDirection, $userId: ModelStringKeyConditionInput) {
    listOrganizationMemberships(filter: $filter, limit: $limit, nextToken: $nextToken, organizationId: $organizationId, sortDirection: $sortDirection, userId: $userId) {
      items { organizationId userId group }
      nextToken
    }
  }
`;

// Return all scalar fields (no nested relations) so subscription clients receive full data.
const updateUserProjectMembershipMutation = /* GraphQL */ `
  mutation UpdateUserProjectMembership($input: UpdateUserProjectMembershipInput!) {
    updateUserProjectMembership(input: $input) {
      id
      userId
      projectId
      isAdmin
      queueId
      backupQueueId
      group
      createdAt
      updatedAt
    }
  }
`;

// Return all scalar fields (no nested relations) so subscription clients receive full data.
const updateOrganizationMembershipMutation = /* GraphQL */ `
  mutation UpdateOrganizationMembership($input: UpdateOrganizationMembershipInput!) {
    updateOrganizationMembership(input: $input) {
      organizationId
      userId
      isAdmin
      isTested
      group
      createdAt
      updatedAt
    }
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

// Shared GraphQL helper that surfaces descriptive errors.
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
      `GraphQL error: ${JSON.stringify(
        response.errors.map((err) => err.message)
      )}`
    );
  }
  if (!response.data) {
    throw new Error('GraphQL response missing data');
  }
  return response.data;
}

interface PagedList<T> {
  items: T[];
  nextToken: string | null | undefined;
}

async function fetchAllPages<T, K extends string>(
  queryString: string,
  variables: Record<string, any>,
  queryName: K
): Promise<T[]> {
  const allItems: T[] = [];
  let nextToken: string | undefined;

  do {
    console.log(`Fetching ${queryName} next page`);
    const data = await executeGraphql<{ [key in K]: PagedList<T> }>(
      queryString,
      { ...variables, nextToken }
    );
    const items = data[queryName]?.items ?? [];
    allItems.push(...items);
    nextToken = data[queryName]?.nextToken ?? undefined;
  } while (nextToken);

  console.log(
    `Completed fetching all ${queryName} pages. Total items: ${allItems.length}`
  );
  return allItems;
}

export const handler: UpdateProjectMembershipsHandler = async (event) => {
  try {
    console.log('Invoked updateProjectMemberships with event:', JSON.stringify(event));
    const { projectId } = event.arguments;

    // Fetch project to get organizationId for authorization
    const projectData = await executeGraphql<{
      getProject?: { organizationId?: string | null };
    }>(getProjectQuery, { id: projectId });
    const organizationId = projectData.getProject?.organizationId;

    if (organizationId) {
      authorizeRequest(event.identity, organizationId);
    }

    //get all UserProjectMembership records for the project
    const memberships = await fetchAllPages<
      { id: string },
      'listUserProjectMemberships'
    >(
      listUserProjectMembershipsQuery,
      { filter: { projectId: { eq: projectId } }, limit: 1000 },
      'listUserProjectMemberships'
    );

    //dummy update the project memberships
    for (const membership of memberships) {
      await executeGraphql<{ updateUserProjectMembership?: { id: string } }>(
        updateUserProjectMembershipMutation,
        { input: { id: membership.id } }
      );
    }

    //get all organizationMemberships
    if (organizationId) {
      const orgMemberships = await fetchAllPages<
        { organizationId: string; userId: string },
        'listOrganizationMemberships'
      >(
        listOrganizationMembershipsQuery,
        { filter: { organizationId: { eq: organizationId } }, limit: 1000 },
        'listOrganizationMemberships'
      );

      //dummy update the organization memberships
      for (const membership of orgMemberships) {
        await executeGraphql<{
          updateOrganizationMembership?: { organizationId: string; userId: string };
        }>(updateOrganizationMembershipMutation, {
          input: {
            organizationId: membership.organizationId,
            userId: membership.userId,
          },
        });
      }
    }
  } catch (err) {
    console.error('updateProjectMemberships failed:', err instanceof Error ? err.message : String(err));
    throw err instanceof Error ? err : new Error(String(err));
  }
};
