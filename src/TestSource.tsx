import { useContext, useCallback, useState, useEffect, useRef } from 'react';
import { ProjectContext, GlobalContext } from './Context';
import { fetchAllPaginatedResults } from './utils';

export default function useTesting() {
  const { currentPM, project, categoriesHook } = useContext(ProjectContext)!;
  const { client } = useContext(GlobalContext)!;

  // Use ref for index to prevent race conditions when multiple fetcher calls happen concurrently
  const iRef = useRef(0);
  const [zoom, setZoom] = useState<number | undefined>(undefined);
  const [hasPrimaryCandidates, setHasPrimaryCandidates] = useState(false);
  const [loading, setLoading] = useState(true);

  const primaryCandidates = useRef<
    { locationId: string; annotationSetId: string; testPresetId: string }[]
  >([]);
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
        setLoading(false);
        return;
      }

      const presets = await fetchAllPaginatedResults(
        client.models.TestPresetProject.testPresetsByProjectId,
        {
          projectId: project.id,
          selectionSet: ['testPresetId'],
        }
      );

      fetchPrimaryLocations(presets);

      setLoading(false);
    }

    setup();
  }, [currentPM]);

  async function fetchPrimaryLocations(presets: { testPresetId: string }[]) {
    const testedLocations = await fetchAllPaginatedResults(
      client.models.TestResult.testResultsByUserId,
      {
        userId: currentPM.userId,
        selectionSet: [
          'locationId',
          'createdAt',
          'testPresetId',
          'annotationSetId',
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
          selectionSet: ['locationId', 'createdAt', 'annotationSetId'] as const,
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

    // Lookup of valid current test preset-location pairs
    const testKeys = new Set(
      testLocations.map((l) => `${l.testPresetId}:${l.locationId}`)
    );

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

    // add seen locations to the end of the array as backup (only if still part of current test presets)
    for (const seenLocation of seenLocations) {
      const key = `${seenLocation.testPresetId}:${seenLocation.locationId}`;
      if (testKeys.has(key)) {
        locations.push({
          locationId: seenLocation.locationId,
          createdAt: seenLocation.createdAt,
          annotationSetId: seenLocation.annotationSetId,
          testPresetId: seenLocation.testPresetId,
        });
      }
    }

    primaryCandidates.current = locations.map((l) => ({
      locationId: l.locationId,
      annotationSetId: l.annotationSetId,
      testPresetId: l.testPresetId,
    }));

    setHasPrimaryCandidates(primaryCandidates.current.length > 0);
  }

  async function getTestLocation() {
    const candidateEntries = [...primaryCandidates.current];
    if (candidateEntries.length === 0) {
      throw new Error('No primary candidates available for testing');
    }
    console.log('candidates', candidateEntries);
    const length = candidateEntries.length;
    
    // Capture and immediately increment the index to prevent race conditions
    // when multiple concurrent fetcher calls happen
    const startIndex = iRef.current;
    iRef.current = (startIndex + 1) % length;
    
    // Try each candidate once, wrapping around if necessary
    for (let attempt = 0; attempt < length; attempt++) {
      const currentIndex = (startIndex + attempt) % length;
      const entry = candidateEntries[currentIndex];
      console.log(`entry ${currentIndex}`, entry);
      const categoryCounts = await fetchAllPaginatedResults(
        client.models.LocationAnnotationCount
          .categoryCountsByLocationIdAndAnnotationSetId,
        {
          locationId: entry.locationId,
          annotationSetId: { eq: entry.annotationSetId },
          selectionSet: ['category.name'],
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
        // Update ref to skip past this entry for next call
        iRef.current = (currentIndex + 1) % length;
        return entry;
      }
    }
    // If no valid candidate found, fallback to the next in sequence
    const fallbackIndex = startIndex % length;
    console.warn(
      'No valid test location found, defaulting to candidate',
      candidateEntries[fallbackIndex]
    );
    iRef.current = (fallbackIndex + 1) % length;
    return candidateEntries[fallbackIndex];
  }

  const fetcher = useCallback(async (): Promise<Identifiable> => {
    const location = await getTestLocation();

    currentLocation.current = location;

    if (!location) {
      console.warn('No location found for testing');
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
      taskTag: '',
      secondaryQueueUrl: undefined,
      skipLocationWithAnnotations: false,
      zoom: zoom,
      testPresetId: location.testPresetId,
      ack: () => {
        console.log('Ack successful for test');
      },
      isTest: true,
    };
    return body;
  }, [primaryCandidates, zoom]);

  return {
    fetcher: !loading && hasPrimaryCandidates ? fetcher : undefined,
    fetchedLocation: currentLocation.current,
  };
}
