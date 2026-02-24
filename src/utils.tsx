import {
  GraphQLResult,
  GraphqlSubscriptionResult,
} from '@aws-amplify/api-graphql';
import { Matrix, multiply } from 'mathjs';

export type UnknownGraphQLResponse =
  | GraphQLResult<any>
  | GraphqlSubscriptionResult<any>;


type PaginatedQueryResult<T> = {
  data: T[];
  nextToken?: string | null;
};

type SelectionSet<T> = (keyof T)[] | string[];

function splitInputAndOptions(params: any): { input?: any; options: any } {
  if (!params) {
    return { input: undefined, options: {} };
  }
  const {
    filter,
    sortDirection,
    limit,
    nextToken: _nt,
    selectionSet,
    ...rest
  } = params;
  const input = Object.keys(rest).length ? rest : undefined;
  const options: any = {};
  if (filter !== undefined) options.filter = filter;
  if (sortDirection !== undefined) options.sortDirection = sortDirection;
  if (limit !== undefined) options.limit = limit;
  if (selectionSet !== undefined) options.selectionSet = selectionSet;
  return { input, options };
}

export async function fetchAllPaginatedResults<T>(
  queryFn:
    | ((options?: any) => Promise<PaginatedQueryResult<T>>)
    | ((input: any, options?: any) => Promise<PaginatedQueryResult<T>>),
  params?: any,
  setStepsCompleted?: (steps: number) => void
): Promise<T[]> {
  let allResults: T[] = [];
  let nextToken: string | null | undefined = undefined;
  let stepCount = 0;

  const { input, options: baseOptions } = splitInputAndOptions(params);

  do {
    const options = { ...baseOptions, nextToken };
    const result =
      input === undefined
        ? await (queryFn as any)(options)
        : await (queryFn as any)(input, options);
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
export const makeTransform =
  (H: Matrix) =>
  (c1: [number, number]): [number, number] => {
    const result = multiply(H, [c1[0], c1[1], 1]).valueOf() as number[];
    return [result[0] / result[2], result[1] / result[2]];
  };

export const array2Matrix = (hc: number[] | null): number[][] | null => {
  if (hc && hc.length == 9) {
    const hcCopy = [...hc]; // Create a shallow copy of the input array
    const matrix = [];
    while (hcCopy.length) matrix.push(hcCopy.splice(0, 3));
    return matrix; // Removed unnecessary intermediate variable
  } else {
    return null;
  }
};

// ReturnTypeOfFirstElementWithX is inferred as number
