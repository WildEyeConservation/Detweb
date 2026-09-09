import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { useMyOrganizations } from '../data/memberships';
import { client } from '../api/appClient';
import { dialogSearch } from './dialogSearch';

export function useOrganizationRoute() {
  const [params, setParams] = useSearchParams();
  const { data: memberships, meta } = useMyOrganizations();
  const id = params.get('organization') ?? '';
  const allowed = memberships.some(
    (row) => row.organizationId === id && row.isAdmin
  );
  const { data, isPending, isError } = useQuery({
    queryKey: ['organization', id],
    enabled: Boolean(id && allowed),
    staleTime: 30_000,
    queryFn: async () => (await client.models.Organization.get({ id })).data,
  });
  const setOrganization = useCallback(
    (organization: { id: string; name: string }) => {
      setParams((previous) => {
        const next = dialogSearch(previous, null);
        next.set('organization', organization.id);
        return next;
      });
    },
    [setParams]
  );
  return {
    allowAutoSelect: !id,
    notice:
      id && !meta.isPending && !allowed
        ? 'You do not have permission to manage this organization.'
        : id && allowed && (isError || (!isPending && !data))
        ? 'This organization is unavailable.'
        : null,
    organization: { id: allowed ? id : '', name: data?.name ?? '' },
    setOrganization,
  };
}
