export function surveyNamesQuery(
  userId: string,
  list: (input: { userId: string }, options: {
    filter: { isAdmin: { eq: boolean } };
    selectionSet: readonly ['project.name'];
    limit: number;
    nextToken?: string;
  }) => Promise<{
    data: { project?: { name: string } | null }[];
    nextToken?: string | null;
    errors?: { message: string }[];
  }>
) {
  return {
    queryKey: ['surveys-names', userId] as const,
    staleTime: 30_000,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const names = new Set<string>();
      let nextToken: string | undefined;
      do {
        signal.throwIfAborted();
        const result = await list({ userId }, {
          filter: { isAdmin: { eq: true } },
          selectionSet: ['project.name'],
          limit: 100,
          nextToken,
        });
        if (result.errors?.length) {
          throw new Error(result.errors.map((error) => error.message).join('; '));
        }
        for (const { project } of result.data) {
          if (project) names.add(project.name.toLowerCase());
        }
        nextToken = result.nextToken ?? undefined;
      } while (nextToken);
      return [...names];
    },
  };
}
