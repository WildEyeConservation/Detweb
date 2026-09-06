import { client } from '../stores/appClient';
import type { Schema } from '../amplify/client-schema';
import { useOptimisticUpdates } from '../useOptimisticUpdates';

export function useTestingProjects(organizationId: string) {
  const { data: projects } = useOptimisticUpdates<
    Schema['Project']['type'],
    'Project'
  >(
    'Project',
    async (nextToken) =>
      client.models.Project.list({
        nextToken,
        filter: { organizationId: { eq: organizationId } },
      }),
    {
      filter: { organizationId: { eq: organizationId } },
    },
    { enabled: Boolean(organizationId), subscribe: false }
  );

  return projects;
}

export function useTestingPresets(organizationId: string) {
  const { data: testPresets } = useOptimisticUpdates<
    Schema['TestPreset']['type'],
    'TestPreset'
  >(
    'TestPreset',
    async (nextToken) =>
      client.models.TestPreset.testPresetsByOrganizationId(
        { organizationId: organizationId },
        { nextToken }
      ),
    {
      filter: { organizationId: { eq: organizationId } },
    },
    { enabled: Boolean(organizationId), subscribe: false }
  );

  return testPresets;
}

export function useTestingMemberships(organizationId: string) {
  const membershipsHook = useOptimisticUpdates<
    Schema['OrganizationMembership']['type'],
    'OrganizationMembership'
  >(
    'OrganizationMembership',
    async (nextToken) =>
      client.models.OrganizationMembership.membershipsByOrganizationId(
        { organizationId: organizationId },
        { nextToken }
      ),
    {
      filter: { organizationId: { eq: organizationId } },
    },
    {
      enabled: Boolean(organizationId),
      compositeKey: (membership) =>
        `${membership.organizationId}:${membership.userId}`,
    }
  );
  return membershipsHook;
}
