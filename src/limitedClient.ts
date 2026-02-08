import pLimit from 'p-limit';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
Amplify.configure(outputs);
import { generateClient } from 'aws-amplify/api';
import { Schema } from './amplify/client-schema'; // Path to your backend resource definition
import type { DataClient } from '../amplify/shared/data-schema.generated';
import { fetchAuthSession } from 'aws-amplify/auth';

/* Here we generate a graphQL client with the Amplify API module, and then we wrap the client methods
to limit the number of concurrent requests to the GraphQL API, as well as to check for errors.

The amplify GraphQL client reports errors in a separate errors field of the response, but TanStack Query
expects the errors to be thrown as exceptions, so we need to wrap the client in a way that throws exceptions
for error responses from the server.

The pLimit module is used to limit the number of concurrent requests to the GraphQL API.

Auth is handled via Lambda authorization mode. The auth token is a composite of the Cognito ID token
and the currently selected organizationId: "${idToken}|${organizationId}". The Lambda authorizer
validates the JWT and checks organization membership. The cache key is per-token, so different
organizations produce separate authorization checks.
*/

const client = generateClient<Schema>({
  authMode: 'lambda',
}) as unknown as DataClient;

// Create a pLimit instance with a concurrency limit (adjust as needed)
const limit = pLimit(15);

// Expose a helper to run arbitrary async work through the same limiter
export const runWithClientLimit = async <T>(fn: () => Promise<T>): Promise<T> =>
  limit(fn);

// --- Organization-scoped auth token management ---

// The currently active organizationId, set when user selects an organization.
let _currentOrganizationId: string | null = null;

export function setCurrentOrganizationId(orgId: string | null) {
  _currentOrganizationId = orgId;
}

export function getCurrentOrganizationId(): string | null {
  return _currentOrganizationId;
}

// Cache the ID token to avoid fetching auth session on every request.
// The token is refreshed when it's within 5 minutes of expiration.
let _cachedIdToken: string | null = null;
let _tokenExpiry: number = 0;

async function getAuthToken(): Promise<string> {
  const now = Date.now();
  // Refresh token if expired or expiring within 5 minutes
  if (!_cachedIdToken || now >= _tokenExpiry - 5 * 60 * 1000) {
    const session = await fetchAuthSession();
    const idToken = session.tokens?.idToken;
    if (!idToken) {
      throw new Error('No ID token available - user may not be authenticated');
    }
    _cachedIdToken = idToken.toString();
    // Parse exp from JWT payload (seconds since epoch)
    const payload = JSON.parse(atob(_cachedIdToken.split('.')[1]));
    _tokenExpiry = payload.exp * 1000;
  }

  // Compose: "jwt|organizationId" or just "jwt" for exempt operations
  if (_currentOrganizationId) {
    return `${_cachedIdToken}|${_currentOrganizationId}`;
  }
  return _cachedIdToken;
}

// Custom error class for GraphQL errors
class GraphQLError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GraphQLError';
  }
}

// Function to check for GraphQL errors
function checkForErrors(result: any) {
  if (result && result.errors) {
    throw new GraphQLError(JSON.stringify(result.errors));
  }
  return result;
}

async function executeWithRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 1,
  baseDelay: number = 1000,
  maxDelay: number = 30000
): Promise<T> {
  let retryCount = 0;

  while (retryCount < maxRetries) {
    try {
      const result = await operation();

      // Handle GraphQL-style responses that might contain errors
      if (result && (result as any).errors) {
        throw new Error('Operation returned errors');
      }

      return result;
    } catch (error) {
      retryCount++;
      if (retryCount === maxRetries) {
        console.error(`Operation failed after ${maxRetries} attempts:`, error);
        throw error;
      }

      const delay = Math.min(
        baseDelay * Math.pow(2, retryCount) + Math.random() * 1000,
        maxDelay
      );
      console.warn(`Retry ${retryCount}/${maxRetries} after ${delay}ms`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw new Error('Unexpected end of retry loop');
}

// Inject authMode and authToken into the first argument of client method calls.
// Amplify client methods accept options like { authMode, authToken } in their arguments.
function injectAuth(args: any[], authToken: string): any[] {
  if (args.length === 0) {
    return [{ authMode: 'lambda' as const, authToken }];
  }

  const firstArg = args[0];
  if (typeof firstArg === 'object' && firstArg !== null && !Array.isArray(firstArg)) {
    return [{ ...firstArg, authMode: 'lambda' as const, authToken }, ...args.slice(1)];
  }

  // If first arg isn't an object (unusual), append options
  return [...args, { authMode: 'lambda' as const, authToken }];
}

// Recursive function to wrap client methods with retry logic and auth injection
function wrapClientMethods(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  const wrappedObj: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'function') {
      if (key.startsWith('on') || key.startsWith('observe')) {
        // Subscriptions return Observables (sync), not Promises, so we can't use async wrapping.
        // Inject auth using the cached token synchronously. If the token hasn't been fetched yet,
        // the subscription will use just the lambda authMode without a token, which will be
        // refreshed on the next subscription setup after the first API call caches the token.
        wrappedObj[key] = (...args: any[]) => {
          let authToken = '';
          if (_cachedIdToken) {
            authToken = _currentOrganizationId
              ? `${_cachedIdToken}|${_currentOrganizationId}`
              : _cachedIdToken;
          }
          const authedArgs = authToken ? injectAuth(args, authToken) : args;
          return value(...authedArgs);
        };
      } else {
        wrappedObj[key] = async (...args: any[]) => {
          const authToken = await getAuthToken();
          const authedArgs = injectAuth(args, authToken);
          const result = await executeWithRetry(() =>
            limit(() => value(...authedArgs))
          );
          const checkedResult = checkForErrors(result);
          return wrapClientMethods(checkedResult);
        };
      }
    } else if (typeof value === 'object') {
      if (Array.isArray(value)) {
        // Do not wrap arrays.
        wrappedObj[key] = value;
      } else {
        wrappedObj[key] = wrapClientMethods(value);
      }
    } else {
      wrappedObj[key] = value;
    }
  }
  return wrappedObj;
}

// Create the limited client with wrapped methods
export const limitedClient = wrapClientMethods(client) as DataClient;
