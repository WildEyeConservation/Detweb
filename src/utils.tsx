import { GraphQLResult, GraphqlSubscriptionResult } from '@aws-amplify/api-graphql';

export type UnknownGraphQLResponse = GraphQLResult<any> | GraphqlSubscriptionResult<any>;

//The name of a FIFO queue can only include alphanumeric characters, hyphens, or underscores, must end with .fifo suffix and be 1 to 80 in length.
export function makeSafeQueueName(input: string): string {
  // Remove disallowed characters
  let sanitized = input.replace(/[^a-zA-Z0-9-_]/g, "_");
  // Ensure length is within limits (1 to 80 including .fifo)
  const maxMainLength = 75;
  if (sanitized.length > maxMainLength) {
    sanitized = sanitized.substring(0, maxMainLength);
  }
  return sanitized;
}

type PaginatedQueryResult<T> = {
  data: T[];
  nextToken?: string | null;
};

type QueryFunction<T, P> = (
  params: P & { nextToken?: string | null }
) => Promise<PaginatedQueryResult<T>>;

type SelectionSet<T> = (keyof T)[] | string[];

interface RetryConfig {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
}

export async function fetchAllPaginatedResults<
  T,
  P extends { selectionSet?: SelectionSet<T> },
  R = P['selectionSet'] extends SelectionSet<T> ? Pick<T, P['selectionSet'][number]> : T
>(
  queryFn: QueryFunction<R, P>,
  params: P,
  setStepsCompleted?: (steps: number) => void,
  retryConfig: RetryConfig = {}
): Promise<R[]> {
  const {
    maxRetries = 5,
    baseDelay = 1000,
    maxDelay = 30000
  } = retryConfig;

  let allResults: R[] = [];
  let nextToken: string | null | undefined = undefined;
  let stepCount = 0;

  do {
    let retryCount = 0;
    let success = false;
    
    while (!success && retryCount < maxRetries) {
      try {
        const result = await queryFn({ ...params, nextToken });
        if (!result) {
          throw new Error('Operation returned errors');
        }
        
        allResults = allResults.concat(result.data);
        nextToken = result.nextToken;
        stepCount += result.data.length;

        if (setStepsCompleted) {
          setStepsCompleted(stepCount);
        }
        
        success = true; // Mark this iteration as successful
      } catch (error) {
        retryCount++;
        if (retryCount === maxRetries) {
          console.error(`Pagination query failed after ${maxRetries} attempts:`, error);
          throw error;
        }

        const delay = Math.min(
          baseDelay * Math.pow(2, retryCount) + Math.random() * 1000,
          maxDelay
        );
        console.warn(`Retry ${retryCount}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  } while (nextToken);

  return allResults;
}

// ReturnTypeOfFirstElementWithX is inferred as number


