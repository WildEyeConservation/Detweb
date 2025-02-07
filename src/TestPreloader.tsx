import { useContext, useState, useMemo, useEffect, useRef } from 'react';
import { GlobalContext, ProjectContext, UserContext } from './Context';
import useTesting from './TestSource';
import { PreloaderFactory } from './Preloader';
import TestOutcomeModal from './TestOutcomeModal';
import { fetchAllPaginatedResults } from './utils';
import { TaskSelector } from './TaskSelector';

//TODO: get type from schema
type ConfigType = {
    userId: string;
    testType: string | null;
    random: number | null;
    deadzone: number | null;
    interval: number | null;
    postTestConfirmation: boolean | null,
    readonly id: string;
    readonly createdAt: string;
    readonly updatedAt: string;
  };
  
  export default function TestPreloader({visible = true}: {visible: boolean}) {
    const [config, setConfig] = useState<ConfigType | undefined>(undefined);
    const [index, setIndex] = useState(1);
    const [maxJobsCompleted, setMaxJobsCompleted] = useState(0);
    const bufferClone = useRef<{locationId: string, annotationSetId: string, testPresetId: string}[]>([]);
    const currentLocation = useRef<{locationId: string, annotationSetId: string, testPresetId: string} | null>(null);
    const previousLocation = useRef<{locationId: string, annotationSetId: string, testPresetId: string} | null>(null);
  
    const { modalToShow, showModal, client } = useContext(GlobalContext)!;
    const { currentPM } = useContext(ProjectContext)!;
    //testing
    const { jobsCompleted, setJobsCompleted, currentAnnoCount, setCurrentAnnoCount, unannotatedJobs, setUnannotatedJobs, isTesting, setIsTesting, isRegistering } = useContext(UserContext)!;

    const { fetcher, fetchedLocation } = useTesting();
  
    const Preloader = useMemo(() => PreloaderFactory(TaskSelector), []);
  
    useEffect(() => {
      async function setup() {
          const {data: [config]} = await client.models.UserTestConfig.testConfigByUserId({ userId: currentPM.userId });
          
          if (config?.id) {
              setConfig(config);
          }
      }
      
      setup();
  }, []);

  useEffect(() => {
    if (fetchedLocation) {
        bufferClone.current.push(fetchedLocation);
    }
  }, [fetchedLocation]);

  // Combined useEffect handling both index/fetcher and jobsCompleted
  useEffect(() => {
    // Function to validate the test based on jobsCompleted
    async function validateTest() {
      if (isTesting && previousLocation.current) {
        // Reset testing states
        setIsTesting(false);
        setUnannotatedJobs(0);
        setCurrentAnnoCount({});
        setJobsCompleted((j) => j - 1); // Tests are not counted as jobs

        const loc = previousLocation.current;

        // Fetch necessary data
        const categoryCounts = await fetchAllPaginatedResults(
          client.models.LocationAnnotationCount.categoryCountsByLocationIdAndAnnotationSetId,
          {
            locationId: loc.locationId,
            annotationSetId: { eq: loc.annotationSetId },
            selectionSet: ['categoryId', 'count'],
          }
        );

        const { data: testPreset } = await client.models.TestPreset.get({
          id: loc.testPresetId,
          selectionSet: ['accuracy'],
        });

        const categories = await fetchAllPaginatedResults(
          client.models.TestPresetCategory.categoriesByTestPresetId,
          {
            testPresetId: loc.testPresetId,
            selectionSet: ['categoryId'],
          }
        );

        // Filter user annotations based on test preset categories
        const filteredUserAnnotations = Object.entries(currentAnnoCount).filter(
          ([categoryId]) => categories.some((c) => c.categoryId === categoryId)
        );

        const totalUserCounts = filteredUserAnnotations.reduce((acc, [_, count]) => acc + count, 0);
        const totalTestCounts = categoryCounts
          .filter((count) => categories.some((c) => c.categoryId === count.categoryId))
          .reduce((acc, count) => acc + (count.count as number), 0);

        const missedAnimals = totalTestCounts - totalUserCounts;

        // Calculate Undercounted and Overcounted Animals
        const undercountedAnimals = missedAnimals > 0 ? missedAnimals : 0;
        const overcountedAnimals = missedAnimals < 0 ? Math.abs(missedAnimals) : 0;

        // Adjusted Total Animals for Accuracy Calculation
        const adjustedTotalAnimals = totalTestCounts + overcountedAnimals;

        // Calculate Annotation Accuracy
        const annotationAccuracy =
          adjustedTotalAnimals > 0
            ? ((totalTestCounts - undercountedAnimals) / adjustedTotalAnimals) * 100
            : 0;

        // Determine if the user passed based on required accuracy
        const requiredAccuracy = testPreset?.accuracy ?? 0;
        const passed = annotationAccuracy >= requiredAccuracy;

        // Record Test Result
        const { data: testResult } = await client.models.TestResult.create({
          userId: currentPM.userId,
          testPresetId: loc.testPresetId,
          locationId: loc.locationId,
          annotationSetId: loc.annotationSetId,
          testAnimals: totalTestCounts,
          totalMissedAnimals: missedAnimals,
          passed: passed,
        });

        // Track count of animals missed vs animals in tests, by category
        for (const [categoryId, count] of filteredUserAnnotations) {
          const categoryCount = categoryCounts.find((c) => c.categoryId === categoryId)?.count as number;
          await client.models.TestResultCategoryCount.create({
            testResultId: testResult!.id,
            categoryId: categoryId,
            userCount: count,
            testCount: categoryCount,
          });
        }

          // Show appropriate modal based on pass/fail
          if (config?.postTestConfirmation) {
            if (passed) {
              showModal('testPassedModal');
            } else {
              showModal('testFailedModal');
            }
          }
          
          return;
        }
    
        // This only counts unannotated jobs when continuing to the next job from the 'newest' (maxJobsCompleted) job.
        // If a user went back to a previous job, and annotated it, it would have no effect on the unannotatedJobs count.
        if (jobsCompleted > maxJobsCompleted) {
          setMaxJobsCompleted(jobsCompleted);

        if (Object.values(currentAnnoCount).reduce((acc, count) => acc + count, 0) > 0) {
          setUnannotatedJobs(0);
        } else {
          setUnannotatedJobs((j) => j + 1);
        }
      }

      setCurrentAnnoCount({});
    }

    validateTest();

    // Handle index and fetcher updates
    if (fetcher && bufferClone.current.length > 0) {
      // Store the current location before updating
      previousLocation.current = currentLocation.current;
      currentLocation.current = bufferClone.current[index];
      console.log('currentLocation updated to', currentLocation.current);
    }
  }, [index, fetcher, jobsCompleted]);
  
    useEffect(() => {
      if (isRegistering || !fetcher || !config ||
        config.testType === 'none' || 
        config.testType === 'interval' && unannotatedJobs < config.interval! || 
        config.testType === 'random' && Math.random() >= (config.random! / 100) || 
        config.testType === 'random' && jobsCompleted <= config.deadzone!) {
          setIsTesting(false);
          return;
      }
  
      setIsTesting(true);
    }, [unannotatedJobs]);
  
    return (
      <>
      {fetcher &&
        <Preloader 
          index={index} 
          setIndex={setIndex} 
          fetcher={fetcher}
          visible={visible}
          preloadN={2} 
          historyN={1} 
        />
        }
        <TestOutcomeModal 
          show={
            modalToShow === 'testFailedModal' || 
            modalToShow === 'testPassedModal'
          } 
          onClose={() => {showModal(null)}} 
        />
      </>
    )
  }