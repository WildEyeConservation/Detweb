import type { QueryClient, QueryKey } from '@tanstack/react-query';

// A newly visible view must catch up without replacing pending optimistic
// edits with an older server snapshot. Stop waiting if the view hides again.
export function refreshAfterMutations(
  client: QueryClient,
  queryKey: QueryKey,
  refresh: () => void
) {
  let active = true;
  const check = () => {
    if (!active || client.isMutating({ mutationKey: queryKey, exact: true }))
      return;
    active = false;
    unsubscribe();
    refresh();
  };
  const unsubscribe = client.getMutationCache().subscribe(check);
  check();
  return () => {
    active = false;
    unsubscribe();
  };
}
