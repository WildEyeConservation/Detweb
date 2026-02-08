import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/manageOrgMembership';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { GraphQLResult } from '@aws-amplify/api-graphql';
import {
  CognitoIdentityProviderClient,
  ListUsersCommand,
} from '@aws-sdk/client-cognito-identity-provider';

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
        clearCredentialsAndIdentityId: () => {},
      },
    },
  }
);

const client = generateClient({ authMode: 'iam' });
const cognitoClient = new CognitoIdentityProviderClient({});

// GraphQL queries/mutations
const getOrganizationMembership = /* GraphQL */ `
  query GetOrganizationMembership($organizationId: ID!, $userId: String!) {
    getOrganizationMembership(organizationId: $organizationId, userId: $userId) {
      organizationId
      userId
      isAdmin
    }
  }
`;

const listMembershipsByOrgId = /* GraphQL */ `
  query MembershipsByOrganizationId($organizationId: ID!) {
    membershipsByOrganizationId(organizationId: $organizationId) {
      items {
        organizationId
        userId
        isAdmin
      }
    }
  }
`;

const createMembership = /* GraphQL */ `
  mutation CreateOrganizationMembership($input: CreateOrganizationMembershipInput!) {
    createOrganizationMembership(input: $input) {
      organizationId
      userId
      isAdmin
    }
  }
`;

const deleteMembership = /* GraphQL */ `
  mutation DeleteOrganizationMembership($input: DeleteOrganizationMembershipInput!) {
    deleteOrganizationMembership(input: $input) {
      organizationId
      userId
    }
  }
`;

async function verifyCallerIsAdmin(
  organizationId: string,
  callerUserId: string
): Promise<void> {
  const result = (await client.graphql({
    query: getOrganizationMembership,
    variables: { organizationId, userId: callerUserId },
  })) as GraphQLResult<{
    getOrganizationMembership: { isAdmin: boolean } | null;
  }>;

  const membership = result.data?.getOrganizationMembership;
  if (!membership?.isAdmin) {
    throw new Error('Only organization admins can manage memberships');
  }
}

async function findUserByEmail(email: string): Promise<string> {
  // Validate email format to prevent filter injection
  if (!/^[^\s"\\]+@[^\s"\\]+\.[^\s"\\]+$/.test(email)) {
    throw new Error('Invalid email format');
  }

  const result = await cognitoClient.send(
    new ListUsersCommand({
      UserPoolId: env.USER_POOL_ID,
      Filter: `email = "${email}"`,
      Limit: 1,
    })
  );

  const user = result.Users?.[0];
  if (!user?.Username) {
    throw new Error(`No user found with email: ${email}`);
  }
  return user.Username;
}

interface AddMemberArgs {
  organizationId: string;
  userEmail: string;
  role?: string;
}

interface RemoveMemberArgs {
  organizationId: string;
  userId: string;
}

async function handleAddMember(args: AddMemberArgs, callerUserId: string) {
  const { organizationId, userEmail, role } = args;

  await verifyCallerIsAdmin(organizationId, callerUserId);

  // Find user by email in Cognito
  const userId = await findUserByEmail(userEmail);

  // Check if already a member
  const existing = (await client.graphql({
    query: getOrganizationMembership,
    variables: { organizationId, userId },
  })) as GraphQLResult<{
    getOrganizationMembership: { userId: string } | null;
  }>;

  if (existing.data?.getOrganizationMembership) {
    return { success: false, error: 'User is already a member of this organization' };
  }

  // Create membership
  const result = (await client.graphql({
    query: createMembership,
    variables: {
      input: {
        organizationId,
        userId,
        isAdmin: role === 'admin',
        isTested: false,
      },
    },
  })) as GraphQLResult<unknown>;

  if ((result as any).errors?.length) {
    throw new Error(
      `Failed to create membership: ${JSON.stringify((result as any).errors)}`
    );
  }

  console.log(`Added user ${userId} to organization ${organizationId}`);
  return { success: true, userId };
}

async function handleRemoveMember(args: RemoveMemberArgs, callerUserId: string) {
  const { organizationId, userId } = args;

  await verifyCallerIsAdmin(organizationId, callerUserId);

  // Prevent removing yourself if you're the last admin
  const membershipsResult = (await client.graphql({
    query: listMembershipsByOrgId,
    variables: { organizationId },
  })) as GraphQLResult<{
    membershipsByOrganizationId: {
      items: { organizationId: string; userId: string; isAdmin: boolean }[];
    };
  }>;

  const memberships =
    membershipsResult.data?.membershipsByOrganizationId?.items ?? [];
  const admins = memberships.filter((m) => m.isAdmin);

  if (admins.length <= 1 && admins[0]?.userId === userId) {
    return {
      success: false,
      error: 'Cannot remove the last admin from the organization',
    };
  }

  // Delete membership
  const result = (await client.graphql({
    query: deleteMembership,
    variables: {
      input: { organizationId, userId },
    },
  })) as GraphQLResult<unknown>;

  if ((result as any).errors?.length) {
    throw new Error(
      `Failed to delete membership: ${JSON.stringify((result as any).errors)}`
    );
  }

  console.log(`Removed user ${userId} from organization ${organizationId}`);
  return { success: true };
}

export const handler: Handler = async (event) => {
  try {
    // Determine operation from the field name
    const fieldName = event.info?.fieldName || event.fieldName;
    // The caller's userId is passed in the resolver context by the Lambda authorizer
    const callerUserId =
      event.identity?.resolverContext?.userId ||
      event.identity?.sub ||
      event.identity?.username;

    if (!callerUserId) {
      return JSON.stringify({ success: false, error: 'Unable to identify caller' });
    }

    let result;

    if (fieldName === 'addMemberToOrganization') {
      result = await handleAddMember(event.arguments as AddMemberArgs, callerUserId);
    } else if (fieldName === 'removeMemberFromOrganization') {
      result = await handleRemoveMember(
        event.arguments as RemoveMemberArgs,
        callerUserId
      );
    } else {
      result = { success: false, error: `Unknown operation: ${fieldName}` };
    }

    return JSON.stringify(result);
  } catch (error) {
    console.error('manageOrgMembership failed:', error);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
