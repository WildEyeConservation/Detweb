import { useState, useEffect } from 'react';
import { useContext } from 'react';
import { GlobalContext } from './Context';
import type { UserType } from '../amplify/shared/types';

export const useUsers = () => {
  const { client } = useContext(GlobalContext)!;
  const [result, setResult] = useState<UserType[]>([]);
  useEffect(() => {
    let isMounted = true;
    const fetchAllUsers = async () => {
      try {
        let nextToken: string | null | undefined = undefined;
        const aggregated: UserType[] = [];
        do {
          const { data } = await client.queries.listUsers(
            nextToken ? { nextToken } : {}
          );
          const users = data?.Users as UserType[] | undefined;
          if (users) aggregated.push(...users);
          nextToken = data?.NextToken ?? null;
        } while (nextToken);
        if (isMounted) setResult(aggregated);
      } catch (error) {
        console.error('Failed to list users', error);
      }
    };
    fetchAllUsers();
    return () => {
      isMounted = false;
    };
  }, [client]);
  return { users: result };
};
