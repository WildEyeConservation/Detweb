import { useContext, useState, useMemo, useEffect, useRef } from "react";
import { GlobalContext, ProjectContext, UserContext } from "./Context";
import useTesting from "./TestSource";
import { PreloaderFactory } from "./Preloader";
import TestOutcomeModal from "./TestOutcomeModal";
import { fetchAllPaginatedResults } from "./utils";
import { TaskSelector } from "./TaskSelector";
import { Schema } from "../amplify/data/resource";

export default function TestPreloader({
  visible = true,
}: {
  visible: boolean;
}) {
  const [config, setConfig] = useState<
    Schema["ProjectTestConfig"]["type"] | undefined
  >(undefined);
  const [index, setIndex] = useState(1);
  const [maxJobsCompleted, setMaxJobsCompleted] = useState(0);
  const [testUser, setTestUser] = useState(false);
  const bufferClone = useRef<
    { locationId: string; annotationSetId: string; testPresetId: string }[]
  >([]);
  const currentLocation = useRef<{
    locationId: string;
    annotationSetId: string;
    testPresetId: string;
  } | null>(null);
  const previousLocation = useRef<{
    locationId: string;
    annotationSetId: string;
    testPresetId: string;
  } | null>(null);

  const { modalToShow, showModal, client } = useContext(GlobalContext)!;
  const { currentPM, project, categoriesHook } = useContext(ProjectContext)!;
  //testing
  const {
    jobsCompleted,
    setJobsCompleted,
    currentAnnoCount,
    setCurrentAnnoCount,
    unannotatedJobs,
    setUnannotatedJobs,
    isTesting,
    setIsTesting,
    isRegistering,
    myOrganizationHook,
  } = useContext(UserContext)!;

  const { fetcher, fetchedLocation } = useTesting();

  const Preloader = useMemo(() => PreloaderFactory(TaskSelector), []);

  useEffect(() => {
    async function setup() {
      const { data: config } = await client.models.ProjectTestConfig.get(
        {
          projectId: project.id,
        },
        {
          selectionSet: [
            "projectId",
            "project.organizationId",
            "postTestConfirmation",
            "testType",
            "random",
            "deadzone",
            "interval",
            "accuracy",
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
      const userAnnotations = Object.entries(currentAnnoCount).filter(
        ([_, annotations]) => annotations.length > 0
      );
      const surveyCategories = categoriesHook.data?.reduce(
        (acc, c) => ({ ...acc, [c.id]: c.name.toLowerCase() }),
        {} as Record<string, string>
      );

      if (isTesting && previousLocation.current) {
        // Reset testing states
        setIsTesting(false);
        setUnannotatedJobs(0);
        setCurrentAnnoCount({});
        setJobsCompleted((j) => j - 1); // Tests are not counted as jobs

        const loc = previousLocation.current;

        const { data: location } = await client.models.Location.get({
          id: loc.locationId,
          selectionSet: ["x", "y", "width", "height"],
        });

        // Fetch counts per category for the test location
        const categoryCounts = await fetchAllPaginatedResults(
          client.models.LocationAnnotationCount
            .categoryCountsByLocationIdAndAnnotationSetId,
          {
            locationId: loc.locationId,
            annotationSetId: { eq: loc.annotationSetId },
            selectionSet: ["categoryId", "category.name", "count"],
          }
        );

        const boundsxy: [number, number][] = [
          [
            location!.x - location!.width / 2,
            location!.y - location!.height / 2,
          ],
          [
            location!.x + location!.width / 2,
            location!.y + location!.height / 2,
          ],
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
          testPresetId: loc.testPresetId,
          locationId: loc.locationId,
          annotationSetId: loc.annotationSetId,
          testAnimals: totalTestCounts,
          totalMissedAnimals: totalTestCounts - totalUserCounts,
          passedOnTotal: passedOnTotal,
        });

        if (!testResult) {
          console.error("Failed to create TestResult");
          return;
        }

        // Track count of animals missed vs animals in tests, by category
        if (userAnnotationsEntries.length > 0) {
          for (const [categoryName, count] of userAnnotationsEntries) {
            const category = categoryCounts.find(
              (c) => c.category.name.toLowerCase() === categoryName
            );

            if (!category) {
              console.error("Category not found", categoryName);
              continue;
            }

            await client.models.TestResultCategoryCount.create({
              testResultId: testResult.id,
              categoryName: categoryName,
              userCount: count,
              testCount: category.count || 0,
            });
          }
        } else {
          // User missed all animals; create entries with userCount = 0
          for (const categoryCount of categoryCounts) {
            await client.models.TestResultCategoryCount.create({
              testResultId: testResult.id,
              categoryName: categoryCount.category.name,
              userCount: 0,
              testCount: categoryCount.count || 0,
            });
          }
        }

        // Show appropriate modal based on pass/fail
        if (config?.postTestConfirmation) {
          if (passedOnTotal) {
            showModal("testPassedModal");
          } else {
            showModal("testFailedModal");
          }
        }

        return;
      }

      // This only counts unannotated jobs when continuing to the next job from the 'newest' (maxJobsCompleted) job.
      // If a user went back to a previous job, and annotated it, it would have no effect on the unannotatedJobs count.
      if (jobsCompleted > maxJobsCompleted) {
        setMaxJobsCompleted(jobsCompleted);

        if (
          userAnnotations.reduce(
            (acc, annotations) => acc + annotations[1].length,
            0
          ) > 0
        ) {
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
      console.log("currentLocation updated to", currentLocation.current);
    }
  }, [index, fetcher, jobsCompleted]);

  useEffect(() => {
    if (
      isRegistering ||
      !fetcher ||
      !config ||
      !testUser ||
      config.testType === "none" ||
      (config.testType === "interval" && unannotatedJobs < config.interval!) ||
      (config.testType === "random" && Math.random() >= config.random! / 100) ||
      (config.testType === "random" && jobsCompleted <= config.deadzone!)
    ) {
      setIsTesting(false);
      return;
    }

    setIsTesting(true);
  }, [unannotatedJobs]);

  return (
    <>
      {fetcher && (
        <Preloader
          index={index}
          setIndex={setIndex}
          fetcher={fetcher}
          visible={visible}
          preloadN={2}
          historyN={1}
        />
      )}
      <TestOutcomeModal
        show={
          modalToShow === "testFailedModal" || modalToShow === "testPassedModal"
        }
        onClose={() => {
          showModal(null);
        }}
      />
    </>
  );
}
