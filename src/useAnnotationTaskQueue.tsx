import { useEffect, useState, useContext, useCallback, useRef } from 'react';
import { UserContext, ProjectContext, GlobalContext } from './Context';
import {
  ReceiveMessageCommand,
  DeleteMessageCommand,
} from '@aws-sdk/client-sqs';
import type { Schema } from './amplify/client-schema';
import useTesting from './useTesting';
import type {
  AnnotationTaskPayload,
  TaskAcknowledgement,
} from './annotationTypes';
import { fetchAllPaginatedResults, isWithinLocationBounds } from './utils';
import { subscribeToSharedDefaultZoom } from './defaultZoomEvents';

const LOCATION_SELECTION = [
  'id',
  'x',
  'y',
  'width',
  'height',
  'confidence',
  'image.id',
  'image.width',
  'image.height',
  'image.latitude',
  'image.longitude',
  'image.altitude_wgs84',
  'image.altitude_egm96',
  'image.altitude_agl',
] as const;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface AnnotationTaskMessage {
  location: {
    id: string;
    annotationSetId: string;
  };
  skipLocationWithAnnotations?: boolean;
  ack?: TaskAcknowledgement;
  allowOutside?: boolean;
  zoom?: number;
  testPresetId?: string;
  isTest?: boolean;
  queueId?: string;
  taskTag?: string;
}

