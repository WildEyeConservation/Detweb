import { useContext, useEffect, useState } from 'react';
import { UserContext, GlobalContext } from '../Context';
import { GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { Spinner, ProgressBar } from 'react-bootstrap';

type ProjectProgressProps = {
  projectId: string;
};

export default function ProjectProgress({ projectId }: ProjectProgressProps) {
  const { client } = useContext(GlobalContext)!;
  const { getSqsClient } = useContext(UserContext)!;
  const [isLoading, setIsLoading] = useState(true);
  const [queueInfo, setQueueInfo] = useState<{
    url: string;
    batchSize: number;
    totalBatches: number;
  } | null>(null);
  const [jobsRemaining, setJobsRemaining] = useState<number>(0);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let cancelled = false;

    async function fetchQueueAndStartPolling() {
      setIsLoading(true);
      const result = await client.models.Project.get(
        { id: projectId },
        {
          selectionSet: ['queues.url', 'queues.batchSize', 'queues.totalBatches'],
        }
      );
      const projectData = (result as { data: any }).data;
      if (cancelled || !projectData?.queues?.length) {
        setIsLoading(false);
        return;
      }
      const q = projectData.queues[0];
      const url = q.url || '';
      const batchSize = q.batchSize || 0;
      const totalBatches = q.totalBatches || 0;
      setQueueInfo({ url, batchSize, totalBatches });
      setIsLoading(false);

      async function updateJobsRemaining() {
        const sqsClient = await getSqsClient();
        const params = {
          QueueUrl: url,
          AttributeNames: ['ApproximateNumberOfMessages'] as const,
        };
        const attrs = await sqsClient.send(new GetQueueAttributesCommand(params));
        if (cancelled) return;
        const num = attrs.Attributes?.ApproximateNumberOfMessages;
        setJobsRemaining(num ? Number(num) : 0);
      }

      updateJobsRemaining();
      interval = setInterval(updateJobsRemaining, 10000);
    }

    fetchQueueAndStartPolling();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [projectId, client, getSqsClient]);

  if (isLoading || !queueInfo) {
    return <Spinner />;
  }

  const { batchSize, totalBatches } = queueInfo;
  if (batchSize > 0) {
    const batchesRemaining = Math.ceil(jobsRemaining / batchSize);
    return (
      <div className="d-flex flex-column w-100">
        <p className="mb-0">{batchesRemaining} batches remaining</p>
        <ProgressBar
          now={totalBatches - batchesRemaining}
          max={totalBatches}
          animated
          className="w-100"
        />
      </div>
    );
  } else {
    return <p className="mb-0">Jobs remaining: {jobsRemaining}</p>;
  }
} 