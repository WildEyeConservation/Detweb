import { useEffect, useState, useContext, useCallback } from 'react';
import { UserContext, ProjectContext, GlobalContext } from './Context';
import {
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import { Schema } from '../amplify/data/resource';
import useTesting from './TestSource';

export default function useSQS(
  filterPredicate: (message: any) => Promise<boolean> = async () => {
    return true;
  },
  allowTesting: boolean = false
) {
  const { currentPM } = useContext(ProjectContext)!;
  const { getSqsClient, myOrganizationHook } = useContext(UserContext)!;
  const { client } = useContext(GlobalContext)!;
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [backupUrl, setBackupUrl] = useState<string | undefined>(undefined);
  const [zoom, setZoom] = useState<number | undefined>(undefined);
  const [backupZoom, setBackupZoom] = useState<number | undefined>(undefined);
  const [processedLocations, setProcessedLocations] = useState<Set<string>>(
    new Set()
  );

  // user testing state
  const [config, setConfig] = useState<
    Schema['ProjectTestConfig']['type'] | undefined
  >(undefined);
  const [testUser, setTestUser] = useState(false);
  const [pushTest, setPushTest] = useState(false);
  const { fetcher: testFetcher } = useTesting();
  const [maxJobsCompleted, setMaxJobsCompleted] = useState(0);
  const {
    jobsCompleted,
    currentAnnoCount,
    setCurrentAnnoCount,
    unannotatedJobs,
    setUnannotatedJobs,
    isRegistering,
  } = useContext(UserContext)!;


  // Track unannotated jobs
  useEffect(() => {
    const userAnnotations = Object.entries(currentAnnoCount).filter(
      ([_, annotations]) => annotations.length > 0
    );

    if (jobsCompleted > maxJobsCompleted) {
      setMaxJobsCompleted(jobsCompleted);

      if (
        userAnnotations.reduce(
          (acc, annotations) => acc + annotations[1].length,
          0
        ) > 0
      ) {
        setUnannotatedJobs(0);
        setCurrentAnnoCount({});
      } else if (
        isRegistering ||
        !testFetcher ||
        !config ||
        !testUser ||
        config.testType === 'none' ||
        (config.testType === 'interval' &&
          unannotatedJobs < config.interval!) ||
        (config.testType === 'random' &&
          Math.random() >= config.random! / 100) ||
        (config.testType === 'random' && jobsCompleted <= config.deadzone!)
      ) {
        setUnannotatedJobs((j) => j + 1);
        setCurrentAnnoCount({});
      } else {
        setPushTest(true);
        setUnannotatedJobs(0);
      }
    }
  }, [jobsCompleted]);

  useEffect(() => {
    if (currentPM.queueId) {
      client.models.Queue.get({ id: currentPM.queueId }).then(
        ({ data: { url, zoom } }) => {
          setUrl(url);
          setZoom(zoom);
        }
      );
      if (currentPM.backupQueueId) {
        client.models.Queue.get({ id: currentPM.backupQueueId }).then(
          ({ data: { url, zoom } }) => {
            setBackupUrl(url);
            setBackupZoom(zoom);
          }
        );
      }
    }

    async function setupTesting() {
      const { data: config } = await client.models.ProjectTestConfig.get(
        {
          projectId: currentPM.projectId,
        },
        {
          selectionSet: [
            'projectId',
            'project.organizationId',
            'postTestConfirmation',
            'testType',
            'random',
            'deadzone',
            'interval',
            'accuracy',
          ],
        }
      );

      if (config?.projectId) {
        setConfig(config);

        const shouldTest =
          myOrganizationHook.data?.find(
            (membership) =>
              membership.organizationId === config.project.organizationId
          )?.isTested ?? false;
        setTestUser(shouldTest);
      }
    }

    if (allowTesting) {
      setupTesting();
    }
  }, [currentPM]);

  const fetcher = useCallback(async (): Promise<Identifiable> => {
    while (true) {
      if (testFetcher && pushTest) {
        const testLocation = await testFetcher();
        if (testLocation) {
          setPushTest(false);
          return {
            ...testLocation,
            config: config,
          };
        }
      }

      if (!url) {
        console.log('No queue URL set');
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }

      const sqsClient = await getSqsClient();

      const getResponse = async (url: string) => {
        const response = await sqsClient.send(
          new ReceiveMessageCommand({
            QueueUrl: url,
            MaxNumberOfMessages: 1,
            MessageAttributeNames: ['All'],
            VisibilityTimeout: 600,
          })
        );

        return response;
      };

      let usingBackup = false;
      let response = await getResponse(url);

      if (!response.Messages && backupUrl) {
        console.log('No message from main queue, checking backup queue');
        response = await getResponse(backupUrl);

        if (response.Messages) {
          usingBackup = true;
        }
      }

      // Messages from either queue
      if (response.Messages) {
        const entity = response.Messages[0];
        const body = JSON.parse(entity.Body!);
        body.message_id = crypto.randomUUID();
        body.zoom = usingBackup ? backupZoom : zoom;

        // Check if we've already processed this location
        if (body.location?.id && processedLocations.has(body.location.id)) {
          console.log(`Skipping duplicate location ${body.location.id}`);
          body.ack = async () => {
            try {
              const sqsClient = await getSqsClient();
              await sqsClient.send(
                new DeleteMessageCommand({
                  QueueUrl: usingBackup ? backupUrl : url,
                  ReceiptHandle: entity.ReceiptHandle,
                })
              );
            } catch {
              console.log(
                `Ack Failed for location ${body.location.id} with receipthandle ${entity.ReceiptHandle}`
              );
            }
          };
          body.ack();
          continue;
        }

        // Add the location ID to processed locations if it exists
        if (body.location?.id) {
          console.log(
            `Adding new location ${body.location.id} to processed locations`
          );
          setProcessedLocations((prev) => {
            const newSet = new Set(prev);
            newSet.add(body.location.id);
            return newSet;
          });
        }

        body.ack = async () => {
          try {
            const sqsClient = await getSqsClient();
            await sqsClient.send(
              new DeleteMessageCommand({
                QueueUrl: usingBackup ? backupUrl : url,
                ReceiptHandle: entity.ReceiptHandle,
              })
            );
          } catch {
            console.log(
              `Ack Failed for location ${body.location.id} with receipthandle ${entity.ReceiptHandle}`
            );
          }
        };
        if (await filterPredicate(body)) {
          return body;
        } else {
          body.ack();
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }
  }, [
    url,
    backupUrl,
    getSqsClient,
    filterPredicate,
    processedLocations,
    pushTest,
    testFetcher,
  ]);

  return { fetcher: url ? fetcher : undefined };
}
