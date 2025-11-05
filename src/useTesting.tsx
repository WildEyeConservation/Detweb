import { useContext, useEffect, useState, useCallback } from 'react';
import { UserContext } from './UserContext';
import * as subs from './graphql/subscriptions';
import {
  annotationsByAnnotationSetId,
  getLocation,
  locationSetsByProjectName,
} from './graphql/queries';

import { latestObservation, testLocations } from './gqlQueries';
import { GraphQLResult } from '@aws-amplify/api';
import { gqlClient, graphqlOperation } from './App';

interface LocationSet {
  id: string;
}

interface Location {
  id: string;
}

interface Observation {
  createdAt: string;
}

interface UseTestingReturnType {
  numAcks: number;
}

export function useTesting(
  injectTestCase: (body: any) => void,
  testFailed: (body: any) => void
): UseTestingReturnType {
  const userContext = useContext(UserContext);

  // if (!userContext?.user || !userContext.currentProject) {
  //   throw new Error("User or Project is missing from context.");
  // }

  const { user, currentProject } = userContext;
  const [numAcks, setNumAcks] = useState<number>(0);

  const incrementAcks = useCallback(() => setNumAcks((na) => na + 1), []);
  const resetAcks = () => setNumAcks(0);

  const getTestLocation = async (): Promise<string | undefined> => {
    let nextToken: string | null = null;
    const candidateLocations: Record<string, string> = {};

    do {
      let locationSets: LocationSet[] = [];
      const locationSetResult = (await gqlClient.graphql(
        graphqlOperation(locationSetsByProjectName, {
          projectName: currentProject,
          nextToken,
        })
      )) as GraphQLResult<{
        locationSetsByProjectName: {
          items: LocationSet[];
          nextToken: string | null;
        };
      }>;

      if (locationSetResult.data) {
        locationSets = locationSetResult.data.locationSetsByProjectName.items;
        nextToken = locationSetResult.data.locationSetsByProjectName.nextToken;
      }

      for (const locationSet of locationSets) {
        let locationNextToken: string | null = null;

        do {
          let locations: Location[] = [];
          const locationResult = (await gqlClient.graphql(
            graphqlOperation(testLocations, {
              setId: locationSet.id,
              nextToken: locationNextToken,
            })
          )) as GraphQLResult<{
            testLocations: { items: Location[]; nextToken: string | null };
          }>;

          if (locationResult.data) {
            locations = locationResult.data.testLocations.items;
            locationNextToken = locationResult.data.testLocations.nextToken;
          }

          for (const { id } of locations) {
            const observationResult = (await gqlClient.graphql(
              graphqlOperation(latestObservation, {
                locationId: id,
                owner: user.id,
              })
            )) as GraphQLResult<{
              observationsByLocationIdAndOwnerAndCreatedAt: {
                items: Observation[];
              };
            }>;

            if (observationResult.data) {
              const observations =
                observationResult.data
                  .observationsByLocationIdAndOwnerAndCreatedAt.items;
              if (observations.length === 0) {
                return id;
              } else {
                candidateLocations[observations[0].createdAt] = id;
              }
            }
          }
        } while (locationNextToken);
      }
    } while (nextToken);

    const sortedKeys = Object.keys(candidateLocations).sort();
    return candidateLocations[sortedKeys[0]];
  };

  const createTestCase = async (id: string) => {
    const locationResult = (await gqlClient.graphql(
      graphqlOperation(getLocation, { id })
    )) as GraphQLResult<{ getLocation: any }>;

    if (!locationResult.data) {
      throw new Error('Failed to fetch location data.');
    }

    const body = locationResult.data.getLocation;
    body.setId = crypto.randomUUID(); // Generate a random AnnotationSetId.
    body.message_id = crypto.randomUUID();

    body.ack = async () => {
      const annotationResult = (await gqlClient.graphql(
        graphqlOperation(annotationsByAnnotationSetId, {
          annotationSetId: body.setId,
        })
      )) as GraphQLResult<{ annotationsByAnnotationSetId: { items: any[] } }>;

      if (
        annotationResult.data &&
        annotationResult.data.annotationsByAnnotationSetId.items.length === 0
      ) {
        body.ack = undefined;
        testFailed(body);
      }
    };

    return body;
  };

  useEffect(() => {
    if (numAcks > 100) {
      getTestLocation().then((id) => {
        if (id) {
          createTestCase(id).then(injectTestCase);
        }
      });
      resetAcks();
    }
  }, [numAcks, injectTestCase]);

  useEffect(() => {
    if (user) {
      const subCreates = gqlClient.graphql(
        graphqlOperation(subs.onCreateAnnotation, {
          filter: { owner: { contains: user.id } },
        })
      ) as any;

      const subAcks = gqlClient.graphql(
        graphqlOperation(subs.onCreateObservation, {
          filter: { owner: { contains: user.id } },
        })
      ) as any;

      const subCreatesSubscription = subCreates.subscribe({
        next: () => resetAcks(),
      });

      const subAcksSubscription = subAcks.subscribe({
        next: () => incrementAcks(),
      });

      return () => {
        subCreatesSubscription.unsubscribe();
        subAcksSubscription.unsubscribe();
      };
    }
  }, [user, incrementAcks]);

  return { numAcks };
}
