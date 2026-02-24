const getOrganizationMembershipQuery = /* GraphQL */ `
  query GetOrganizationMembership($organizationId: ID!, $userId: String!) {
    getOrganizationMembership(organizationId: $organizationId, userId: $userId) {
      organizationId
      userId
      isAdmin
      group
    }
  }
`;

/**
 * Verifies that the caller is an admin of the given organization.
 * Checks Cognito groups (sysadmin or org member) then verifies isAdmin via GraphQL.
 * Throws if either check fails.
 */
export async function authorizeOrgAdmin(
  identity: { sub?: string; groups?: string[] | null } | null | undefined,
  organizationId: string,
  executeGraphql: <T>(query: string, variables: Record<string, any>) => Promise<T>
): Promise<void> {
  if (!identity?.sub) return; // IAM / API key call

  const groups = identity.groups ?? [];
  if (!groups.includes('sysadmin') && !groups.includes(organizationId)) {
    throw new Error('Unauthorized: user does not belong to this organization');
  }

  // Sysadmins bypass the membership admin check
  if (groups.includes('sysadmin')) return;

  const data = await executeGraphql<{
    getOrganizationMembership?: { isAdmin?: boolean | null } | null;
  }>(getOrganizationMembershipQuery, {
    organizationId,
    userId: identity.sub,
  });

  if (!data.getOrganizationMembership?.isAdmin) {
    throw new Error('Unauthorized: user is not an admin of this organization');
  }
}
