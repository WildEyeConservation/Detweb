import { useMemo } from 'react';
import type { Schema } from '../api/client-schema';
import { useSession } from '../auth/session';
import { client } from '../api/appClient';
import { useOptimisticUpdates } from './useOptimisticUpdates';

export function useMyMemberships() {
  const { user } = useSession();
  const subscriptionFilter = useMemo(
    () => ({
      filter: { userId: { eq: user.username } },
    }),
    [user.username]
  );

  return useOptimisticUpdates<
    Schema['UserProjectMembership']['type'],
    'UserProjectMembership'
  >(
    'UserProjectMembership',
    async (nextToken) =>
      client.models.UserProjectMembership.userProjectMembershipsByUserId(
        { userId: user.username },
        { nextToken }
      ),
    subscriptionFilter,
    {
      compositeKey: (membership) =>
        membership.userId && membership.projectId
          ? `${membership.userId}:${membership.projectId}`
          : membership.id,
    }
  );
}

export function useMyOrganizations() {
  const { user, cognitoGroups, isSysadmin } = useSession();
  const subscriptionFilter = useMemo(
    () => ({
      filter: { userId: { eq: user.username } },
    }),
    [user.username]
  );
  const allOrganizationHook = useOptimisticUpdates<
    Schema['OrganizationMembership']['type'],
    'OrganizationMembership'
  >(
    'OrganizationMembership',
    async (nextToken) =>
      client.models.OrganizationMembership.organizationsByUserId(
        { userId: user.username },
        { nextToken }
      ),
    subscriptionFilter,
    {
      compositeKey: (membership) =>
        `${membership.organizationId}:${membership.userId}`,
    }
  );
  const activeCognitoOrgIds = useMemo(
    () =>
      new Set(
        cognitoGroups.filter(
          (group) => group !== 'sysadmin' && group !== 'orgadmin'
        )
      ),
    [cognitoGroups]
  );

  return useMemo(
    () => ({
      ...allOrganizationHook,
      data: isSysadmin
        ? allOrganizationHook.data
        : allOrganizationHook.data.filter((membership) =>
            activeCognitoOrgIds.has(membership.organizationId)
          ),
    }),
    [allOrganizationHook, activeCognitoOrgIds, isSysadmin]
  );
}

export function useIsOrganizationAdmin() {
  return useMyOrganizations().data.some((membership) => membership.isAdmin);
}

export function useCurrentMembership(projectId: string | undefined) {
  const { data: memberships, meta } = useMyMemberships();

  // Read the same cache that optimistic writes and live events update.
  // The list defaults to [], so preserve its initial loading state separately.
  return {
    data: meta.isPending
      ? undefined
      : memberships.find((membership) => membership.projectId === projectId) ?? null,
    isPending: meta.isPending,
    isLoading: meta.isLoading,
    isError: meta.isError,
    error: meta.error,
  };
}
