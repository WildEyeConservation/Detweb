import { useContext, useEffect, useRef, useState } from 'react';
import { UserContext } from '../Context';
import { GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { Spinner, ProgressBar } from 'react-bootstrap';

export type QueueProgressQueue = {
  url?: string | null;
  batchSize?: number | null;
  totalBatches?: number | null;
  launchedCount?: number | null;
  observedCount?: number | null;
  requeuesCompleted?: number | null;
  emptyQueueTimestamp?: string | null;
};

type QueueProgressProps = {
  queue: QueueProgressQueue;
  prefix?: string;
  onScanningChange?: (isScanning: boolean) => void;
};

export default function QueueProgress({
  queue,
  prefix,
  onScanningChange,
}: QueueProgressProps) {
  const { getSqsClient } = useContext(UserContext)!;
  const [jobsRemaining, setJobsRemaining] = useState<number>(0);
  const [hasPolled, setHasPolled] = useState(false);

  const prevScanningRef = useRef<boolean>(false);

  const url = queue.url || '';

  useEffect(() => {
    if (!url) return;
    let interval: ReturnType<typeof setInterval>;
    let cancelled = false;

    async function updateJobsRemaining() {
      try {
        const sqsClient = await getSqsClient();
        const attrs = await sqsClient.send(
          new GetQueueAttributesCommand({
            QueueUrl: url,
            AttributeNames: ['ApproximateNumberOfMessages'] as any[],
          })
        );
        if (cancelled) return;
        const num = attrs.Attributes?.ApproximateNumberOfMessages;
        setJobsRemaining(num ? Number(num) : 0);
        setHasPolled(true);
      } catch (err) {
        console.error('Failed to poll queue depth', err);
      }
    }

    updateJobsRemaining();
    interval = setInterval(updateJobsRemaining, 10000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [url, getSqsClient]);

  const batchSize = queue.batchSize ?? 0;
  const totalBatches = queue.totalBatches ?? 0;
  const launchedCount = queue.launchedCount ?? null;
  const observedCount = queue.observedCount ?? null;
  const requeuesCompleted = queue.requeuesCompleted ?? null;
  const emptyQueueTimestamp = queue.emptyQueueTimestamp ?? null;

  const isScanning =
    hasPolled &&
    jobsRemaining === 0 &&
    launchedCount != null &&
    emptyQueueTimestamp != null &&
    (observedCount || 0) < launchedCount &&
    (requeuesCompleted || 0) < 1;

  const isPolling = hasPolled && jobsRemaining === 0 && !isScanning;

  const shouldDisable = isScanning || isPolling;

  useEffect(() => {
    if (shouldDisable !== prevScanningRef.current) {
      prevScanningRef.current = shouldDisable;
      onScanningChange?.(shouldDisable);
    }
  }, [shouldDisable, onScanningChange]);

  const metaClass = 'ss-job-card__meta mb-0';

  if (!url) return null;

  if (!hasPolled) {
    return <Spinner animation='border' size='sm' />;
  }

  if (batchSize > 0) {
    const batchesRemaining = Math.ceil(jobsRemaining / batchSize);
    if (isScanning) {
      return (
        <div className='d-flex flex-column w-100'>
          <div className={`${metaClass} d-flex align-items-center gap-2`}>
            <Spinner animation='border' size='sm' />
            <span>{prefix}Scanning for missed locations...</span>
          </div>
          <ProgressBar
            now={totalBatches - batchesRemaining}
            max={totalBatches}
            className='w-100'
          />
        </div>
      );
    }
    if (isPolling) {
      return (
        <div className='d-flex flex-column w-100'>
          <div className={`${metaClass} d-flex align-items-center gap-2`}>
            <Spinner animation='border' size='sm' />
            <span>{prefix}Polling for work...</span>
          </div>
          <ProgressBar
            now={totalBatches}
            max={totalBatches}
            className='w-100'
          />
        </div>
      );
    }
    return (
      <div className='d-flex flex-column w-100'>
        <p className={metaClass}>
          {prefix}
          {batchesRemaining} batches remaining
        </p>
        <ProgressBar
          now={totalBatches - batchesRemaining}
          max={totalBatches}
          animated
          className='w-100'
        />
      </div>
    );
  }

  if (isScanning) {
    return (
      <div className={`${metaClass} d-flex align-items-center gap-2`}>
        <Spinner animation='border' size='sm' />
        <span>{prefix}Scanning for missed locations...</span>
      </div>
    );
  }
  if (isPolling) {
    return (
      <div className={`${metaClass} d-flex align-items-center gap-2`}>
        <Spinner animation='border' size='sm' />
        <span>{prefix}Polling for work...</span>
      </div>
    );
  }
  return (
    <p className={metaClass}>
      {prefix}Jobs remaining: {jobsRemaining}
    </p>
  );
}
