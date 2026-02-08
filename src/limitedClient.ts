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

Auth: The client defaults to userPool auth (for subscriptions which are not wrapped).
Wrapped CRUD/list methods override to lambda auth and inject the Cognito access token
so that every request goes through the custom Lambda authorizer.
*/

const client = generateClient<Schema>({
  authMode: 'userPool',
}) as unknown as DataClient;

// Create a pLimit instance with a concurrency limit (adjust as needed)
const limit = pLimit(15);

// Expose a helper to run arbitrary async work through the same limiter
export const runWithClientLimit = async <T>(fn: () => Promise<T>): Promise<T> =>
  limit(fn);

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

// Methods where auth options go in the second argument: method(input, options)
// All other methods (list, custom index queries) take a single options object.
const CRUD_METHODS = new Set(['create', 'update', 'delete', 'get']);

/** Fetch the current Cognito access token for Lambda authorizer auth. */
async function getAuthToken(): Promise<string> {
  const session = await fetchAuthSession();
  return session.tokens?.accessToken?.toString() ?? '';
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
        // Do not wrap the onCreate, onUpdate, onDelete, functions as these are sync methods (no
        // underlying network request). They continue to use userPool auth for subscriptions.
        wrappedObj[key] = value;
      } else {
        wrappedObj[key] = async (...args: any[]) => {
          // Inject Lambda authorizer auth into every wrapped call
          const token = await getAuthToken();
          const authOptions = {
            authMode: 'lambda' as const,
            authToken: token,
          };

          const modifiedArgs = [...args];

          if (CRUD_METHODS.has(key)) {
            // create/get/update/delete: auth goes in the second argument
            if (
              modifiedArgs.length >= 2 &&
              typeof modifiedArgs[1] === 'object'
            ) {
              modifiedArgs[1] = { ...modifiedArgs[1], ...authOptions };
            } else {
              modifiedArgs.push(authOptions);
            }
          } else {
            // list and custom index queries: auth merges into the first argument
            modifiedArgs[0] = { ...(modifiedArgs[0] || {}), ...authOptions };
          }

          const result = await executeWithRetry(() =>
            limit(() => value(...modifiedArgs))
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
