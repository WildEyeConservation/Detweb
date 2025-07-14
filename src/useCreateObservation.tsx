import React, { useCallback, useContext, memo, useState } from 'react';
import { UserContext, ProjectContext, GlobalContext } from './Context';
import { UseAckOnTimeoutProps } from './useAckOnTimeout';
import { BaseImageProps } from './BaseImage';
import { ImageContext } from './Context';
import { fetchAllPaginatedResults } from './utils';
import { Schema } from '../amplify/data/resource';

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
}

export default function useCreateObservation(props: UseCreateObservationProps) {
  const {
    location: { annotationSetId, id },
    isTest,
    ack,
    config,
    testPresetId,
  } = props;
  const {
    annoCount,
    startLoadingTimestamp,
    visibleTimestamp,
    fullyLoadedTimestamp,
  } = useContext(ImageContext)!;
  const { project, categoriesHook, currentPM } = useContext(ProjectContext)!;
  const { client } = useContext(GlobalContext)!;
  const [acked, setAcked] = useState(false);
  const { currentAnnoCount, setCurrentAnnoCount } = useContext(UserContext)!;

  async function createTestResult() {
    const userAnnotations = Object.entries(currentAnnoCount).filter(
      ([_, annotations]) => annotations.length > 0
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
      (acc, [_, count]) => acc + count,
      0
    );
    const totalTestCounts = categoryCounts.reduce(
      (acc, count) => acc + (count.count as number),
      0
    );

    const requiredAccuracy = config?.accuracy ?? 0;

    // Total count of annotations regardless of category
    const allUserCounts = Object.values(annotationCounts).reduce(
      (acc, count) => acc + count,
      0
    );
    const passedOnTotal =
      allUserCounts >= totalTestCounts * (requiredAccuracy / 100) &&
      allUserCounts <= totalTestCounts * (2 - requiredAccuracy / 100);

    const { data: testResult } = await client.models.TestResult.create({
      userId: currentPM.userId,
      projectId: project.id,
      testPresetId: testPresetId!,
      locationId: id,
      annotationSetId: annotationSetId,
      testAnimals: totalTestCounts,
      totalMissedAnimals: totalTestCounts - totalUserCounts,
      passedOnTotal: passedOnTotal,
    });

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

        const { data: createdCategoryCount } = await client.models.TestResultCategoryCount.create({
          testResultId: testResult.id,
          categoryName: categoryName,
          userCount: count,
          testCount: category.count || 0,
        });
      }
    } else {
      // User missed all animals; create entries with userCount = 0
      for (const categoryCount of categoryCounts) {
        const { data: createdCategoryCount } = await client.models.TestResultCategoryCount.create({
          testResultId: testResult.id,
          categoryName: categoryCount.category.name,
          userCount: 0,
          testCount: categoryCount.count || 0,
        });
      }
    }
  }

  const newAck = useCallback(() => {
    //FIXME: This is a hack. it relies on the fact that we know the current system delays submissions by 2s, but if the timeout changes
    //or is removed, this will generate incorrect results.
    const submittedTimestamp = Date.now() - 2000;
    if (!acked && location && annotationSetId && project) {
      client.models.Observation.create({
        annotationSetId: annotationSetId,
        annotationCount: annoCount,
        timeTaken: submittedTimestamp
          ? submittedTimestamp - visibleTimestamp
          : 0,
        waitingTime: startLoadingTimestamp
          ? fullyLoadedTimestamp - visibleTimestamp
          : 0,
        loadingTime: fullyLoadedTimestamp
          ? fullyLoadedTimestamp - startLoadingTimestamp
          : 0,
        locationId: id,
        projectId: project.id,
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
  ]);

  return newAck;
}

export interface WithCreateObservationProps extends UseCreateObservationProps {
  [key: string]: any;
}

interface CombinedProps
  extends WithCreateObservationProps,
    UseAckOnTimeoutProps,
    BaseImageProps {}

export function withCreateObservation<T extends CombinedProps>(
  WrappedComponent: React.ComponentType<T>
) {
  const WithCreateObservation: React.FC<T> = (props) => {
    const { location, ack, isTest, config, testPresetId } = props;
    const newAck = location.id
      ? useCreateObservation({ location, ack, isTest, config, testPresetId })
      : ack;
    return (
      <WrappedComponent {...props} location={{ ...location, ack: newAck }} />
    );
  };
  return memo(WithCreateObservation);
}
