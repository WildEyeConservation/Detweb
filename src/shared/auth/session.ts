import { createContext, useContext } from 'react';
import { SQSClient } from '@aws-sdk/client-sqs';
import { AuthUser } from '@aws-amplify/auth';

// Identity is the one thing that is genuinely global to the signed-in app.
// Everything else (server data, UI state) lives in query hooks or stores.
export interface Session {
  user: AuthUser;
  cognitoGroups: string[];
  isSysadmin: boolean;
  getSqsClient: () => Promise<SQSClient>;
}

export const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error('useSession must be used inside SessionProvider');
  }
  return session;
}
