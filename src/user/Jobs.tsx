import { Card } from 'react-bootstrap';
import { useContext, useEffect, useState } from 'react';
import { UserContext, GlobalContext } from '../Context';
import { Schema } from '../../amplify/data/resource';
import { Spinner, Button } from 'react-bootstrap';
import MyTable from '../Table';
import { useNavigate } from 'react-router-dom';
import { type GetQueueAttributesCommandInput } from '@aws-sdk/client-sqs';
import { GetQueueAttributesCommand } from '@aws-sdk/client-sqs';

type Project = {
  id: string;
  name: string;
  organization: {
    name: string;
  };
  queues: Schema['Queue']['type'][];
};

export default function Jobs() {
  const {
    myMembershipHook: userProjectMembershipHook,
    user,
    getSqsClient,
  } = useContext(UserContext)!;
  const { client } = useContext(GlobalContext)!;
  const navigate = useNavigate();

  const [projects, setProjects] = useState<Project[]>([]);
  const [displayProjects, setDisplayProjects] = useState<Project[]>([]);
  const [jobsRemaining, setJobsRemaining] = useState<Record<string, string>>(
    {}
  );
  const [isLoading, setIsLoading] = useState(false);
  const [takingJob, setTakingJob] = useState(false);

  useEffect(() => {
    async function getProjects() {
      if (userProjectMembershipHook.data) {
        setProjects([]);

        setIsLoading(true);
        const projectPromises = userProjectMembershipHook.data.map(
          (membership) =>
            client.models.Project.get(
              {
                id: membership.projectId,
              },
              {
                selectionSet: ['id', 'name', 'organization.name', 'queues.*'],
              }
            )
        );

        const projectResults = await Promise.all(projectPromises);
        const validProjects = projectResults
          .map((result) => (result as { data: Project | null }).data)
          .filter(
            (project): project is Project =>
              project !== null && project.queues.length > 0
          );

        setProjects(validProjects);
        setDisplayProjects(validProjects);
        setIsLoading(false);
      }
    }

    getProjects();
  }, [userProjectMembershipHook.data]);

  async function handleTakeJob(job: { queueId: string; projectId: string }) {
    setTakingJob(true);

    const currentMembership = userProjectMembershipHook.data.filter(
      (membership) => membership.projectId === job.projectId
    )[0];

    if (currentMembership) {
      userProjectMembershipHook.update(
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
      userProjectMembershipHook.create(
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

    setTakingJob(false);
  }

  useEffect(() => {
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

    const getJobsRemaining = async () => {
      const queueUrls = projects.flatMap((project) =>
        project.queues.map((queue) => queue.url || '')
      );

      const jobsRemaining = (
        await Promise.all(
          queueUrls.map(async (queueUrl) => {
            return {
              [queueUrl]: await getNumberofMessages(queueUrl),
            };
          })
        )
      ).reduce((acc, curr) => ({ ...acc, ...curr }), {});
      setJobsRemaining(jobsRemaining);

      // filter out queues that are hidden or have no jobs remaining
      const filteredProjects = projects.map(project => ({
        ...project,
        queues: project.queues.filter(queue => jobsRemaining[queue.url || ''] !== '0' && !queue.hidden)
      })).filter(project => project.queues.length > 0);
      setDisplayProjects(filteredProjects);
    };

    getJobsRemaining();

    const interval = setInterval(getJobsRemaining, 10000);
    return () => {
      clearInterval(interval);
    };
  }, [projects]);

  const tableData = displayProjects.flatMap((project) =>
    project.queues.map((queue) => ({
      id: queue.id,
      rowData: [
        <div
          className="d-flex justify-content-between align-items-center p-2"
          key={queue.id}
        >
          <div>
            <h5 className="mb-0">{project.name}</h5>
            <i style={{ fontSize: '14px', display: 'block' }}>
              {project.organization.name}
            </i>
            <p style={{ fontSize: '14px', display: 'block', marginBottom: '0px' }}>
              Job: {queue.name}
            </p>
          </div>
          <div className="d-flex flex-row gap-3 align-items-center">
            {queue.batchSize && queue.batchSize > 0 ? (
              <p className="mb-0">
                Batches remaining:{' '}
                {Number(jobsRemaining[queue.url || ''] || 0) / queue.batchSize}
              </p>
            ) : (
              <p className="mb-0">
                Jobs remaining: {jobsRemaining[queue.url || ''] || 'Unknown'}
              </p>
            )}
            <Button
              variant="info"
              disabled={takingJob}
              onClick={() =>
                handleTakeJob({ queueId: queue.id, projectId: project.id })
              }
            >
              Take Job
            </Button>
          </div>
        </div>,
      ],
    }))
  );

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1280px',
        marginTop: '16px',
        marginBottom: '16px',
      }}
    >
      <Card>
        <Card.Body>
          <Card.Title>
            <h4 className="mb-3">Jobs Available</h4>
          </Card.Title>
          {isLoading ? (
            <Spinner />
          ) : projects.length > 0 ? (
            <MyTable
              tableData={tableData}
              pagination={true}
              itemsPerPage={5}
              emptyMessage="No jobs available"
            />
          ) : (
            <p>No jobs available</p>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}


// export default function Jobs() {
//   return <div>Jobs</div>;
// }

