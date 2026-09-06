import { GetQueueAttributesCommand, type SQSClient } from '@aws-sdk/client-sqs';

export function queueCountQuery(
  url: string | undefined,
  getClient: () => Promise<Pick<SQSClient, 'send'>>
) {
  return {
    queryKey: ['sqsMessageCount', url] as const,
    queryFn: async ({ signal }: { signal: AbortSignal }) => {
      const sqs = await getClient();
      const result = await sqs.send(
        new GetQueueAttributesCommand({
          QueueUrl: url,
          AttributeNames: ['ApproximateNumberOfMessages'],
        }),
        { abortSignal: signal }
      );
      return Number(result.Attributes?.ApproximateNumberOfMessages ?? 0);
    },
    enabled: Boolean(url),
    staleTime: 10_000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always' as const,
  };
}
