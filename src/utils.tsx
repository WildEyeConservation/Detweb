import { GraphQLResult, GraphqlSubscriptionResult } from '@aws-amplify/api-graphql';
import { Matrix,multiply } from 'mathjs';

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
export const makeTransform = (H: Matrix) => (c1: [number, number]): [number, number] => {
  const result = multiply(H, [c1[0], c1[1], 1]).valueOf() as number[];
  return [result[0] / result[2], result[1] / result[2]]; 
};

export const array2Matrix = (hc: number[] | null): number[][] | null => {
  if (hc && hc.length == 9) {
      const hcCopy = [...hc];  // Create a shallow copy of the input array
      const matrix = [];
      while (hcCopy.length) matrix.push(hcCopy.splice(0, 3));
      return matrix;  // Removed unnecessary intermediate variable
  } else {
      return null;
  }
};  


// ReturnTypeOfFirstElementWithX is inferred as number


