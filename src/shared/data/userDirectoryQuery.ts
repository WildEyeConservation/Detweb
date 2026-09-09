import type { UserType } from '../../../amplify/shared/types';

export const ALL_USERS_QUERY_KEY = ['allUsers'] as const;

export function userDirectoryQuery(load: () => Promise<UserType[]>) {
  return {
    queryKey: ALL_USERS_QUERY_KEY,
    queryFn: load,
    staleTime: 5 * 60_000,
  };
}
