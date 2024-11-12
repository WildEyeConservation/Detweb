import { useContext, useEffect, useState } from "react";
import { ProjectContext, UserContext } from "./Context";
import { PurgeQueueCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs'
import { type GetQueueAttributesCommandInput } from '@aws-sdk/client-sqs'

export function JobsRemaining() {
  const { getSqsClient, jobsCompleted } = useContext(UserContext)!;
  const { currentPM } = useContext(ProjectContext)!;
  const [jobsRemaining, setJobsRemaining] = useState<string>("Unknown");
  const [url, setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (currentPM.queueId) {
      currentPM.queue().then(
          ({ data: { url } }) => {
          setUrl(url);
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
  return (
    <p style={{ textAlign: "center" }}>
      {" "}
      {`Approximate number of jobs remaining (globally): ${jobsRemaining} Approximate number of jobs completed in this session: ${jobsCompleted}`}
    </p>
  );
}
