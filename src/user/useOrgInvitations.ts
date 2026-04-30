import { useContext, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GlobalContext, UserContext } from '../Context';
import { Schema } from '../amplify/client-schema';

export type OrgInvite = Schema['OrganizationInvite']['type'];

export function useOrgInvitations() {
  const { user } = useContext(UserContext)!;
  const { client } = useContext(GlobalContext)!;
  const username = user.username;
  const queryKey = ['OrganizationInvite', username] as const;

  const { data, isFetching, refetch } = useQuery<OrgInvite[]>({
    queryKey,
    queryFn: async () => {
      const result = await client.models.OrganizationInvite.organizationInvitesByUsername({
        username,
      });
      return result.data;
    },
    enabled: !!username,
    staleTime: 0,
    gcTime: 0,
  });

  const pendingInvites = (data ?? []).filter((inv) => inv.status === 'pending');

  return { pendingInvites, isFetching, refetch, queryKey, username };
}

export function useRespondToInvite(
  invite: OrgInvite,
  queryKey: readonly unknown[]
) {
  const { client } = useContext(GlobalContext)!;
  const queryClient = useQueryClient();
  const [responding, setResponding] = useState(false);

  function updateCacheStatus(status: 'accepted' | 'declined') {
    queryClient.setQueryData<OrgInvite[]>(
      queryKey as unknown[],
      (old) => old?.map((inv) => (inv.id === invite.id ? { ...inv, status } : inv))
    );
  }

  async function accept() {
    setResponding(true);
    try {
      const { data, errors } = await client.mutations.respondToInvite({
        inviteId: invite.id,
        accept: true,
      });
      if (errors?.length) {
        alert(errors[0].message);
        return;
      }
      updateCacheStatus('accepted');

      let parsed: any = data;
      while (typeof parsed === 'string') parsed = JSON.parse(parsed);
      if (parsed?.addedToGroup) {
        localStorage.clear();
        sessionStorage.clear();
        if (window.indexedDB && 'databases' in indexedDB) {
          indexedDB.databases().then((dbs) => {
            dbs.forEach((db) => {
              if (db.name) indexedDB.deleteDatabase(db.name);
            });
          });
        }
        if ('caches' in window) {
          caches.keys().then((names) => {
            names.forEach((n) => caches.delete(n));
          });
        }
        window.location.reload();
      } else if (parsed && !parsed.addedToGroup) {
        alert(
          'You belong to too many organisations. Go to Settings > Active Organisations to choose which ones are active.'
        );
      }
    } catch (err: any) {
      alert(err.message ?? 'Failed to accept invite');
    } finally {
      setResponding(false);
    }
  }

  async function decline() {
    setResponding(true);
    try {
      const { errors } = await client.mutations.respondToInvite({
        inviteId: invite.id,
        accept: false,
      });
      if (errors?.length) {
        alert(errors[0].message);
        return;
      }
      updateCacheStatus('declined');
    } catch (err: any) {
      alert(err.message ?? 'Failed to decline invite');
    } finally {
      setResponding(false);
    }
  }

  return { accept, decline, responding };
}
