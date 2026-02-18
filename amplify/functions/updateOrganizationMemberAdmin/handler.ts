import type { UpdateOrganizationMemberAdminHandler } from '../../data/resource';
import { env } from '$amplify/env/updateOrganizationMemberAdmin';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import { authorizeOrgAdmin } from '../shared/authorizeOrgAdmin';

const updateOrganizationMembershipMutation = /* GraphQL */ `
  mutation UpdateOrganizationMembership($input: UpdateOrganizationMembershipInput!) {
    updateOrganizationMembership(input: $input) {
      organizationId userId isAdmin isTested group createdAt updatedAt
    }
  }
`;

const listProjectsByOrgQuery = /* GraphQL */ `
  query ListProjects($filter: ModelProjectFilterInput, $limit: Int, $nextToken: String) {
    listProjects(filter: $filter, limit: $limit, nextToken: $nextToken) {
      items { id group }
      nextToken
    }
  }
`;

const listUserProjectMembershipsQuery = /* GraphQL */ `
  query UserProjectMembershipsByUserId($userId: String!, $limit: Int, $nextToken: String) {
    userProjectMembershipsByUserId(userId: $userId, limit: $limit, nextToken: $nextToken) {
      items { id projectId isAdmin group }
      nextToken
    }
  }
`;

const updateUserProjectMembershipMutation = /* GraphQL */ `
  mutation UpdateUserProjectMembership($input: UpdateUserProjectMembershipInput!) {
    updateUserProjectMembership(input: $input) {
      id userId projectId isAdmin queueId backupQueueId group createdAt updatedAt
    }
  }
`;

const createUserProjectMembershipMutation = /* GraphQL */ `
  mutation CreateUserProjectMembership($input: CreateUserProjectMembershipInput!) {
    createUserProjectMembership(input: $input) {
      id userId projectId isAdmin group createdAt updatedAt
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

const gqlClient = generateClient({ authMode: 'iam' });

async function executeGraphql<T>(
  query: string,
  variables: Record<string, any>
): Promise<T> {
  const response = (await gqlClient.graphql({
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
    const data = await executeGraphql<{ [key in K]: PagedList<T> }>(
      queryString,
      { ...variables, nextToken }
    );
    const items = data[queryName]?.items ?? [];
    allItems.push(...items);
    nextToken = data[queryName]?.nextToken ?? undefined;
  } while (nextToken);

  return allItems;
}

export const handler: UpdateOrganizationMemberAdminHandler = async (event) => {
  try {
    console.log('Invoked updateOrganizationMemberAdmin with event:', JSON.stringify(event));
    const { organizationId, userId, isAdmin } = event.arguments;

    // 1. Authorize caller as org admin
    await authorizeOrgAdmin(event.identity, organizationId, executeGraphql);

    // 2. Prevent self-demotion
    if (event.identity?.sub === userId && !isAdmin) {
      throw new Error('Cannot demote yourself');
    }

    // 3. Update OrganizationMembership.isAdmin
    await executeGraphql(updateOrganizationMembershipMutation, {
      input: { organizationId, userId, isAdmin },
    });

    // 4. Cascade to project memberships
    const orgProjects = await fetchAllPages<
      { id: string; group: string },
      'listProjects'
    >(listProjectsByOrgQuery, {
      filter: { organizationId: { eq: organizationId } },
      limit: 1000,
    }, 'listProjects');

    const orgProjectIds = new Set(orgProjects.map((p) => p.id));

    const userMemberships = await fetchAllPages<
      { id: string; projectId: string; isAdmin: boolean | null },
      'userProjectMembershipsByUserId'
    >(listUserProjectMembershipsQuery, { userId, limit: 1000 }, 'userProjectMembershipsByUserId');

    const userOrgMemberships = userMemberships.filter((m) => orgProjectIds.has(m.projectId));

    if (isAdmin) {
      // Promoting: ensure admin membership exists for all org projects
      const memberProjectIds = new Set(userOrgMemberships.map((m) => m.projectId));
      for (const project of orgProjects) {
        const existing = userOrgMemberships.find((m) => m.projectId === project.id);
        if (existing) {
          if (!existing.isAdmin) {
            await executeGraphql(updateUserProjectMembershipMutation, {
              input: { id: existing.id, isAdmin: true },
            });
          }
        } else {
          await executeGraphql(createUserProjectMembershipMutation, {
            input: {
              userId,
              projectId: project.id,
              isAdmin: true,
              group: project.group,
            },
          });
        }
      }
    } else {
      // Demoting: set isAdmin=false on all user's org project memberships
      for (const membership of userOrgMemberships) {
        if (membership.isAdmin) {
          await executeGraphql(updateUserProjectMembershipMutation, {
            input: { id: membership.id, isAdmin: false },
          });
        }
      }
    }

    console.log(`User ${userId} admin status updated to ${isAdmin} in org ${organizationId}`);
    return JSON.stringify({ success: true });
  } catch (err) {
    console.error('updateOrganizationMemberAdmin failed:', err instanceof Error ? err.message : String(err));
    throw err instanceof Error ? err : new Error(String(err));
  }
};
