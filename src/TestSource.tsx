import { useContext, useCallback, useState } from "react";
import { ProjectContext, GlobalContext, UserContext } from "./Context";
import { fetchAllPaginatedResults } from "./utils";

export default function useTesting() {
    const [hasLocation, setHasLocation] = useState(false);

    const { currentPM } = useContext(ProjectContext)!;
    const { client } = useContext(GlobalContext)!;
    const { unannotatedJobs, currentTaskTag } = useContext(UserContext)!;
    const candidateLocations: Record<string, string> = {};

    //TESTING -> REMOVE
    const [count, setCount] = useState(0);

    async function getTestLocation() {
        //TESTING -> REMOVE
        const tSets = ['bb33b012-4e4b-4ec7-8cc8-d80c27f989af', 'c2ba85ea-26d1-42fb-858a-e8cce0864f41', 'd2e5f5f9-c285-4b88-aa7c-a3b6965ee836']

        const id = tSets[count];
        setCount(c => c === 2 ? 0 : c + 1);
        return id;

        // const tLocationSets = await fetchAllPaginatedResults(
        //     client.models.LocationSet.locationSetsByProjectId, 
        //     {
        //         projectId: currentPM.projectId,
        //         selectionSet: ['id'] as const,
        //     },
        // );

        // for (const set of tLocationSets) {
        //     const { data: tLocations } = await client.models.Location.locationsBySetIdAndConfidence({
        //         setId: set.id,
        //         selectionSet: ['id'] as const,
        //     });

        //     if (tLocations.length > 0) {
        //         const tId = tLocations[count].id;
        //         setCount(c => c + 1);
        //         return tId;
        //     }
        // }

        //TODO: OPTIMIZE ASAP
        const locationSets = await fetchAllPaginatedResults(
            client.models.LocationSet.locationSetsByProjectId, 
            {
                projectId: currentPM.projectId,
                selectionSet: ['id'] as const,
            },
        );

        for (const set of locationSets) {
            const locations = await fetchAllPaginatedResults(
                client.models.Location.locationsBySetIdAndConfidence,
                {
                    setId: set.id,
                    selectionSet: ['id'] as const,
                },
            );

            for (const location of locations) {
                // TODO (not in old hook?): need to know whether the location actually has annotations

                const observations = await fetchAllPaginatedResults(
                    client.models.Observation.observationsByLocationId,
                    {
                        locationId: location.id,
                        selectionSet: ['id', 'createdAt'] as const,
                        filter: {
                            owner: {
                                contains: currentPM.userId,
                            },
                        },
                    },
                );
                
                if (observations.length === 0) {
                    return location.id;
                }

                candidateLocations[observations[0].createdAt] = location.id;
            }
        }

        const sortedKeys = Object.keys(candidateLocations).sort();
        return candidateLocations[sortedKeys[0]];
    }

    const fetcher = useCallback(async (): Promise<Identifiable> => {
        console.warn('test fetcher called');
        const locationId = await getTestLocation();
        
        if (locationId) {
            setHasLocation(true);
        } else {
            setHasLocation(false);
            console.warn('No location found for testing');
        }
        
        // create temporary annotation set
        const { data: annotationSet } = await client.models.AnnotationSet.create({
            projectId: currentPM.projectId,
            name: `user-test-${crypto.randomUUID()}`,
            // name: `user-test-general-annotation-set`,
        });

        if (!annotationSet) {
            throw new Error("Failed to create annotation set");
        }

        const id = crypto.randomUUID();
        const body = {
            id: id,
            message_id: id,
            location: {
                id: locationId,
                annotationSetId: annotationSet.id,
            }, 
            allowOutside: false, 
            taskTag: '', 
            secondaryQueueUrl: undefined, 
            skipLocationWithAnnotations: false,
            ack: async () => {
                try {
                    await client.models.AnnotationSet.delete({
                        id: annotationSet.id,
                    });
                } catch (error) {
                    console.error(
                        `Ack failed for test on ${annotationSet.id}`,
                        error,
                    );
                }
            }
        };

        console.log('test body', body);
        return body;

    }, [unannotatedJobs, currentTaskTag]);

  return {fetcher};
}
