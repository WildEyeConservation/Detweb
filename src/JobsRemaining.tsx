import { useContext, useEffect, useState } from "react";
import { ManagementContext, ProjectContext, UserContext } from "./Context";
import { PurgeQueueCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs'
import { type GetQueueAttributesCommandInput } from '@aws-sdk/client-sqs'
import ProgressBar from 'react-bootstrap/ProgressBar';

export function JobsRemaining() {
  const { getSqsClient, jobsCompleted: sessionJobsCompleted } = useContext(UserContext)!;
  const { currentPM } = useContext(ProjectContext)!;
  const [jobsRemaining, setJobsRemaining] = useState<string>("Unknown");
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [backupUrl, setBackupUrl] = useState<string | undefined>(undefined);
  const [batchSize, setBatchSize] = useState<number>(0);
  const [usingBackupQueue, setUsingBackupQueue] = useState<boolean>(false);

  useEffect(() => {
    if (currentPM.queueId) {
      currentPM.queue().then(
          ({ data: { url, batchSize } }) => {
          setUrl(url);

          if (batchSize) {
            setBatchSize(batchSize);
          }
        });
        if (currentPM.backupQueueId) {
          currentPM.backupQueue().then(
            ({ data: { url } }) => {
              setBackupUrl(url);
            });
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
        const result = await sqsClient.send(new GetQueueAttributesCommand(params));
        return result.Attributes?.ApproximateNumberOfMessages || "Unknown";
      }

      const updateJobs = async () => {
        let jobsR = await getNumberofMessages(url);

        if (jobsR === "0" && backupUrl) {
          jobsR = await getNumberofMessages(backupUrl);
          setUsingBackupQueue(true);
        } else {
          setUsingBackupQueue(false);
        }
        
        setJobsRemaining(jobsR);
      }

      updateJobs();
      
      const interval = setInterval(updateJobs, 10000);
      return () => {
        clearInterval(interval);
      };
    }
  }, [url, backupUrl, getSqsClient]);

  return (
      jobsRemaining === "0" || batchSize === 0 ?
        <div style={{textAlign: "center", flexDirection: "column", width: "100%"}}>
          <p style={{marginBottom: "4px"}}>
            Approximate number of jobs remaining{usingBackupQueue ? " on backup queue " : " "}(globally): {jobsRemaining}
          </p>
          <p style={{marginBottom: "0px"}}>Approximate number of jobs completed in this session: {sessionJobsCompleted}</p>
        </div>
      :
        <div style={{textAlign: "center", flexDirection: "column", width: "80%", marginTop: "10px"}}>
          <ProgressBar 
            striped 
            variant="info" 
            max={batchSize} 
            now={sessionJobsCompleted % batchSize} 
            label={`${sessionJobsCompleted % batchSize} / ${batchSize}`} 
          />
          <p style={{marginTop: "10px"}}>Batches completed: {Math.floor(sessionJobsCompleted / batchSize)}</p>
        </div>
  );
}
