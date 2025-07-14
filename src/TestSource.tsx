import { useContext, useCallback, useState, useEffect, useRef } from "react";
import { ProjectContext, GlobalContext, UserContext } from "./Context";
import { fetchAllPaginatedResults } from "./utils";
import { QueryCommand } from "@aws-sdk/client-dynamodb";

export default function useTesting(useSecondaryCandidates: boolean = false) {
  const { currentPM, project, categoriesHook } = useContext(ProjectContext)!;
  const { client, backend } = useContext(GlobalContext)!;
  const { getDynamoClient } = useContext(UserContext)!;

  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState<number | undefined>(undefined);
  const [hasPrimaryCandidates, setHasPrimaryCandidates] = useState(false);
  const [hasSecondaryCandidates, setHasSecondaryCandidates] = useState(false);
  const [loading, setLoading] = useState(true);

  const primaryCandidates = useRef<
    { locationId: string; annotationSetId: string; testPresetId: string }[]
  >([]);
  const secondaryCandidates = useRef<string[]>([]);
  const currentLocation = useRef<{
    locationId: string;
    annotationSetId: string;
    testPresetId: string;
  } | null>(null);

  useEffect(() => {
    async function setup() {
      setLoading(true);

      if (currentPM.queueId) {
        client.models.Queue.get({ id: currentPM.queueId }).then(
          ({ data: { zoom } }) => {
            setZoom(zoom);
          }
        );
      }

      const { data: config } = await client.models.ProjectTestConfig.get({
        projectId: project.id,
      });

      if (!config) {
        return;
      }

      const presets = await fetchAllPaginatedResults(
        client.models.TestPresetProject.testPresetsByProjectId,
        {
          projectId: project.id,
          selectionSet: ["testPresetId"],
        }
      );

      fetchPrimaryLocations(presets);

      setLoading(false);
    }

    setup();
  }, [currentPM]);

  async function executeQueryAndPushResults<T>(
    command: QueryCommand
  ): Promise<T[]> {
    const dynamoClient = await getDynamoClient();
    let lastEvaluatedKey: any;
    const resultsArray: T[] = [];

    do {
      command.input.ExclusiveStartKey = lastEvaluatedKey;

      try {
        const response = await dynamoClient.send(command);
        if (response.Items) {
          resultsArray.push(...(response.Items as T[]));
        }
        lastEvaluatedKey = response.LastEvaluatedKey;
      } catch (error) {
        console.error("Error querying DynamoDB:", error);
        throw error;
      }
    } while (lastEvaluatedKey);

    return resultsArray;
  }

  async function fetchPrimaryLocations(presets: { testPresetId: string }[]) {
    const testedLocations = await fetchAllPaginatedResults(
      client.models.TestResult.testResultsByUserId,
      {
        userId: currentPM.userId,
        selectionSet: [
          "locationId",
          "createdAt",
          "testPresetId",
          "annotationSetId",
        ] as const,
      }
    );

    const seenLocations = testedLocations
      .filter(
        (l) =>
          l !== null && presets.some((p) => p.testPresetId === l.testPresetId)
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
      .filter(
        (location, index, self) =>
          index === self.findIndex((t) => t.locationId === location.locationId)
      )
      .reverse();

    const testLocations = [];
    for (const preset of presets) {
      const locations = await fetchAllPaginatedResults(
        client.models.TestPresetLocation.locationsByTestPresetId,
        {
          testPresetId: preset.testPresetId,
          selectionSet: ["locationId", "createdAt", "annotationSetId"] as const,
        }
      );

      testLocations.push(
        ...locations.map((l) => ({
          locationId: l.locationId,
          createdAt: l.createdAt,
          annotationSetId: l.annotationSetId,
          testPresetId: preset.testPresetId,
        }))
      );
    }

    // newest test locations, that have not yet been seen, are first up in the array
    const locations = testLocations
      .filter(
        (l) =>
          l !== null &&
          !seenLocations.some((sl) => sl.locationId === l.locationId)
      )
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );

    // add seen locations to the end of the array as backup
    for (const seenLocation of seenLocations) {
      locations.push({
        locationId: seenLocation.locationId,
        createdAt: seenLocation.createdAt,
        annotationSetId: seenLocation.annotationSetId,
        testPresetId: seenLocation.testPresetId,
      });
    }

    primaryCandidates.current = locations.map((l) => ({
      locationId: l.locationId,
      annotationSetId: l.annotationSetId,
      testPresetId: l.testPresetId,
    }));

    if (primaryCandidates.current.length > 3) {
      setHasPrimaryCandidates(true);
    }

    // aim to have at least 100 candidates (not handled by test preloader for now)
    if (useSecondaryCandidates && primaryCandidates.current.length < 100) {
      fetchSecondaryLocations(100 - primaryCandidates.current.length);
    }
  }

  // Not handled by test preloader for now
  async function fetchSecondaryLocations(amount: number) {
    const locationSets = await fetchAllPaginatedResults(
      client.models.LocationSet.locationSetsByProjectId,
      {
        projectId: currentPM.projectId,
        selectionSet: ["id"] as const,
      }
    );

    for (const set of locationSets) {
      const locationsQuery = new QueryCommand({
        TableName: backend.custom.locationTable,
        IndexName: "locationsBySetIdAndConfidence",
        KeyConditionExpression: "setId = :locationSetId",
        ExpressionAttributeValues: {
          ":locationSetId": {
            S: set.id,
          },
        },
        ProjectionExpression: "id",
        Limit: 1000,
      });

      const locations = await executeQueryAndPushResults(locationsQuery);

      for (const location of locations) {
        const observationsQuery = new QueryCommand({
          TableName: backend.custom.observationTable,
          IndexName: "observationsByLocationId",
          KeyConditionExpression: "locationId = :locationId",
          ExpressionAttributeValues: {
            ":locationId": {
              S: location.id.S!,
            },
          },
          ProjectionExpression: "id, #owner, createdAt, annotationCount",
          ExpressionAttributeNames: {
            "#owner": "owner",
          },
          Limit: 1000,
        });

        const observations = await executeQueryAndPushResults(
          observationsQuery
        );

        const annotatedObservations = observations.filter(
          (o) => o.annotationCount.N! > 0
        );

        const userObservations = observations.filter((o) =>
          o.owner.S!.includes(currentPM.userId)
        );

        if (annotatedObservations.length > 0) {
          if (userObservations.length === 0) {
            secondaryCandidates.current.unshift(location.id.S!);
          } else {
            secondaryCandidates.current.push(location.id.S!);
          }
        }

        if (secondaryCandidates.current.length > 3) {
          setHasSecondaryCandidates(true);
        }

        if (secondaryCandidates.current.length >= amount) {
          break;
        }
      }
    }
  }

  async function getTestLocation() {
    const candidateEntries = [...primaryCandidates.current];
    if (candidateEntries.length === 0) {
      throw new Error("No primary candidates available for testing");
    }
    console.log("candidates", candidateEntries);
    const length = candidateEntries.length;
    // Try each candidate once, wrapping around if necessary
    for (let attempt = 0; attempt < length; attempt++) {
      const currentIndex = (i + attempt) % length;
      const entry = candidateEntries[currentIndex];
      console.log(`entry ${currentIndex}`, entry);
      const categoryCounts = await fetchAllPaginatedResults(
        client.models.LocationAnnotationCount
          .categoryCountsByLocationIdAndAnnotationSetId,
        {
          locationId: entry.locationId,
          annotationSetId: { eq: entry.annotationSetId },
          selectionSet: ["category.name"],
        }
      );
      const testCategories = categoryCounts.map((c) =>
        c.category.name.toLowerCase()
      );
      const surveyCategories = categoriesHook.data?.map((c) =>
        c.name.toLowerCase()
      );
      const missingCategories = testCategories.filter(
        (c) => !surveyCategories?.includes(c)
      );
      // Return the first valid test location
      if (missingCategories.length === 0) {
        setI(currentIndex + 1);
        return entry;
      }
    }
    // If no valid candidate found, fallback to the next in sequence
    const fallbackIndex = i % length;
    console.warn(
      "No valid test location found, defaulting to candidate",
      candidateEntries[fallbackIndex]
    );
    setI(fallbackIndex + 1);
    return candidateEntries[fallbackIndex];
  }

  const fetcher = useCallback(async (): Promise<Identifiable> => {
    const location = await getTestLocation();

    currentLocation.current = location;

    if (!location) {
      console.warn("No location found for testing");
    }

    const id = crypto.randomUUID();
    const body = {
      id: id,
      message_id: id,
      location: {
        id: location.locationId,
        annotationSetId: location.annotationSetId,
      },
      allowOutside: true,
      taskTag: "",
      secondaryQueueUrl: undefined,
      skipLocationWithAnnotations: false,
      zoom: zoom,
      testPresetId: location.testPresetId,
      ack: () => {
        console.log("Ack successful for test");
      },
      isTest: true,
    };
    return body;
  }, [i, primaryCandidates, secondaryCandidates, zoom]);

  return {
    fetcher:
      !loading && (hasPrimaryCandidates || hasSecondaryCandidates)
        ? fetcher
        : undefined,
    fetchedLocation: currentLocation.current,
  };
}
