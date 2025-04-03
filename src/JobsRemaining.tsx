import { useContext, useEffect, useState } from "react";
import {
  ManagementContext,
  ProjectContext,
  UserContext,
  GlobalContext,
} from "./Context";
import {
  PurgeQueueCommand,
  GetQueueAttributesCommand,
} from "@aws-sdk/client-sqs";
import { type GetQueueAttributesCommandInput } from "@aws-sdk/client-sqs";
import ProgressBar from "react-bootstrap/ProgressBar";
import { Badge } from "react-bootstrap";

export function JobsRemaining() {
  const { client } = useContext(GlobalContext)!;
  const { getSqsClient, jobsCompleted: sessionJobsCompleted } =
    useContext(UserContext)!;
  const { currentPM } = useContext(ProjectContext)!;
  const [jobsRemaining, setJobsRemaining] = useState<string>("Unknown");
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [backupUrl, setBackupUrl] = useState<string | undefined>(undefined);
  const [batchSize, setBatchSize] = useState<number>(0);
  const [usingBackupQueue, setUsingBackupQueue] = useState<boolean>(false);

  useEffect(() => {
    if (currentPM.queueId) {
      client.models.Queue.get({ id: currentPM.queueId }).then(
        ({ data: { url, batchSize } }) => {
          setUrl(url);

          if (batchSize) {
            setBatchSize(batchSize);
          }
        }
      );
      if (currentPM.backupQueueId) {
        client.models.Queue.get({ id: currentPM.backupQueueId }).then(
          ({ data: { url } }) => {
            setBackupUrl(url);
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
          AttributeNames: ["ApproximateNumberOfMessages"],
        };
        const sqsClient = await getSqsClient();
        const result = await sqsClient.send(
          new GetQueueAttributesCommand(params)
        );
        return result.Attributes?.ApproximateNumberOfMessages || "Unknown";
      };

      const updateJobs = async () => {
        let jobsR = await getNumberofMessages(url);

        if (jobsR === "0" && backupUrl) {
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

  return jobsRemaining === "0" ||
    batchSize === 0 ||
    parseInt(jobsRemaining) < batchSize ? (
    <Badge
      className="d-flex flex-row align-items-center justify-content-center gap-3 p-2 w-100 bg-secondary"
    >
      <p className="mb-0">
        {jobsRemaining} jobs remaining
        {usingBackupQueue ? " on backup queue " : " "}(globally)
      </p>
      <span>|</span>
      <p className="mb-0">
        {sessionJobsCompleted} jobs completed in this session
      </p>
    </Badge>
  ) : (
    <div className="d-flex flex-column align-items-center gap-2 w-100">
      <ProgressBar
        className="w-100"
        variant="primary"
        max={batchSize}
        now={sessionJobsCompleted % batchSize}
        label={`${
          sessionJobsCompleted % batchSize
        } of ${batchSize} jobs completed`}
      />
      <Badge className="m-0">
        Batches completed this session:{" "}
        {Math.floor(sessionJobsCompleted / batchSize)}
      </Badge>
    </div>
  );
}
