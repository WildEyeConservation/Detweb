import pLimit from 'p-limit';
import { Amplify } from 'aws-amplify';
import outputs from '../amplify_outputs.json';
Amplify.configure(outputs);
import { generateClient } from 'aws-amplify/api';
import { Schema } from './amplify/client-schema'; // Path to your backend resource definition
import type { DataClient } from '../amplify/shared/data-schema.generated';

/* Here we generate a graphQL client with the Amplify API module, and then we wrap the client methods
to limit the number of concurrent requests to the GraphQL API, as well as to check for errors.

The amplify GraphQL client reports errors in a separate errors field of the response, but TanStack Query
expects the errors to be thrown as exceptions, so we need to wrap the client in a way that throws exceptions
for error responses from the server.

The pLimit module is used to limit the number of concurrent requests to the GraphQL API. 
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

// Recursive function to wrap client methods with retry logic
function wrapClientMethods(obj: any): any {
  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }
  const wrappedObj: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'function') {
      if (key.startsWith('on') || key.startsWith('observe')) {
        // Do not wrap the onCreate, onUpdate, onDelete, functions as these are sync methods (no
        // underlying network request). It would have been better make the distinction based on
        // the return type, but that info is not available at runtime without invoking the method.
        wrappedObj[key] = value;
      } else {
        wrappedObj[key] = async (...args: any[]) => {
          const result = await executeWithRetry(() =>
            limit(() => value(...args))
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