/*
Owns the annotation-task source: queue selection, optional test insertion,
deduplication, location hydration, skip filtering, visible-time revalidation,
and SQS acknowledgement.
*/
export default function useAnnotationTaskQueue() {
  const { currentPM } = useContext(ProjectContext)!;
  const { getSqsClient, myOrganizationHook } = useContext(UserContext)!;
  const { client } = useContext(GlobalContext)!;
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [backupUrl, setBackupUrl] = useState<string | undefined>(undefined);
  const [zoom, setZoom] = useState<number | undefined>(undefined);
  const [backupZoom, setBackupZoom] = useState<number | undefined>(undefined);
  // Use ref instead of state to prevent fetcher reference churn on every new location
  const processedLocationsRef = useRef<Set<string>>(new Set());

  // user testing state
  const [config, setConfig] = useState<
    Schema['ProjectTestConfig']['type'] | undefined
  >(undefined);
  const [testUser, setTestUser] = useState(false);
  // Ref, not state: concurrent fetcher calls must not both claim the same test.
  const pushTestRef = useRef(false);
  const { fetcher: testFetcher } = useTesting();
  const [maxJobsCompleted, setMaxJobsCompleted] = useState(0);
  const {
    jobsCompleted,
    currentAnnoCount,
    setCurrentAnnoCount,
    unannotatedJobs,
    setUnannotatedJobs,
  } = useContext(UserContext)!;

  // Keep future task fetches on the value saved during this active session.
  useEffect(
    () =>
      subscribeToSharedDefaultZoom((update) => {
        if (update.surveyId === currentPM.projectId) {
          setZoom(update.zoom);
        }
      }),
    [currentPM.projectId]
  );

  // Count consecutive unannotated jobs, and decide when to slip in a test.
  useEffect(() => {
    if (jobsCompleted > maxJobsCompleted) {
      setMaxJobsCompleted(jobsCompleted);

      const userAnnotated = Object.values(currentAnnoCount).some(
        (annotations) => annotations.length > 0
      );

      if (userAnnotated) {
        setUnannotatedJobs(0);
        setCurrentAnnoCount({});
      } else if (
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
        pushTestRef.current = true;
        setUnannotatedJobs(0);
      }
    }
    // This is an edge-triggered transition: process each jobsCompleted value
    // once, using the state captured by that render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobsCompleted]);

  useEffect(() => {
    if (currentPM.queueId) {
      client.models.Queue.get({ id: currentPM.queueId }).then(({ data }) => {
        if (!data) return;
        setUrl(data.url ?? undefined);
        setZoom(data.zoom ?? undefined);
      });
      if (currentPM.backupQueueId) {
        client.models.Queue.get({ id: currentPM.backupQueueId }).then(
          ({ data }) => {
            if (!data) return;
            setBackupUrl(data.url ?? undefined);
            setBackupZoom(data.zoom ?? undefined);
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

    setupTesting();
    // Queue/test configuration is refreshed when the active membership changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPM]);

  const prepareTask = useCallback(
    async (
      message: AnnotationTaskMessage
    ): Promise<AnnotationTaskPayload | null> => {
      const locationId = message.location?.id;
      if (!locationId) return null;

      const { data: location } = await client.models.Location.get(
        { id: locationId },
        { selectionSet: LOCATION_SELECTION }
      );
      if (
        !location?.image ||
        location.width == null ||
        location.height == null
      ) {
        return null;
      }

      const hydratedTask: AnnotationTaskPayload = {
        location: {
          id: location.id,
          x: location.x,
          y: location.y,
          width: location.width,
          height: location.height,
          confidence: location.confidence,
          image: location.image,
          annotationSetId: message.location.annotationSetId,
        },
        ack: message.ack ?? (() => {}),
        allowOutside: message.allowOutside,
        zoom: message.zoom,
        testPresetId: message.testPresetId,
        isTest: message.isTest,
        queueId: message.queueId,
        taskTag: message.taskTag,
      };

      if (!message.skipLocationWithAnnotations) {
        return hydratedTask;
      }

      const allAnnotations = await fetchAllPaginatedResults(
        client.models.Annotation.annotationsByImageIdAndSetId,
        {
          imageId: location.image.id,
          setId: { eq: message.location.annotationSetId },
          selectionSet: ['x', 'y', 'source'] as const,
          limit: 10000,
        }
      );
      const hasAnnotationWithinLocation = allAnnotations
        .filter(
          (annotation) =>
            !annotation.source ||
            !String(annotation.source).includes('false-negative')
        )
        .some((annotation) => isWithinLocationBounds(annotation, location));

      return hasAnnotationWithinLocation ? null : hydratedTask;
    },
    [client]
  );

  const fetcher = useCallback(async (): Promise<AnnotationTaskPayload> => {
    for (;;) {
      // Clear the flag before awaiting so concurrent fetcher calls cannot
      // both claim the same pending test.
      if (testFetcher && pushTestRef.current) {
        pushTestRef.current = false;
        const testLocation = await testFetcher();
        if (testLocation) {
          const preparedTest = await prepareTask(
            testLocation as unknown as AnnotationTaskMessage
          );
          if (preparedTest) return preparedTest;
        }
      }

      if (!url) {
        await sleep(5000);
        continue;
      }

      const sqsClient = await getSqsClient();

      const getResponse = (queueUrl: string) =>
        sqsClient.send(
          new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: 1,
            MessageAttributeNames: ['All'],
            VisibilityTimeout: 600,
          })
        );

      let response = await getResponse(url);
      let usingBackup = false;

      if (!response.Messages && backupUrl) {
        response = await getResponse(backupUrl);
        usingBackup = Boolean(response.Messages);
      }

      if (!response.Messages) {
        await sleep(5000);
        continue;
      }

      const sourceUrl = usingBackup ? backupUrl! : url;
      const entity = response.Messages[0];
      const body = JSON.parse(entity.Body!) as AnnotationTaskMessage;
      body.zoom = usingBackup ? backupZoom : zoom;
      body.ack = async () => {
        try {
          // Re-resolve the client: the ack can fire long after the receive.
          const ackClient = await getSqsClient();
          await ackClient.send(
            new DeleteMessageCommand({
              QueueUrl: sourceUrl,
              ReceiptHandle: entity.ReceiptHandle,
            })
          );
        } catch (error) {
          console.error(
            `Failed to acknowledge location ${body.location.id}`,
            error
          );
        }
      };

      if (
        body.location?.id &&
        processedLocationsRef.current.has(body.location.id)
      ) {
        body.ack();
        // Back off so a run of duplicates cannot spin the loop.
        await sleep(500);
        continue;
      }

      if (body.location?.id) {
        processedLocationsRef.current.add(body.location.id);
      }

      const preparedTask = await prepareTask(body);
      if (!preparedTask) {
        body.ack();
        await sleep(1000);
        continue;
      }

      return {
        ...preparedTask,
        // Last-resort filtering when the buffered task becomes visible.
        revalidate: async () => Boolean(await prepareTask(body)),
      };
    }
  }, [
    url,
    backupUrl,
    getSqsClient,
    testFetcher,
    prepareTask,
    zoom,
    backupZoom,
  ]);

  return { fetcher: url ? fetcher : undefined };
}
