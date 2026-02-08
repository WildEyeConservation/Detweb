import type { Handler } from 'aws-lambda';
import { env } from '$amplify/env/createOrganization';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import type { GraphQLResult } from '@aws-amplify/api-graphql';

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

const createOrganizationMutation = /* GraphQL */ `
  mutation CreateOrganization($input: CreateOrganizationInput!) {
    createOrganization(input: $input) {
      id
      name
      description
      createdAt
    }
  }
`;

const createOrganizationMembershipMutation = /* GraphQL */ `
  mutation CreateOrganizationMembership($input: CreateOrganizationMembershipInput!) {
    createOrganizationMembership(input: $input) {
      organizationId
      userId
      isAdmin
    }
  }
`;

interface CreateOrganizationArgs {
  name: string;
  description?: string;
  requestingUserId: string;
}

export const handler: Handler = async (event) => {
  try {
    // Verify the caller is a sysadmin (defense in depth -- the authorizer also checks this)
    const isSysadmin = event.identity?.resolverContext?.isSysadmin === 'true';
    if (!isSysadmin) {
      return JSON.stringify({
        success: false,
        error: 'Only sysadmins can create organizations',
      });
    }

    const { name, description, requestingUserId } =
      event.arguments as CreateOrganizationArgs;

    if (!name || !requestingUserId) {
      return JSON.stringify({
        success: false,
        error: 'Missing required arguments: name, requestingUserId',
      });
    }

    // Create the organization
    const orgResult = (await client.graphql({
      query: createOrganizationMutation,
      variables: {
        input: { name, description: description || '' },
      },
    })) as GraphQLResult<{
      createOrganization: { id: string; name: string };
    }>;

    if (orgResult.errors?.length) {
      throw new Error(
        `Failed to create organization: ${JSON.stringify(orgResult.errors)}`
      );
    }

    const organizationId = orgResult.data!.createOrganization.id;

    // Create admin membership for the requesting user
    const membershipResult = (await client.graphql({
      query: createOrganizationMembershipMutation,
      variables: {
        input: {
          organizationId,
          userId: requestingUserId,
          isAdmin: true,
          isTested: false,
        },
      },
    })) as GraphQLResult<unknown>;

    if ((membershipResult as any).errors?.length) {
      throw new Error(
        `Failed to create membership: ${JSON.stringify(
          (membershipResult as any).errors
        )}`
      );
    }

    console.log(
      `Created organization ${organizationId} with admin ${requestingUserId}`
    );

    return JSON.stringify({
      success: true,
      organizationId,
      name,
    });
  } catch (error) {
    console.error('createOrganization failed:', error);
    return JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
