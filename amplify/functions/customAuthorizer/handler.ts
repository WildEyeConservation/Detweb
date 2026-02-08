import type { AppSyncAuthorizerHandler } from 'aws-lambda';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

// This function is defined inline in defineData (not in defineBackend) to avoid
// circular CDK dependencies. So $amplify/env types are not generated.
const env = {
  SSM_USER_POOL_ID_PARAM: process.env.SSM_USER_POOL_ID_PARAM!,
  SSM_TABLE_NAME_PARAM: process.env.SSM_TABLE_NAME_PARAM!,
};

const dynamoClient = new DynamoDBClient({});
const ssmClient = new SSMClient({});

// Cached SSM values (resolved once per Lambda cold start)
let _userPoolId: string | null = null;
let _tableName: string | null = null;

async function getUserPoolId(): Promise<string> {
  if (_userPoolId) return _userPoolId;
  const result = await ssmClient.send(
    new GetParameterCommand({ Name: env.SSM_USER_POOL_ID_PARAM })
  );
  _userPoolId = result.Parameter!.Value!;
  return _userPoolId;
}

async function getTableName(): Promise<string> {
  if (_tableName) return _tableName;
  const result = await ssmClient.send(
    new GetParameterCommand({ Name: env.SSM_TABLE_NAME_PARAM })
  );
  _tableName = result.Parameter!.Value!;
  return _tableName;
}

// Lazily initialized JWT verifier (needs User Pool ID at runtime)
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

async function getVerifier() {
  if (!verifier) {
    const userPoolId = await getUserPoolId();
    verifier = CognitoJwtVerifier.create({
      userPoolId,
      tokenUse: 'id',
      clientId: null, // accept any client
    });
  }
  return verifier;
}

// Operations that don't require an organizationId (pre-org-selection flows)
const EXEMPT_OPERATIONS = new Set([
  // Users need to see their org memberships before selecting an org
  'ListOrganizationMemberships',
  'OrganizationsByUserId',
  // Users need to read org info for display
  'GetOrganization',
  'ListOrganizations',
  // Org registration (requesting a new org)
  'CreateOrganizationRegistration',
  'ListOrganizationRegistrations',
  'UpdateOrganizationRegistration',
  'GetOrganizationRegistration',
  'OrganizationRegistrationsByStatus',
  // Org invites by username (user checks their invites)
  'OrganizationInvitesByUsername',
  // Pub/sub
  'Publish',
  'Receive',
]);

// Query fields that are exempt (secondary index queries)
const EXEMPT_QUERY_PATTERNS = [
  'organizationsByUserId',
  'organizationInvitesByUsername',
  'organizationRegistrationsByStatus',
];

function isExemptOperation(queryString: string, operationName: string | null): boolean {
  if (operationName && EXEMPT_OPERATIONS.has(operationName)) {
    return true;
  }

  // Check if the query contains exempt query field names
  for (const pattern of EXEMPT_QUERY_PATTERNS) {
    if (queryString.includes(pattern)) {
      return true;
    }
  }

  // Check for publish/receive mutations
  if (queryString.includes('publish(') || queryString.includes('receive(')) {
    return true;
  }

  return false;
}

async function checkMembership(organizationId: string, userId: string): Promise<boolean> {
  const tableName = await getTableName();
  const result = await dynamoClient.send(
    new GetItemCommand({
      TableName: tableName,
      Key: {
        organizationId: { S: organizationId },
        userId: { S: userId },
      },
    })
  );
  return !!result.Item;
}

export const handler: AppSyncAuthorizerHandler<{
  userId: string;
  organizationId: string;
  isSysadmin: string;
}> = async (event) => {
  const { authorizationToken, requestContext } = event;

  try {
    // Parse composite token: "jwt|organizationId" or just "jwt"
    const separatorIndex = authorizationToken.lastIndexOf('|');
    let token: string;
    let organizationId: string | null = null;

    if (separatorIndex > 0) {
      token = authorizationToken.substring(0, separatorIndex);
      organizationId = authorizationToken.substring(separatorIndex + 1);
      if (!organizationId) organizationId = null;
    } else {
      token = authorizationToken;
    }

    // Verify the Cognito JWT
    const payload = await (await getVerifier()).verify(token);
    const userId = payload.sub;
    const groups: string[] = (payload['cognito:groups'] as string[]) || [];

    // Sysadmins bypass all organization checks
    if (groups.includes('sysadmin')) {
      return {
        isAuthorized: true,
        resolverContext: {
          userId,
          isSysadmin: 'true',
          organizationId: organizationId || '',
        },
      };
    }

    // If organizationId provided, validate membership
    if (organizationId) {
      const isMember = await checkMembership(organizationId, userId);
      if (!isMember) {
        console.warn(
          `User ${userId} denied access to organization ${organizationId}`
        );
        return { isAuthorized: false };
      }

      return {
        isAuthorized: true,
        resolverContext: {
          userId,
          organizationId,
          isSysadmin: 'false',
        },
      };
    }

    // No organizationId - check if the operation is exempt
    const queryString = requestContext.queryString || '';
    const operationName = requestContext.operationName || null;

    if (isExemptOperation(queryString, operationName)) {
      return {
        isAuthorized: true,
        resolverContext: {
          userId,
          isSysadmin: 'false',
          organizationId: '',
        },
        // IMPORTANT: Do not cache exempt-without-orgId responses.
        // AppSync caches by authorizationToken only (not by operation), so a cached
        // "isAuthorized: true" from an exempt call would let the same bare JWT
        // bypass org checks on non-exempt operations for the full TTL.
        ttlOverride: 0,
      };
    }

    // No organizationId and not exempt - deny
    console.warn(
      `User ${userId} denied: no organizationId and operation not exempt. Operation: ${operationName}`
    );
    return { isAuthorized: false };
  } catch (error) {
    console.error('Authorization error:', error);
    return { isAuthorized: false };
  }
};
