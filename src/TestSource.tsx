import { useContext, useCallback, useState, useEffect, useRef } from "react";
import { ProjectContext, GlobalContext, UserContext } from "./Context";
import { fetchAllPaginatedResults } from "./utils";
import { QueryCommand } from "@aws-sdk/client-dynamodb";

export default function useTesting() {
    const { currentPM } = useContext(ProjectContext)!;
    const { client, backend } = useContext(GlobalContext)!;
    const { getDynamoClient } = useContext(UserContext)!;
    const [i, setI] = useState(0);
    const [locationsLoaded, setLocationsLoaded] = useState(false);
    const primaryCandidates = useRef<string[]>([]);
    const secondaryCandidates = useRef<string[]>([]);

    useEffect(() => {
        fetchTestLocations();
    }, []);

    async function executeQueryAndPushResults(command: QueryCommand): Promise<any[]> {
        const dynamoClient = await getDynamoClient();
        let lastEvaluatedKey: any;
        const resultsArray: any[] = [];
    
        do {
            command.input.ExclusiveStartKey = lastEvaluatedKey;
    
            try {
                const response = await dynamoClient.send(command);
                if (response.Items) {
                    resultsArray.push(...response.Items);
                }
                lastEvaluatedKey = response.LastEvaluatedKey;
            } catch (error) {
                console.error("Error querying DynamoDB:", error);
                throw error;
            }
        } while (lastEvaluatedKey);

        return resultsArray;
    }

    async function fetchTestLocations() {
        const locationSets = await fetchAllPaginatedResults(
            client.models.LocationSet.locationSetsByProjectId, 
            {
                projectId: currentPM.projectId,
                selectionSet: ['id'] as const,
            },
        );

        for (const set of locationSets) {
            const locationsQuery = new QueryCommand({
                TableName: backend.custom.locationTable,
                IndexName: "locationsBySetIdAndConfidence",
                KeyConditionExpression: "setId = :locationSetId",
                ExpressionAttributeValues: {
                    ":locationSetId": {
                        S: set.id
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
                            S: location.id.S!
                        },
                    },
                    ProjectionExpression: "id, #owner, createdAt, annotationCount",
                    ExpressionAttributeNames: {
                        "#owner": "owner"
                    },
                    Limit: 1000,
                });

                const observations = await executeQueryAndPushResults(observationsQuery);

                const annotatedObservations = observations.filter(o => o.annotationCount.N! > 0);

                const userObservations = observations.filter(o => o.owner.S!.includes(currentPM.userId));

                if (annotatedObservations.length > 0) {
                    if (userObservations.length === 0) {
                        primaryCandidates.current.unshift(location.id.S!);
                    } else {
                        primaryCandidates.current.push(location.id.S!);
                    }
                } else {
                    if (userObservations.length === 0) {
                        secondaryCandidates.current.push(location.id.S!);
                    } else {
                        secondaryCandidates.current.push(location.id.S!);
                    }
                }
            }
        }

        setLocationsLoaded(true);
    }

    function getTestLocation() {
        let candidateEntries: string[] = [];
        if (primaryCandidates.current.length < 3) {
            candidateEntries = [
                ...primaryCandidates.current, 
                ...secondaryCandidates.current.slice(0, 3 - primaryCandidates.current.length)
            ];
        } else {
            candidateEntries = primaryCandidates.current;
        }

        const result = candidateEntries[i];
        setI(prev => prev + 1);
        return result;
    }

    const fetcher = useCallback(async (): Promise<Identifiable> => {
        const locationId = getTestLocation();
        
        if (!locationId) {
            console.warn('No location found for testing');
        }

        const id = crypto.randomUUID();
        const body = {
            id: id,
            message_id: id,
            location: {
                id: locationId,
                annotationSetId: crypto.randomUUID(),
            }, 
            allowOutside: false, 
            taskTag: '', 
            secondaryQueueUrl: undefined, 
            skipLocationWithAnnotations: false,
            ack: () => {
                console.log('Ack successful for test');
            }
        };
        return body;

    }, [i, primaryCandidates, secondaryCandidates]);

    return {fetcher: locationsLoaded ? fetcher : undefined};
}
