import { client } from '../stores/appClient';

const PROJECT_SELECTION_SET = [
  'id',
  'name',
  'organizationId',
  'organization.name',
  'status',
  'updatedAt',
  'createdAt',
  'tiledLocationSetId',
  'annotationSets.id',
  'annotationSets.name',
  'queues.id',
  'queues.url',
  'queues.name',
  'queues.tag',
  'queues.batchSize',
  'queues.totalBatches',
  'queues.launchedCount',
  'queues.observedCount',
  'queues.requeuesCompleted',
  'queues.emptyQueueTimestamp',
  'individualIdJobs.id',
  'individualIdJobs.status',
  'imageSets.imageCount',
] as const;

export const surveyDetailsKey = (id: string) => ['surveys-project-details', id] as const;

export function surveyDetailsQuery(id: string) {
  return {
    queryKey: surveyDetailsKey(id),
    queryFn: async () => {
      const { data, errors } = await client.models.Project.get(
        { id },
        { selectionSet: PROJECT_SELECTION_SET }
      );
      if (errors?.length) throw new Error(errors.map((error) => error.message).join('; '));
      return data;
    },
    staleTime: 30_000,
  };
}
