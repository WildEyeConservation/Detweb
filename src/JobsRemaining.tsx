import { useContext, useEffect, useState } from "react";
import { ManagementContext, ProjectContext, UserContext } from "./Context";
import { PurgeQueueCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs'
import { type GetQueueAttributesCommandInput } from '@aws-sdk/client-sqs'
import ProgressBar from 'react-bootstrap/ProgressBar';

export function JobsRemaining() {
  const { getSqsClient, jobsCompleted: sessionJobsCompleted } = useContext(UserContext)!;
  const { currentPM } = useContext(ProjectContext)!;
  const [jobsCompleted, setJobsCompleted] = useState<number>(0);
  const [jobsRemaining, setJobsRemaining] = useState<string>("Unknown");
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [batchSize, setBatchSize] = useState<number>(0);

  useEffect(() => {
    if (currentPM.queueId) {
      currentPM.queue().then(
          ({ data: { url, batchSize } }) => {
          setUrl(url);
          setBatchSize(batchSize || 0);

          const j = sessionJobsCompleted % batchSize;
          setJobsCompleted(j);
        });
    }
  }, [currentPM]);

  useEffect(() => {
    if (url) {
      const updateJobs = async () =>{
        const params: GetQueueAttributesCommandInput = {
        QueueUrl: url,
        AttributeNames: ['ApproximateNumberOfMessages'],
        };
        const sqsClient = await getSqsClient();
        const result = await sqsClient.send(new GetQueueAttributesCommand(params));
        setJobsRemaining(result.Attributes?.ApproximateNumberOfMessages || "Unknown");
      }
      updateJobs();
      const interval = setInterval(updateJobs, 10000);
      return () => {
        clearInterval(interval);
      };
    }
  }, [url, getSqsClient]);

  useEffect(() => {
    function handleJobsCompleted() {
      if (batchSize && jobsCompleted === batchSize - 1 || jobsRemaining === "0") {   
        const batchNumber = Math.floor(sessionJobsCompleted / batchSize);
        alert(`You've completed ${batchNumber} batch${batchNumber > 1 ? "es" : ""}!`);
        setJobsCompleted(0);
        return;
      }

      setJobsCompleted((j) => j + 1);
    }

    handleJobsCompleted();
  }, [sessionJobsCompleted]);

  return (
      batchSize === 0 ?
        <div style={{textAlign: "center", flexDirection: "column", width: "100%"}}>
          <p style={{marginBottom: "4px"}}>
            Approximate number of jobs remaining (globally): {jobsRemaining}
          </p>
          <p>Approximate number of jobs completed in this session: {sessionJobsCompleted}</p>
        </div>
      :
          <ProgressBar 
            striped 
            variant="info" 
            max={batchSize} 
            now={jobsCompleted} 
            label={`${jobsCompleted} / ${batchSize}`} 
            className="mt-2 w-75"
          />
  );
}
