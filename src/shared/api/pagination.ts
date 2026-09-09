type PaginatedQueryResult<T> = {
  data: T[];
  nextToken?: string | null;
};

function splitInputAndOptions(params?: Record<string, unknown>): {
  input?: Record<string, unknown>;
  options: Record<string, unknown>;
} {
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
  const options: Record<string, unknown> = {};
  if (filter !== undefined) options.filter = filter;
  if (sortDirection !== undefined) options.sortDirection = sortDirection;
  if (limit !== undefined) options.limit = limit;
  if (selectionSet !== undefined) options.selectionSet = selectionSet;
  return { input, options };
}

export async function fetchAllPaginatedResults<T>(
  queryFn: (...args: never[]) => Promise<PaginatedQueryResult<T>>,
  params?: Record<string, unknown>,
  setStepsCompleted?: (steps: number) => void
): Promise<T[]> {
  let allResults: T[] = [];
  let nextToken: string | null | undefined = undefined;
  let stepCount = 0;

  const { input, options: baseOptions } = splitInputAndOptions(params);
  // Adapt both generated query signatures at this boundary: list(options)
  // and secondaryIndex(input, options). Keep the row type inferred from queryFn.
  const runQuery = queryFn as (
    inputOrOptions: Record<string, unknown>,
    options?: Record<string, unknown>
  ) => Promise<PaginatedQueryResult<T>>;

  do {
    const options = { ...baseOptions, nextToken };
    const result: PaginatedQueryResult<T> =
      input === undefined
        ? await runQuery(options)
        : await runQuery(input, options);
    allResults = allResults.concat(result.data);
    nextToken = result.nextToken;
    stepCount += result.data.length;

    if (setStepsCompleted) {
      setStepsCompleted(stepCount);
    }
  } while (nextToken);

  return allResults;
}
