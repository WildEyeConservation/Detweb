import { useState, useEffect, useContext } from "react";
import { getQueuesInProject } from "./gqlQueries";
import { UserContext } from "./UserContext";
import { gqlClient, graphqlOperation } from "./App";
import { createQueue } from "./graphql/mutations";

interface Queue {
  name: string;
  url: string;
}

interface UseQueuesByProjectReturn {
  queues: Queue[];
  createQueue: (name: string) => Promise<any>;
}

export function useQueuesByProject(projectName: string): UseQueuesByProjectReturn {
  const [queues, setQueues] = useState<Queue[]>([]);
  const { createQueue: createQueueInContext, gqlGetMany } = useContext(UserContext)!;

  useEffect(() => {
    if (projectName) {
      gqlGetMany(getQueuesInProject, { name: projectName }).then((qs: Queue[]) =>
        setQueues(qs),
      );
    }
  }, [projectName, gqlGetMany]);

  async function createQueueAndPushToDb(name: string) {
    const { QueueUrl: url } = await createQueueInContext({
      QueueName: name + ".fifo", // required
      Attributes: {
        FifoQueue: "true",
      },
    });
    const res = await gqlClient.graphql(
      graphqlOperation(createQueue, {
        input: { name, url, projectId: projectName },
      }),
    );
    await gqlGetMany(getQueuesInProject, { name: projectName }).then((qs: Queue[]) =>
      setQueues(qs),
    );
    return res;
  }

  return { queues, createQueue: createQueueAndPushToDb };
}
