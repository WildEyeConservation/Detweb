export function authorizeRequest(
  identity: { sub?: string; groups?: string[] | null } | null | undefined,
  organizationId: string
): void {
  // API key (null) or IAM/Lambda call (no 'sub' field) - allow through
  if (!identity?.sub) return;

  // Cognito user - verify organization membership
  const groups = identity.groups ?? [];
  if (groups.includes('sysadmin') || groups.includes(organizationId)) return;

  throw new Error('Unauthorized: user does not belong to the project organization');
}
