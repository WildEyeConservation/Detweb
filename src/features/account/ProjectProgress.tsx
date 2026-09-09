import { useEffect, useRef } from 'react';
import { Spinner, ProgressBar } from 'react-bootstrap';
import { useQueueMessageCount } from '../../shared/data/queueCounts';

interface ProjectProgressProps {
  queue?: {
    url?: string | null;
    batchSize?: number | null;
    totalBatches?: number | null;
    launchedCount?: number | null;
    observedCount?: number | null;
    requeuesCompleted?: number | null;
    emptyQueueTimestamp?: string | null;
  };
  onScanningChange?: (isScanning: boolean) => void;
  jobsRemaining?: number;
}

export default function ProjectProgress(props: ProjectProgressProps) {
  // Jobs already owns these queries. Its rows consume the supplied count,
  // including undefined while loading, instead of starting another poller.
  return 'jobsRemaining' in props
    ? <ProjectProgressView {...props} />
    : <PolledProjectProgress {...props} />;
}

function PolledProjectProgress(props: ProjectProgressProps) {
  const jobsRemaining = useQueueMessageCount(props.queue?.url || undefined);
  return <ProjectProgressView {...props} jobsRemaining={jobsRemaining} />;
}

function ProjectProgressView({ queue, onScanningChange, jobsRemaining }: ProjectProgressProps) {
  const queueInfo = queue
    ? {
        url: queue.url || '',
        batchSize: queue.batchSize || 0,
        totalBatches: queue.totalBatches || 0,
        launchedCount: queue.launchedCount ?? null,
        observedCount: queue.observedCount ?? null,
        requeuesCompleted: queue.requeuesCompleted ?? null,
        emptyQueueTimestamp: queue.emptyQueueTimestamp ?? null,
      }
    : null;

  const prevScanningRef = useRef<boolean>(false);

  const isScanning = jobsRemaining === 0
    && queueInfo?.launchedCount != null
    && queueInfo?.emptyQueueTimestamp != null
    && (queueInfo.observedCount || 0) < queueInfo.launchedCount
    && (queueInfo.requeuesCompleted || 0) < 1;

  const isPolling = jobsRemaining === 0 && !isScanning;

  const shouldDisable = isScanning || isPolling;

  useEffect(() => {
    if (shouldDisable !== prevScanningRef.current) {
      prevScanningRef.current = shouldDisable;
      onScanningChange?.(shouldDisable);
    }
  }, [shouldDisable, onScanningChange]);

  // Match the old behaviour: spin until the first SQS count has arrived.
  if (!queueInfo || jobsRemaining === undefined) {
    return <Spinner />;
  }

  const { batchSize, totalBatches } = queueInfo;
  if (batchSize > 0) {
    const batchesRemaining = Math.ceil(jobsRemaining / batchSize);
    if (isScanning) {
      return (
        <div className='d-flex flex-column w-100'>
          <div className='d-flex align-items-center gap-2 mb-0'>
            <Spinner animation='border' size='sm' />
            <span>Scanning for missed locations...</span>
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
          <div className='d-flex align-items-center gap-2 mb-0'>
            <Spinner animation='border' size='sm' />
            <span>Polling for work...</span>
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
        <p className='mb-0'>{batchesRemaining} batches remaining</p>
        <ProgressBar
          now={totalBatches - batchesRemaining}
          max={totalBatches}
          animated
          className='w-100'
        />
      </div>
    );
  } else {
    if (isScanning) {
      return (
        <div className='d-flex align-items-center gap-2 mb-0'>
          <Spinner animation='border' size='sm' />
          <span>Scanning for missed locations...</span>
        </div>
      );
    }
    if (isPolling) {
      return (
        <div className='d-flex align-items-center gap-2 mb-0'>
          <Spinner animation='border' size='sm' />
          <span>Polling for work...</span>
        </div>
      );
    }
    return <p className='mb-0'>Jobs remaining: {jobsRemaining}</p>;
  }
}
