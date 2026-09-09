import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Schema } from '../api/client-schema';
import { client } from '../api/appClient';
import { useOptimisticUpdates } from './useOptimisticUpdates';

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project', projectId],
    queryFn: async () => {
      if (!projectId) return undefined;
      const { data } = await client.models.Project.get({ id: projectId });
      return data ?? undefined;
    },
    enabled: Boolean(projectId),
  });
}

export function useCategories(projectId: string | undefined) {
  const subscriptionFilter = useMemo(
    () => ({
      filter: { projectId: { eq: projectId } },
    }),
    [projectId]
  );

  return useOptimisticUpdates<Schema['Category']['type'], 'Category'>(
    'Category',
    async (nextToken) =>
      client.models.Category.categoriesByProjectId(
        { projectId: projectId ?? '' },
        { nextToken, limit: 10000 }
      ),
    subscriptionFilter,
    { enabled: Boolean(projectId), subscribe: false }
  );
}
