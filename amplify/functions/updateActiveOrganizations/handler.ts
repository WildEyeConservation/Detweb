import type { UpdateActiveOrganizationsHandler } from '../../data/resource';
import { env } from '$amplify/env/updateActiveOrganizations';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import {
  CognitoIdentityProviderClient,
  AdminListGroupsForUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';

const PROTECTED_GROUPS = new Set(['sysadmin', 'orgadmin']);
const TOTAL_GROUP_LIMIT = 5;

// GraphQL queries and mutations
const listMembershipsByUserId = /* GraphQL */ `
  query OrganizationsByUserId($userId: String!, $nextToken: String) {
    organizationsByUserId(userId: $userId, nextToken: $nextToken) {
      items {
        organizationId
        userId
        isAdmin
        group
      }
      nextToken
    }
  }
`;

const getOrganization = /* GraphQL */ `
  query GetOrganization($id: ID!) {
    getOrganization(id: $id) {
      id
      name
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
const cognitoClient = new CognitoIdentityProviderClient();

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

interface Membership {
  organizationId: string;
  userId: string;
  isAdmin: boolean;
  group: string;
}

export const handler: UpdateActiveOrganizationsHandler = async (event) => {
  try {
    console.log('Invoked updateActiveOrganizations with event:', JSON.stringify(event));
    const { activatedOrganizationIds } = event.arguments;
    const userId = event.identity?.username;

    if (!userId) {
      throw new Error('User identity not found');
    }

    // 1. Fetch all OrganizationMembership records for this user
    const allMemberships: Membership[] = [];
    let nextToken: string | null = null;
    do {
      type MembershipResult = { organizationsByUserId: { items: Membership[]; nextToken: string | null } };
      const result: MembershipResult = await executeGraphql<MembershipResult>(listMembershipsByUserId, { userId, nextToken });
      allMemberships.push(...result.organizationsByUserId.items);
      nextToken = result.organizationsByUserId.nextToken;
    } while (nextToken);

    console.log(`Found ${allMemberships.length} memberships for user ${userId}`);

    // 2. Validate every activated ID has a matching membership
    const membershipOrgIds = new Set(allMemberships.map((m) => m.organizationId));
    for (const orgId of activatedOrganizationIds) {
      if (!membershipOrgIds.has(orgId)) {
        throw new Error(`User is not a member of organisation ${orgId}`);
      }
    }

    // 3. Get user's current cognito groups
    const cognitoGroupsResult = await cognitoClient.send(
      new AdminListGroupsForUserCommand({
        Username: userId,
        UserPoolId: env.AMPLIFY_AUTH_USERPOOL_ID,
      })
    );
    const currentGroups = new Set(
      (cognitoGroupsResult.Groups || []).map((g) => g.GroupName!)
    );

    // 4. Calculate dynamic limit based on protected group membership
    const protectedGroupCount = [...PROTECTED_GROUPS].filter((g) => currentGroups.has(g)).length;
    const maxActive = TOTAL_GROUP_LIMIT - protectedGroupCount;

    // Clamp to maxActive if over the limit (e.g. user had too many groups before this feature)
    const clampedIds = activatedOrganizationIds.slice(0, maxActive);
    if (clampedIds.length < activatedOrganizationIds.length) {
      console.log(`Clamped activated orgs from ${activatedOrganizationIds.length} to ${maxActive} (${protectedGroupCount} slot(s) reserved for system groups)`);
    }
    const activatedSet = new Set(clampedIds);

    // Sync cognito groups
    for (const membership of allMemberships) {
      const orgId = membership.organizationId;
      const shouldBeActive = activatedSet.has(orgId);
      const isInGroup = currentGroups.has(orgId);

      if (shouldBeActive && !isInGroup) {
        // Add to cognito group
        console.log(`Adding user ${userId} to group ${orgId}`);
        await cognitoClient.send(
          new AdminAddUserToGroupCommand({
            Username: userId,
            GroupName: orgId,
            UserPoolId: env.AMPLIFY_AUTH_USERPOOL_ID,
          })
        );
      } else if (!shouldBeActive && isInGroup && !PROTECTED_GROUPS.has(orgId)) {
        // Remove from cognito group
        console.log(`Removing user ${userId} from group ${orgId}`);
        await cognitoClient.send(
          new AdminRemoveUserFromGroupCommand({
            Username: userId,
            GroupName: orgId,
            UserPoolId: env.AMPLIFY_AUTH_USERPOOL_ID,
          })
        );
      }
    }

    // 5. Fetch Organization names for each membership
    const membershipsWithNames = await Promise.all(
      allMemberships.map(async (m) => {
        try {
          const orgResult = await executeGraphql<{
            getOrganization: { id: string; name: string } | null;
          }>(getOrganization, { id: m.organizationId });
          return {
            organizationId: m.organizationId,
            organizationName: orgResult.getOrganization?.name ?? 'Unknown',
            isAdmin: m.isAdmin,
            isActive: activatedSet.has(m.organizationId),
          };
        } catch {
          return {
            organizationId: m.organizationId,
            organizationName: 'Unknown',
            isAdmin: m.isAdmin,
            isActive: activatedSet.has(m.organizationId),
          };
        }
      })
    );

    console.log(`Successfully updated active organisations for user ${userId}`);
    return JSON.stringify({
      success: true,
      memberships: membershipsWithNames,
      activeOrganizationIds: clampedIds,
      maxActive,
    });
  } catch (err) {
    console.error(
      'updateActiveOrganizations failed:',
      err instanceof Error ? err.message : String(err)
    );
    throw err instanceof Error ? err : new Error(String(err));
  }
};
