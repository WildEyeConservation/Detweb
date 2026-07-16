import { useCallback, useContext, useState } from 'react';
import { GlobalContext, ImageContext, ProjectContext } from './Context';
import useCreateTestResult from './useCreateTestResult';
import { Schema } from './amplify/client-schema';

/* This hook will take an ack callback as input and create a new ack callback that:
- Uses the graphQL API to create an Observation entry for the current user.
- Calls the old callback

When the task has no persisted location (e.g. viewing a whole image via a
permalink), no Observation is recorded and the original ack is simply invoked.
*/

interface UseCreateObservationProps {
  ack: (submittedAt?: number) => void;
  location?: Schema['Location']['type'];
  isTest?: boolean;
  testPresetId?: string;
  /** The ephemeral set the user's test annotations were written to. */
  testSetId?: string;
  queueId?: string; // Queue ID for incrementing observed count
  /** Optional source tag for the observation (e.g., 'manual-false-negative') */
  observationSource?: string;
}

// Time limits in milliseconds (matching server-side validation)
const MAX_TIME_WITH_ANNOTATIONS = 900 * 1000; // 15 minutes
const MAX_TIME_WITHOUT_ANNOTATIONS = 120 * 1000; // 2 minutes

export default function useCreateObservation(props: UseCreateObservationProps) {
  const {
    location,
    isTest,
    ack,
    testPresetId,
    testSetId,
    queueId,
    observationSource,
  } = props;
  const annotationSetId = location?.annotationSetId;
  const id = location?.id;
  const annotationSetToUse = isTest && testSetId ? testSetId : annotationSetId;
  const {
    annoCount,
    startLoadingTimestamp,
    visibleTimestamp,
    fullyLoadedTimestamp,
  } = useContext(ImageContext)!;
  const { project } = useContext(ProjectContext)!;
  const { client } = useContext(GlobalContext)!;
  const [acked, setAcked] = useState(false);

  const createTestResult = useCreateTestResult({
    locationId: id,
    annotationSetId,
    testSetId: isTest ? testSetId : undefined,
    testPresetId,
  });

  const newAck = useCallback((submittedAt?: number) => {
    // The SQS ack is deliberately delayed after the user pages past (see
    // useAckOnTimeout), so callers pass the timestamp captured at submit time.
    const submittedTimestamp = submittedAt ?? Date.now();
    if (!acked && id && annotationSetId && project) {
      let timeTaken = visibleTimestamp
        ? submittedTimestamp - visibleTimestamp
        : 0;

      // Clamp to the same caps the server enforces. The server zeroes values
      // that exceed the cap, so clamping here keeps the observation counted
      // instead of discarding a long (likely idle) session entirely.
      const hasSighting = annoCount > 0;
      const maxTime = hasSighting ? MAX_TIME_WITH_ANNOTATIONS : MAX_TIME_WITHOUT_ANNOTATIONS;

      if (timeTaken > maxTime) {
        console.warn(
          `Time taken (${timeTaken}ms) exceeds maximum (${maxTime}ms) for ${hasSighting ? 'sighting' : 'search'}. Clamping to the maximum.`
        );
        timeTaken = maxTime;
      }

      client.models.Observation.create({
        annotationSetId: annotationSetToUse,
        annotationCount: annoCount,
        timeTaken,
        // Time the user spent looking at a not-yet-loaded image. With
        // preloading the image usually finishes before it becomes visible,
        // in which case the user waited 0ms (never negative).
        waitingTime:
          visibleTimestamp && fullyLoadedTimestamp
            ? Math.max(0, fullyLoadedTimestamp - visibleTimestamp)
            : 0,
        loadingTime: fullyLoadedTimestamp
          ? fullyLoadedTimestamp - (startLoadingTimestamp ?? 0)
          : 0,
        locationId: id,
        projectId: project.id,
        queueId: queueId || undefined, // Track which queue this observation belongs to
        source: observationSource,
        group: project.organizationId,
      });

      if (queueId) {
        (client as any).mutations.incrementQueueCount({ id: queueId }).catch(
          (err: unknown) => console.error('Failed to increment observedCount', err)
        );
      }

      setAcked(true);
    }

    if (isTest) {
      createTestResult();
    }

    ack(submittedAt);
  }, [
    id,
    annotationSetId,
    annotationSetToUse,
    project,
    acked,
    visibleTimestamp,
    startLoadingTimestamp,
    fullyLoadedTimestamp,
    annoCount,
    isTest,
    createTestResult,
    queueId,
    observationSource,
    client,
    ack,
  ]);

  return newAck;
}
