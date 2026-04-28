import { useContext, useEffect, useState } from 'react';
import { ProjectContext, UserContext, GlobalContext } from './Context';
import { GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { type GetQueueAttributesCommandInput } from '@aws-sdk/client-sqs';
import ProgressBar from 'react-bootstrap/ProgressBar';
import { useNavigate } from 'react-router-dom';

export function JobsRemaining() {
  const { client } = useContext(GlobalContext)!;
  const {
    getSqsClient,
    jobsCompleted: sessionJobsCompleted,
    setJobsCompleted: setSessionJobsCompleted,
  } = useContext(UserContext)!;
  const { currentPM } = useContext(ProjectContext)!;
  const [jobsRemaining, setJobsRemaining] = useState<string>('Unknown');
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [backupUrl, setBackupUrl] = useState<string | undefined>(undefined);
  const [batchSize, setBatchSize] = useState<number>(0);
  const [usingBackupQueue, setUsingBackupQueue] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (currentPM.queueId) {
      client.models.Queue.get({ id: currentPM.queueId }).then(
        ({ data }) => {
          if (!data) return;
          setUrl(data.url ?? undefined);
          if (data.batchSize) {
            setBatchSize(data.batchSize);
          }
        }
      );
      if (currentPM.backupQueueId) {
        client.models.Queue.get({ id: currentPM.backupQueueId }).then(
          ({ data }) => {
            setBackupUrl(data?.url ?? undefined);
          }
        );
      }
    }
  }, [currentPM]);

  useEffect(() => {
    if (url) {
      const getNumberofMessages = async (url: string) => {
        const params: GetQueueAttributesCommandInput = {
          QueueUrl: url,
          AttributeNames: ['ApproximateNumberOfMessages'],
        };
        const sqsClient = await getSqsClient();
        const result = await sqsClient.send(
          new GetQueueAttributesCommand(params)
        );
        return result.Attributes?.ApproximateNumberOfMessages || 'Unknown';
      };

      const updateJobs = async () => {
        let jobsR = await getNumberofMessages(url);

        if (jobsR === '0' && backupUrl) {
          jobsR = await getNumberofMessages(backupUrl);
          setUsingBackupQueue(true);
        } else {
          setUsingBackupQueue(false);
        }

        setJobsRemaining(jobsR);
      };

      updateJobs();

      const interval = setInterval(updateJobs, 10000);
      return () => {
        clearInterval(interval);
      };
    }
  }, [url, backupUrl, getSqsClient]);

  useEffect(() => {
    if (
      batchSize > 0 &&
      sessionJobsCompleted > 0 &&
      sessionJobsCompleted % batchSize === 0
    ) {
      alert('Well done! You have completed a batch of jobs.');
      setSessionJobsCompleted(0);
      navigate('/jobs');
    }
  }, [sessionJobsCompleted, batchSize, navigate, setSessionJobsCompleted]);

  const completedInBatch = sessionJobsCompleted % batchSize;

  if (
    jobsRemaining === '0' ||
    batchSize === 0 ||
    parseInt(jobsRemaining) < batchSize
  ) {
    return (
      <div
        className='d-flex flex-row align-items-center justify-content-center gap-3 w-100 flex-wrap'
        style={{
          background: 'var(--ss-surface)',
          border: '1.5px solid var(--ss-border)',
          borderRadius: 10,
          padding: '10px 16px',
          boxShadow: '0 1px 2px rgba(28, 28, 26, 0.03)',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        <span>
          <strong style={{ color: 'var(--ss-text)', fontWeight: 700 }}>
            {jobsRemaining}
          </strong>{' '}
          <span style={{ color: 'var(--ss-text-muted)' }}>
            jobs remaining
            {usingBackupQueue ? ' on backup queue ' : ' '}(globally)
          </span>
        </span>
        <span
          className='d-none d-sm-inline'
          style={{ color: 'var(--ss-border-strong)' }}
        >
          |
        </span>
        <span>
          <strong style={{ color: 'var(--ss-text)', fontWeight: 700 }}>
            {sessionJobsCompleted}
          </strong>{' '}
          <span style={{ color: 'var(--ss-text-muted)' }}>
            jobs completed in this session
          </span>
        </span>
      </div>
    );
  }

  const pct = Math.round((completedInBatch / batchSize) * 100);

  return (
    <div
      className='w-100 d-flex flex-row align-items-center gap-3'
      style={{
        background: 'var(--ss-surface)',
        border: '1.5px solid var(--ss-border)',
        borderRadius: 10,
        padding: '10px 16px',
        boxShadow: '0 1px 2px rgba(28, 28, 26, 0.03)',
      }}
    >
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--ss-text-muted)',
          whiteSpace: 'nowrap',
        }}
      >
        Batch progress
      </div>
      <div className='flex-grow-1' style={{ minWidth: 0 }}>
        <ProgressBar
          className='ss-job-progress-bar w-100'
          variant='primary'
          max={batchSize}
          now={completedInBatch}
          style={{
            height: 10,
            borderRadius: 999,
            background: 'var(--ss-border)',
            overflow: 'hidden',
          }}
        />
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--ss-text)',
          whiteSpace: 'nowrap',
          minWidth: 90,
          textAlign: 'right',
        }}
      >
        {completedInBatch} / {batchSize}{' '}
        <span style={{ color: 'var(--ss-text-muted)' }}>({pct}%)</span>
      </div>
    </div>
  );
}
