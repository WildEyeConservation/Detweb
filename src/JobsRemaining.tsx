import { useContext, useEffect, useState } from "react";
import { UserContext } from "./Context";



export function JobsRemaining() {
  const { currentQueue, getQueueAttributes, jobsCompleted } =
    useContext(UserContext)!;
  const [jobsRemaining, setJobsRemaining] = useState<string>("Unknown");
  useEffect(() => {
    if (currentQueue) {
      const updateJobs = () =>
        getQueueAttributes({
          QueueUrl: currentQueue,
          AttributeNames: ["ApproximateNumberOfMessages"],
        }).then(({ Attributes: { ApproximateNumberOfMessages: numJobs } }) =>
          setJobsRemaining(numJobs),
        );
      updateJobs();
      const interval = setInterval(updateJobs, 10000);
      return () => {
        clearInterval(interval);
      };
    }
  }, [currentQueue, getQueueAttributes]);
  return (
    <p style={{ textAlign: "center" }}>
      {" "}
      {`Approximate number of jobs remaining (globally): ${jobsRemaining} Approximate number of jobs completed in this session: ${jobsCompleted}`}
    </p>
  );
}
