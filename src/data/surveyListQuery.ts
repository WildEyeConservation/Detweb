export interface SurveySummary {
  id: string;
  name: string;
  organizationId: string;
  organization: { name: string };
  status?: string | null;
  createdAt?: string | null;
  annotationSets: { id: string; name: string }[];
  queues: { id: string }[];
  individualIdJobs: { id: string; status?: string | null }[];
}

// Search and active-job sorting need these small relationships, but queue
// counters, upload metadata and image counts belong only to visible rows.
export const SURVEY_SUMMARY_SELECTION = [
  'project.id', 'project.name', 'project.organizationId',
  'project.organization.name', 'project.status', 'project.createdAt',
  'project.annotationSets.id', 'project.annotationSets.name',
  'project.queues.id', 'project.individualIdJobs.id', 'project.individualIdJobs.status',
] as const;

export const surveyListKey = (userId: string, organizationId: string) =>
  ['surveys-list', userId, organizationId] as const;

export function surveyListQuery(
  userId: string,
  organizationId: string,
  list: (input: { userId: string }, options: {
    filter: { isAdmin: { eq: boolean }; group?: { eq: string } };
    selectionSet: typeof SURVEY_SUMMARY_SELECTION;
    limit: number;
    nextToken?: string;
  }) => Promise<{
    data: { project?: SurveySummary | null }[];
    nextToken?: string | null;
    errors?: { message: string }[];
  }>
) {
  return {
    queryKey: surveyListKey(userId, organizationId),
    staleTime: 30_000,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const projects = new Map<string, SurveySummary>();
      let nextToken: string | undefined;
      do {
        signal.throwIfAborted();
        const result = await list({ userId }, {
          filter: {
            isAdmin: { eq: true },
            ...(organizationId ? { group: { eq: organizationId } } : {}),
          },
          selectionSet: SURVEY_SUMMARY_SELECTION,
          limit: 100,
          nextToken,
        });
        if (result.errors?.length) throw new Error(result.errors.map((error) => error.message).join('; '));
        for (const { project } of result.data) {
          if (project && (!organizationId || project.organizationId === organizationId)) {
            projects.set(project.id, project);
          }
        }
        nextToken = result.nextToken ?? undefined;
      } while (nextToken);
      return [...projects.values()];
    },
  };
}

export function surveyPage<T>(rows: T[], page: number, pageSize: number) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.max(0, Math.min(page, pageCount - 1));
  return {
    currentPage,
    pageCount,
    rows: rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize),
    nextRows: rows.slice((currentPage + 1) * pageSize, (currentPage + 2) * pageSize),
  };
}

export function selectSurveySummaries(projects: SurveySummary[], organizationId: string, search: string, sortBy: string) {
  const filteredProjects = projects.filter((project) => {
    const searchLower = search.toLowerCase();
    const matchesStatus =
      project.status !== 'deleted' && project.status !== 'hidden';
    const matchesOrganization =
      !organizationId || project.organizationId === organizationId;
    const matchesAnnotationSet = project.annotationSets.some((set: { name: string }) =>
      set.name.toLowerCase().includes(searchLower)
    );
    const matchesSearch =
      searchLower === '' ||
      project.name.toLowerCase().includes(searchLower) ||
      project.organization.name.toLowerCase().includes(searchLower) ||
      matchesAnnotationSet;

    return matchesStatus && matchesOrganization && matchesSearch;
  });

  return [...filteredProjects].sort((a, b) => {
    if (sortBy === 'createdAt') {
      return new Date(b.createdAt ?? '').getTime() - new Date(a.createdAt ?? '').getTime();
    }
    if (sortBy === 'createdAt-reverse') {
      return new Date(a.createdAt ?? '').getTime() - new Date(b.createdAt ?? '').getTime();
    }
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    if (sortBy === 'name-reverse') {
      return b.name.localeCompare(a.name);
    }
    if (sortBy === 'activeJobs') {
      const hasJobA = a.queues.length > 0 || a.individualIdJobs.some((job) => job.status === 'active' || job.status === 'launching');
      const hasJobB = b.queues.length > 0 || b.individualIdJobs.some((job) => job.status === 'active' || job.status === 'launching');
      if (hasJobA !== hasJobB) return hasJobA ? -1 : 1;
      return new Date(b.createdAt ?? '').getTime() - new Date(a.createdAt ?? '').getTime();
    }
    return 0;
  });

}
