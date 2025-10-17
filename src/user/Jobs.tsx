import { Card } from 'react-bootstrap';
import { useContext, useEffect, useState, useCallback } from 'react';
import { UserContext, GlobalContext } from '../Context';
import { Schema } from '../amplify/client-schema';
import { Spinner, Button, ProgressBar } from 'react-bootstrap';
import MyTable from '../Table';
import { useNavigate } from 'react-router-dom';
import { type GetQueueAttributesCommandInput } from '@aws-sdk/client-sqs';
import { GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import ConfirmationModal from '../ConfirmationModal';
import ProjectProgress from './ProjectProgress';

type RegistrationJob = Schema['RegistrationJob']['type'] & {
  annotationSet?: {
    id: string;
    name: string;
  } | null;
};

type Project = {
  id: string;
  name: string;
  organization: {
    id: string;
    name: string;
  };
  annotationSets: {
    id: string;
    name: string;
  }[];
  queues: Schema['Queue']['type'][];
  registrationJobs: RegistrationJob[];
};

type RegistrationJobWithProject = RegistrationJob & {
  project: {
    id: string;
    name: string;
    organization: {
      id: string;
      name: string;
    };
  };
};

export default function Jobs() {
  const {
    myMembershipHook: userProjectMembershipHook,
    myOrganizationHook,
    user,
    getSqsClient,
  } = useContext(UserContext)!;
  const { client, showModal, modalToShow } = useContext(GlobalContext)!;
  const navigate = useNavigate();

  const [displayProjects, setDisplayProjects] = useState<Project[]>([]);
  const [jobsRemaining, setJobsRemaining] = useState<Record<string, string>>(
    {}
  );
  const [registrationJobs, setRegistrationJobs] = useState<RegistrationJobWithProject[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [takingJob, setTakingJob] = useState(false);
  const [jobToDelete, setJobToDelete] = useState<
    Schema['Queue']['type'] | null
  >(null);
  const [deletingJob, setDeletingJob] = useState(false);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let cancelled = false; // cancellation flag

    async function fetchProjectsAndJobs() {
      if (!userProjectMembershipHook.data) return;
      setIsLoading(true);

      const projectPromises = userProjectMembershipHook.data.map((membership) =>
        client.models.Project.get(
          { id: membership.projectId },
          {
            selectionSet: [
              'id',
              'name',
              'organization.id',
              'organization.name',
              'annotationSets.id',
              'annotationSets.name',
              'queues.*',
              'registrationJobs.annotationSetId',
              'registrationJobs.categoryIds',
              'registrationJobs.categoryNames',
              'registrationJobs.mode',
              'registrationJobs.status',
              'registrationJobs.assignedUserId',
              'registrationJobs.annotationSet.id',
              'registrationJobs.annotationSet.name',
            ],
          }
        )
      );

      const projectResults = await Promise.all(projectPromises);
      const validProjects = projectResults
        .map((result) => (result as { data: Project | null }).data)
        .filter(
          (project): project is Project => project !== null
        )
        .map((project) => ({
          ...project,
          queues: project.queues.filter(
            (queue) =>
              myOrganizationHook.data?.find(
                (membership) =>
                  membership.organizationId === project.organization.id
              )?.isAdmin || !queue.hidden
          ),
        }));

      if (cancelled) return; // stop if unmounted

      setDisplayProjects(validProjects);
      setIsLoading(false);

      async function getJobsRemaining() {
        if (cancelled) return;

        const queueUrls = validProjects.flatMap((project) =>
          project.queues.map((queue) => queue.url || '')
        );

        const jobsRemaining = (
          await Promise.all(
            queueUrls.map(async (queueUrl) => {
              if (!queueUrl) return { [queueUrl]: '0' };
              const params: GetQueueAttributesCommandInput = {
                QueueUrl: queueUrl,
                AttributeNames: ['ApproximateNumberOfMessages'],
              };
              const sqsClient = await getSqsClient();
              const result = await sqsClient.send(
                new GetQueueAttributesCommand(params)
              );
              return {
                [queueUrl]:
                  result.Attributes?.ApproximateNumberOfMessages || 'Unknown',
              };
            })
          )
        ).reduce((acc, curr) => ({ ...acc, ...curr }), {});

        if (cancelled) return;

        setJobsRemaining(jobsRemaining);

        const allRegistrationJobs = validProjects.flatMap((project) =>
          project.registrationJobs
            .filter((job) => job.status !== 'complete')
            .map((job) => ({
              ...job,
              project: {
                id: project.id,
                name: project.name,
                organization: project.organization,
              },
            }))
        );
        setRegistrationJobs(allRegistrationJobs);

        const filteredProjects = validProjects.filter(
          (project) =>
            project.queues.length > 0 || project.registrationJobs.length > 0
        );
        setDisplayProjects(filteredProjects);
      }

      // Kick off the first polling call immediately
      getJobsRemaining();

      // Immediately set up the interval (if still mounted)
      if (!cancelled) {
        interval = setInterval(getJobsRemaining, 10000);
      }
    }

    fetchProjectsAndJobs();

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userProjectMembershipHook.data]);

  async function handleTakeRegistrationJob(job: RegistrationJobWithProject) {
    setTakingJob(true);
    try {
      if (job.mode === 'per-transect') {
        const assignment = await claimTransectAssignment({
          registrationJobId: job.annotationSetId,
          userId: user.userId,
        });
        if (!assignment) {
          alert('No available transects right now. Please try again.');
          return;
        }
        navigate(
          `/surveys/${job.project.id}/set/${job.annotationSetId}/registration?transect=${assignment.transectId}`
        );
        return;
      }

      // single assignment mode: reserve the job for the user
      await client.models.RegistrationJob.update({
        annotationSetId: job.annotationSetId,
        assignedUserId: user.userId,
        lastHeartbeatAt: new Date().toISOString(),
        status: 'active',
      });

      navigate(
        `/surveys/${job.project.id}/set/${job.annotationSetId}/registration`
      );
    } finally {
      setTakingJob(false);
    }
  }

  async function handleTakeJob(job: { queueId: string; projectId: string }) {
    setTakingJob(true);
    try {
      const currentMembership = userProjectMembershipHook.data?.find(
        (membership) => membership.projectId === job.projectId
      );

      if (currentMembership) {
        await userProjectMembershipHook.update(
          { id: currentMembership.id, queueId: job.queueId },
          {
            onSuccess: () => {
              navigate(`/surveys/${job.projectId}/annotate`);
            },
            onError: (error) => {
              alert('Failed to take job');
              console.error(error);
            },
          }
        );
      } else {
        await userProjectMembershipHook.create(
          { userId: user.userId, projectId: job.projectId, queueId: job.queueId },
          {
            onSuccess: () => {
              navigate(`/surveys/${job.projectId}/annotate`);
            },
            onError: (error) => {
              alert('Failed to take job');
              console.error(error);
            },
          }
        );
      }
    } finally {
      setTakingJob(false);
    }
  }

  async function claimTransectAssignment({
    registrationJobId,
    userId,
  }: {
    registrationJobId: string;
    userId: string;
  }) {
    const { data } = await client.models.RegistrationAssignment.registrationAssignmentsByJobId(
      {
        registrationJobId,
        limit: 200,
      }
    );

    const now = Date.now();
    const staleCutoff = now - 1000 * 60 * 30;

    for (const assignment of data) {
      const lastHeartbeat = assignment.lastHeartbeatAt
        ? new Date(assignment.lastHeartbeatAt).getTime()
        : 0;
      if (
        !assignment.assignedUserId ||
        lastHeartbeat < staleCutoff ||
        assignment.assignedUserId === userId
      ) {
        await client.models.RegistrationAssignment.update({
          registrationJobId,
          transectId: assignment.transectId,
          assignedUserId: userId,
          lastHeartbeatAt: new Date().toISOString(),
          status: 'active',
        });
        return assignment;
      }
    }

    return null;
  }

  const tableData = [
    ...displayProjects.flatMap((project) =>
      project.queues
        .map((queue) => {
          const numJobsRemaining = Number(jobsRemaining[queue.url || ''] || 0);
          const batchesRemaining = Math.ceil(
            numJobsRemaining / (queue.batchSize || 0)
          );

          if (
            numJobsRemaining === 0 &&
            !userProjectMembershipHook.data?.find(
              (membership) => membership.projectId === project.id
            )?.isAdmin
          ) {
            return null;
          }

          return {
            id: queue.id,
            rowData: [
              <div
                className='d-flex justify-content-between align-items-center p-2'
                key={queue.id}
              >
                <div className='d-flex flex-row gap-3 align-items-center'>
                  <div>
                    <h5 className='mb-0'>{queue.tag || project.name}</h5>
                    <i style={{ fontSize: '14px', display: 'block' }}>
                      {project.organization.name}
                    </i>
                    <p
                      style={{
                        fontSize: '14px',
                        display: 'block',
                        marginBottom: '0px',
                      }}
                    >
                      Type: {queue.name}
                    </p>
                  </div>
                  {myOrganizationHook.data?.find(
                    (membership) =>
                      membership.organizationId === project.organization.id
                  )?.isAdmin &&
                    queue.hidden && (
                      <span
                        className='badge bg-secondary'
                        style={{ fontSize: '14px' }}
                      >
                        Hidden
                      </span>
                    )}
                </div>
                <div
                  className='d-flex flex-row gap-2 align-items-center'
                  style={{ maxWidth: '600px', width: '100%' }}
                >
                  <ProjectProgress projectId={project.id} />
                  <Button
                    className='ms-1'
                    variant='primary'
                    disabled={
                      takingJob || deletingJob || numJobsRemaining === 0
                    }
                    onClick={() =>
                      handleTakeJob({
                        queueId: queue.id,
                        projectId: project.id,
                      })
                    }
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    Take Job
                  </Button>
                </div>
              </div>,
            ],
          };
        })
        .filter((item) => item !== null)
    ),
    ...registrationJobs.map((job) => {
      const transectMode = job.mode === 'per-transect';
      return {
        id: `${job.annotationSetId}-${job.project.id}`,
        rowData: [
          <div
            className='d-flex justify-content-between align-items-center p-2'
            key={job.annotationSetId}
          >
            <div className='d-flex flex-row gap-3 align-items-center'>
              <div>
                <h5 className='mb-0'>
                  {job.annotationSet?.name || 'Registration Job'}
                </h5>
                <i style={{ fontSize: '14px', display: 'block' }}>
                  {job.project.name} • {job.project.organization.name}
                </i>
                <p
                  style={{
                    fontSize: '14px',
                    display: 'block',
                    marginBottom: '0px',
                  }}
                >
                  Mode: {transectMode ? 'Per-transect' : 'Single Worker'}
                </p>
                {job.categoryNames?.length ? (
                  <p
                    className='mb-0 text-muted'
                    style={{ fontSize: '12px' }}
                  >
                    Species: {job.categoryNames.join(', ')}
                  </p>
                ) : null}
              </div>
            </div>
            <Button
              className='ms-1'
              variant='primary'
              disabled={takingJob || deletingJob}
              onClick={() => handleTakeRegistrationJob(job)}
            >
              Take Job
            </Button>
          </div>,
        ],
      };
    }),
  ];

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1555px',
        marginTop: '16px',
        marginBottom: '16px',
      }}
    >
      <Card>
        <Card.Header>
          <Card.Title className='mb-0'>
            <h4 className='mb-0'>Jobs Available</h4>
          </Card.Title>
        </Card.Header>
        <Card.Body className='overflow-x-auto'>
          {isLoading ? (
            <Spinner />
          ) : (
            <MyTable
              tableData={tableData}
              pagination={true}
              itemsPerPage={5}
              emptyMessage='No jobs available'
            />
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
