import { useQuery } from '@tanstack/react-query';
import type { UserType } from '../../../amplify/shared/types';
import { client } from '../api/appClient';
import { userDirectoryQuery } from './userDirectoryQuery';

const EMPTY_USERS: UserType[] = [];

export function useAllUsers() {
  const { data, refetch } = useQuery(
    userDirectoryQuery(async () => {
      let nextToken: string | null | undefined = undefined;
      const aggregated: UserType[] = [];
      do {
        const { data, errors } = await client.queries.listUsers(
          nextToken ? { nextToken } : {}
        );
        if (errors?.length)
          throw new Error(errors.map((error) => error.message).join('; '));
        const users = data?.Users as UserType[] | undefined;
        if (users) aggregated.push(...users);
        nextToken = data?.NextToken ?? null;
      } while (nextToken);
      return aggregated;
    })
  );

  return { users: data ?? EMPTY_USERS, refetch };
}
