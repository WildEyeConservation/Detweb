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

export async function fetchAllPaginatedResults<
  T,
  P extends { selectionSet?: SelectionSet<T> },
  R = P['selectionSet'] extends SelectionSet<T> ? Pick<T, P['selectionSet'][number]> : T
>(
  queryFn: QueryFunction<R, P>,
  params: P,
  setStepsCompleted?: (steps: number) => void
): Promise<R[]> {
  let allResults: R[] = [];
  let nextToken: string | null | undefined = undefined;
  let stepCount = 0;

  do {
    const result = await queryFn({ ...params, nextToken });
    allResults = allResults.concat(result.data);
    nextToken = result.nextToken;
    stepCount += result.data.length;

    if (setStepsCompleted) {
      setStepsCompleted(stepCount);
    }

  } while (nextToken);

  return allResults;
}

// ReturnTypeOfFirstElementWithX is inferred as number


