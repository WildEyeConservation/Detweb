import { useContext, useEffect, useState } from 'react';
import { GlobalContext } from '../Context';
import { Spinner } from 'react-bootstrap';
import QueueProgress, { QueueProgressQueue } from './QueueProgress';

type ProjectProgressProps = {
  projectId: string;
  prefix?: string;
  onScanningChange?: (isScanning: boolean) => void;
};

export default function ProjectProgress({ projectId, prefix, onScanningChange }: ProjectProgressProps) {
  const { client } = useContext(GlobalContext)!;
  const [isLoading, setIsLoading] = useState(true);
  const [queue, setQueue] = useState<QueueProgressQueue | null>(null);
  const [registering, setRegistering] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchQueue() {
      setIsLoading(true);
      const projectData = (
        await client.models.Project.get(
          { id: projectId },
          {
            selectionSet: [
              'queues.url',
              'queues.batchSize',
              'queues.totalBatches',
              'queues.launchedCount',
              'queues.observedCount',
              'queues.requeuesCompleted',
              'queues.emptyQueueTimestamp',
              'annotationSets.register',
            ],
          }
        )
      ).data;

      if (cancelled) return;

      const register = projectData?.annotationSets.some((set: { register?: boolean | null }) => set.register) ?? false;
      setRegistering(register);
      if (register) {
        setIsLoading(false);
        return;
      }

      if (!projectData?.queues?.length) {
        setQueue(null);
        setIsLoading(false);
        return;
      }

      const q = projectData.queues[0];
      setQueue({
        url: q.url,
        batchSize: q.batchSize,
        totalBatches: q.totalBatches,
        launchedCount: q.launchedCount,
        observedCount: q.observedCount,
        requeuesCompleted: q.requeuesCompleted,
        emptyQueueTimestamp: q.emptyQueueTimestamp,
      });
      setIsLoading(false);
    }

    fetchQueue();

    return () => {
      cancelled = true;
    };
  }, [projectId, client]);

  if (registering) {
    return <p className='ss-job-card__meta mb-0 w-100'>{prefix}Registering</p>;
  }

  if (isLoading || !queue) {
    return <Spinner />;
  }

  return (
    <QueueProgress
      queue={queue}
      prefix={prefix}
      onScanningChange={onScanningChange}
    />
  );
}
