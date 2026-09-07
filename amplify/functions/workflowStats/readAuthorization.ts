/** Reporting is user-facing: unlike internal writers, it never accepts IAM/API-key identities. */
export function requireWorkflowStatsUser(identity: unknown): { sub: string; groups: string[] } {
  const user = identity as { sub?: unknown; groups?: unknown } | null | undefined;
  if (typeof user?.sub !== 'string' || !user.sub.trim()) {
    throw new Error('Unauthorized: sign in to view workflow statistics');
  }
  return {
    sub: user.sub,
    groups: Array.isArray(user.groups) ? user.groups.filter((group): group is string => typeof group === 'string') : [],
  };
}

/** Ownership comes from trusted run/event/aggregate records, never request arguments. */
export function authorizeWorkflowStatsItem(identity: unknown, item: { organizationId?: unknown }): void {
  const user = requireWorkflowStatsUser(identity);
  if (user.groups.includes('sysadmin')) return;
  if (typeof item.organizationId === 'string' && item.organizationId && user.groups.includes(item.organizationId)) return;
  throw new Error('Unauthorized: workflow statistics belong to another organization');
}
