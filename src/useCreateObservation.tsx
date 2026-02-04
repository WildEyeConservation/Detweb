import React, { useCallback, useContext, memo, useState } from 'react';
import { UserContext, ProjectContext, GlobalContext } from './Context';
import { UseAckOnTimeoutProps } from './useAckOnTimeout';
import { BaseImageProps } from './BaseImage';
import { ImageContext } from './Context';
import { fetchAllPaginatedResults } from './utils';
import { Schema } from './amplify/client-schema';

/* This hook will take an ack callback as input and create a new ack callback that:
- Uses the graphQL API to create an Observation entry for the current user.
- Calls the old callback
*/

interface UseCreateObservationProps {
  ack: () => void;
  location?: Schema['Location']['type'];
  annotationSet: Schema['AnnotationSet']['type'];
  isTest: boolean;
  config?: Schema['ProjectTestConfig']['type'];
  testPresetId?: string;
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
    location: { annotationSetId, id },
    isTest,
    ack,
    // Do not use config for pass/fail here anymore; keep prop for compatibility
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    config: _config,
    testPresetId,
    testSetId,
    queueId,
    observationSource,
  } = props;
  const annotationSetToUse = isTest && testSetId ? testSetId : annotationSetId;
  const {
    annoCount,
    startLoadingTimestamp,
    visibleTimestamp,
    fullyLoadedTimestamp,
  } = useContext(ImageContext)!;
  const { project, categoriesHook, currentPM } = useContext(ProjectContext)!;
  const { client } = useContext(GlobalContext)!;
  const [acked, setAcked] = useState(false);
  const {
    currentAnnoCount,
    setCurrentAnnoCount,
    sessionTestsResults,
    setSessionTestsResults,
  } = useContext(UserContext)!;

  async function createTestResult() {
    //check if the user already completed this test (in the case where the user accidentally skips over the animal and navigates back to the test)
    const existingTestResult = sessionTestsResults.find(
      (result) =>
        result.locationId === id &&
        result.annotationSetId === annotationSetToUse
    );

    const userAnnotations = Object.entries(currentAnnoCount).filter(
      ([, annotations]) => annotations.length > 0
    );

    setCurrentAnnoCount({});

    const surveyCategories = categoriesHook.data?.reduce(
      (acc, c) => ({ ...acc, [c.id]: c.name.toLowerCase() }),
      {} as Record<string, string>
    );

    const { data: location } = await client.models.Location.get({
      id: id,
      selectionSet: ['x', 'y', 'width', 'height'],
    });

    if (!location) {
      console.error('No location found');
      return;
    }

    // Fetch counts per category for the test location
    const categoryCounts = await fetchAllPaginatedResults(
      client.models.LocationAnnotationCount
        .categoryCountsByLocationIdAndAnnotationSetId,
      {
        locationId: id,
        annotationSetId: { eq: annotationSetId },
        selectionSet: ['categoryId', 'category.name', 'count'],
      }
    );

    if (!categoryCounts) {
      console.error('No category counts found');
      return;
    }

    const boundsxy: [number, number][] = [
      [location!.x - location!.width / 2, location!.y - location!.height / 2],
      [location!.x + location!.width / 2, location!.y + location!.height / 2],
    ];

    // Filter annotations to those within the test location and count them per category
    const annotationCounts: { [key: string]: number } = {};
    for (const [categoryId, annotations] of userAnnotations) {
      for (const annotation of annotations) {
        const isWithin =
          annotation.x >= boundsxy[0][0] &&
          annotation.y >= boundsxy[0][1] &&
          annotation.x <= boundsxy[1][0] &&
          annotation.y <= boundsxy[1][1];

        if (isWithin) {
          annotationCounts[surveyCategories[categoryId]] =
            (annotationCounts[surveyCategories[categoryId]] || 0) + 1;
        }
      }
    }

    const userAnnotationsEntries = Object.entries(annotationCounts);

    // Total count of annotations
    const totalUserCounts = userAnnotationsEntries.reduce(
      (acc, [, count]) => acc + count,
      0
    );
    const totalTestCounts = categoryCounts.reduce(
      (acc, count) => acc + (count.count as number),
      0
    );

    let testResult: Schema['TestResult']['type'];
    if (existingTestResult) {
      //update the test result
      const { data: updatedTestResult } = await client.models.TestResult.update(
        {
          id: existingTestResult.id,
          testAnimals: totalTestCounts,
          totalMissedAnimals: totalTestCounts - totalUserCounts,
          // Placeholder to satisfy current schema; not used for reporting
          passedOnTotal: false,
        }
      );
      testResult = updatedTestResult;
    } else {
      const { data: newTestResult } = await client.models.TestResult.create({
        userId: currentPM.userId,
        projectId: project.id,
        testPresetId: testPresetId!,
        locationId: id,
        annotationSetId: annotationSetId,
        testAnimals: totalTestCounts,
        totalMissedAnimals: totalTestCounts - totalUserCounts,
        // Placeholder to satisfy current schema; not used for reporting
        passedOnTotal: false,
      });
      testResult = newTestResult;
    }

    if (!testResult) {
      console.error('Failed to create TestResult');
      return;
    }

    // Track count of animals missed vs animals in tests, by category
    if (userAnnotationsEntries.length > 0) {
      for (const [categoryName, count] of userAnnotationsEntries) {
        const category = categoryCounts.find(
          (c) => c.category.name.toLowerCase() === categoryName
        );

        if (!category) {
          console.error('Category not found', categoryName);
          continue;
        }

        if (existingTestResult) {
          //update the test result category count
          await client.models.TestResultCategoryCount.update({
            testResultId: existingTestResult.id,
            categoryName: categoryName,
            userCount: count,
            testCount: category.count || 0,
          });
        } else {
          await client.models.TestResultCategoryCount.create({
            testResultId: testResult.id,
            categoryName: categoryName,
            userCount: count,
            testCount: category.count || 0,
          });
        }
      }
    } else {
      // User missed all animals; create entries with userCount = 0
      for (const categoryCount of categoryCounts) {
        if (existingTestResult) {
          //update the test result category count
          await client.models.TestResultCategoryCount.update({
            testResultId: existingTestResult.id,
            categoryName: categoryCount.category.name,
            userCount: 0,
            testCount: categoryCount.count || 0,
          });
        } else {
          await client.models.TestResultCategoryCount.create({
            testResultId: testResult.id,
            categoryName: categoryCount.category.name,
            userCount: 0,
            testCount: categoryCount.count || 0,
          });
        }
      }
    }

    if (!existingTestResult) {
      setSessionTestsResults((prev) => [
        ...prev,
        {
          id: testResult.id,
          locationId: id,
          annotationSetId: annotationSetToUse,
        },
      ]);
    }
  }

  const newAck = useCallback(() => {
    //FIXME: This is a hack. it relies on the fact that we know the current system delays submissions by 2s, but if the timeout changes
    //or is removed, this will generate incorrect results.
    const submittedTimestamp = Date.now() - 2000;
    if (!acked && location && annotationSetId && project) {
      // Calculate time taken
      let timeTaken = submittedTimestamp ? submittedTimestamp - visibleTimestamp : 0;

      // Apply client-side time validation (matching server-side logic)
      const hasSighting = annoCount > 0;
      const maxTime = hasSighting ? MAX_TIME_WITH_ANNOTATIONS : MAX_TIME_WITHOUT_ANNOTATIONS;

      if (timeTaken > maxTime) {
        console.warn(
          `Time taken (${timeTaken}ms) exceeds maximum (${maxTime}ms) for ${hasSighting ? 'sighting' : 'search'}. Setting to 0.`
        );
        timeTaken = 0;
      }

      client.models.Observation.create({
        annotationSetId: annotationSetToUse,
        annotationCount: annoCount,
        timeTaken,
        waitingTime: startLoadingTimestamp
          ? fullyLoadedTimestamp - visibleTimestamp
          : 0,
        loadingTime: fullyLoadedTimestamp
          ? fullyLoadedTimestamp - startLoadingTimestamp
          : 0,
        locationId: id,
        projectId: project.id,
        queueId: queueId || undefined, // Track which queue this observation belongs to
        source: observationSource,
      });

      setAcked(true);
    }

    if (isTest) {
      createTestResult();
    }

    ack();
  }, [
    location,
    project,
    acked,
    visibleTimestamp,
    startLoadingTimestamp,
    fullyLoadedTimestamp,
    annoCount,
    isTest,
    testSetId,
    queueId,
    observationSource,
  ]);

  return newAck;
}

export interface WithCreateObservationProps extends UseCreateObservationProps {
  observationSource?: string;
  [key: string]: any;
}

interface CombinedProps
  extends WithCreateObservationProps,
  UseAckOnTimeoutProps,
  BaseImageProps { }

export function withCreateObservation<T extends CombinedProps>(
  WrappedComponent: React.ComponentType<T>
) {
  const WithCreateObservation: React.FC<T> = (props) => {
    const { location, ack, isTest, config, testPresetId, testSetId, observationSource, queueId, annotationSet } = props;
    const newAck = location.id
      ? useCreateObservation({
        location,
        ack,
        isTest,
        config,
        testPresetId,
        testSetId,
        queueId, // Pass queueId for observation counter increment
        annotationSet,
        observationSource,
      })
      : ack;
    return (
      <WrappedComponent {...props} location={{ ...location, ack: newAck }} />
    );
  };
  return memo(WithCreateObservation);
}
