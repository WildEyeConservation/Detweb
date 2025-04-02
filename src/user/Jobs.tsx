import { Card } from "react-bootstrap";
import { useContext, useEffect, useState } from "react";
import { UserContext, GlobalContext } from "../Context";
import { Schema } from "../../amplify/data/resource";
import { Spinner, Button } from "react-bootstrap";
import MyTable from "../Table";
import { useNavigate } from "react-router-dom";
import { type GetQueueAttributesCommandInput } from "@aws-sdk/client-sqs";
import { GetQueueAttributesCommand } from "@aws-sdk/client-sqs";

type Project = {
  id: string;
  name: string;
  organization: {
    id: string;
    name: string;
  };
  queues: Schema["Queue"]["type"][];
  hidden: boolean;
};

export default function Jobs() {
  const {
    myMembershipHook: userProjectMembershipHook,
    myOrganizationHook,
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
              "id",
              "name",
              "organization.id",
              "organization.name",
              "queues.*",
              "hidden",
            ],
          }
        )
      );

      const projectResults = await Promise.all(projectPromises);
      const validProjects = projectResults
        .map((result) => (result as { data: Project | null }).data)
        .filter(
          (project): project is Project =>
            project !== null && project.queues.length > 0 && !project.hidden
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

      setProjects(validProjects);
      setDisplayProjects(validProjects);
      setIsLoading(false);

      async function getJobsRemaining() {
        if (cancelled) return;

        const queueUrls = validProjects.flatMap((project) =>
          project.queues.map((queue) => queue.url || "")
        );

        const jobsRemaining = (
          await Promise.all(
            queueUrls.map(async (queueUrl) => {
              const params: GetQueueAttributesCommandInput = {
                QueueUrl: queueUrl,
                AttributeNames: ["ApproximateNumberOfMessages"],
              };
              const sqsClient = await getSqsClient();
              const result = await sqsClient.send(
                new GetQueueAttributesCommand(params)
              );
              return {
                [queueUrl]:
                  result.Attributes?.ApproximateNumberOfMessages || "Unknown",
              };
            })
          )
        ).reduce((acc, curr) => ({ ...acc, ...curr }), {});

        if (cancelled) return;

        setJobsRemaining(jobsRemaining);

        const filteredProjects = validProjects
          .map((project) => ({
            ...project,
            queues: project.queues.filter(
              (queue) => jobsRemaining[queue.url || ""] !== "0"
            ),
          }))
          .filter((project) => project.queues.length > 0);
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
            alert("Failed to take job");
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
            alert("Failed to take job");
            console.error(error);
          },
        }
      );
    }

    setTakingJob(false);
  }

  const tableData = displayProjects.flatMap((project) =>
    project.queues.map((queue) => ({
      id: queue.id,
      rowData: [
        <div
          className="d-flex justify-content-between align-items-center p-2"
          key={queue.id}
        >
          <div className="d-flex flex-row gap-3 align-items-center">
            <div>
              <h5 className="mb-0">{project.name}</h5>
              <i style={{ fontSize: "14px", display: "block" }}>
                {project.organization.name}
              </i>
              <p
                style={{
                  fontSize: "14px",
                  display: "block",
                  marginBottom: "0px",
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
                  className="badge bg-secondary"
                  style={{ fontSize: "14px" }}
                >
                  Hidden
                </span>
              )}
          </div>
          <div className="d-flex flex-row gap-3 align-items-center">
            {queue.batchSize && queue.batchSize > 0 ? (
              <p className="mb-0">
                Batches remaining:{" "}
                {Math.ceil(Number(jobsRemaining[queue.url || ""] || 0) / queue.batchSize)}
              </p>
            ) : (
              <p className="mb-0">
                Jobs remaining: {jobsRemaining[queue.url || ""] || "Unknown"}
              </p>
            )}
            <Button
              variant="primary"
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
        width: "100%",
        maxWidth: "1555px",
        marginTop: "16px",
        marginBottom: "16px",
      }}
    >
      <Card>
        <Card.Header>
          <Card.Title className="mb-0">
            <h4 className="mb-0">Jobs Available</h4>
          </Card.Title>
        </Card.Header>
        <Card.Body>
          {isLoading ? (
            <Spinner />
          ) : (
            <MyTable
              tableData={tableData}
              pagination={true}
              itemsPerPage={5}
              emptyMessage="No jobs available"
            />
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
