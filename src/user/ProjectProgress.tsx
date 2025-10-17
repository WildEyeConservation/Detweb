import { useContext, useEffect, useState } from 'react';
import { UserContext, GlobalContext } from '../Context';
import { GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { Spinner, ProgressBar } from 'react-bootstrap';
import { Schema } from '@/types/schema';

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
  const [registering, setRegistering] = useState<boolean>(false);
  const [registrationJob, setRegistrationJob] =
    useState<Schema['RegistrationJob']['type'] | null>(null);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let cancelled = false;

    async function fetchQueueAndStartPolling() {
      setIsLoading(true);
      const projectData = (await client.models.Project.get(
        { id: projectId },
        {
          selectionSet: [
            'queues.url',
            'queues.batchSize',
            'queues.totalBatches',
            'annotationSets.register',
            'registrationJobs.annotationSetId',
            'registrationJobs.categoryNames',
            'registrationJobs.mode',
            'registrationJobs.status',
          ],
        }
      )).data;

      const activeRegistrationJob = projectData.registrationJobs?.find(
        (job: Schema['RegistrationJob']['type']) =>
          job.status !== 'complete' && job.status !== 'cancelled'
      ) as Schema['RegistrationJob']['type'] | undefined;
      setRegistrationJob(activeRegistrationJob ?? null);

      const register =
        projectData.annotationSets.some((set) => set.register) ||
        Boolean(activeRegistrationJob);

      setRegistering(register);
      if (register) {
        setIsLoading(false);
        return;
      }

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
        const attrs = await sqsClient.send(
          new GetQueueAttributesCommand(params)
        );
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

  if (registering && registrationJob) {
    return (
      <div className='d-flex flex-column w-100'>
        <p className='mb-0'>Registration job in progress</p>
        {registrationJob.categoryNames?.length ? (
          <p className='mb-0 text-muted' style={{ fontSize: '12px' }}>
            Species: {registrationJob.categoryNames.join(', ')}
          </p>
        ) : null}
        <p className='mb-0 text-muted' style={{ fontSize: '12px' }}>
          Mode: {registrationJob.mode === 'per-transect' ? 'Per-transect' : 'Single worker'}
        </p>
      </div>
    );
  }

  if (registering) {
    return <p className='mb-0 w-100'>Registration job in progress</p>;
  }

  if (isLoading || !queueInfo) {
    return <Spinner />;
  }

  const { batchSize, totalBatches } = queueInfo;
  if (batchSize > 0) {
    const batchesRemaining = Math.ceil(jobsRemaining / batchSize);
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
    return <p className='mb-0'>Jobs remaining: {jobsRemaining}</p>;
  }
}
