import { useQueries, useQuery } from '@tanstack/react-query';
import { useSession } from '../session';
import { queueCountQuery } from './queueCountQuery';

export function useQueueMessageCount(url: string | undefined) {
  const { getSqsClient } = useSession();
  return useQuery(queueCountQuery(url, getSqsClient)).data;
}

export function useQueueMessageCounts(urls: (string | null | undefined)[]) {
  const { getSqsClient } = useSession();
  const uniqueUrls = [
    ...new Set(urls.filter((url): url is string => Boolean(url))),
  ];
  const queries = useQueries({
    queries: uniqueUrls.map((url) => queueCountQuery(url, getSqsClient)),
  });
  // Keep unknown counts distinct from confirmed empty queues.
  return Object.fromEntries(
    uniqueUrls.map((url, index) => [url, queries[index].data])
  );
}
