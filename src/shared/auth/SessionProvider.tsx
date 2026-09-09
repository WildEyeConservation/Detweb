import { Session, SessionContext } from './session';
import { useCallback, useMemo } from 'react';
import { SQSClient } from '@aws-sdk/client-sqs';
import { AuthUser, fetchAuthSession } from '@aws-amplify/auth';
import { appRegion } from '../api/appClient';

export function SessionProvider({
  user,
  cognitoGroups,
  children,
}: {
  user: AuthUser;
  cognitoGroups: string[];
  children: React.ReactNode;
}) {
  const getSqsClient = useCallback(async () => {
    const { credentials } = await fetchAuthSession();
    return new SQSClient({ region: appRegion, credentials });
  }, []);
  const value = useMemo<Session>(
    () => ({
      user,
      cognitoGroups,
      isSysadmin: cognitoGroups.includes('sysadmin'),
      getSqsClient,
    }),
    [user, cognitoGroups, getSqsClient]
  );
  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
