import { useContext, useEffect, useState, useCallback } from "react";
import { UserContext } from "./UserContext";
import * as subs from "./graphql/subscriptions";
import {
  annotationsByAnnotationSetId,
  getLocation,
  locationSetsByProjectName,
} from "./graphql/queries";

import { latestObservation, testLocations } from "./gqlQueries";
import { gqlClient, graphqlOperation } from "./App";

export function useTesting(injectTestCase, testFailed) {
  const { user, currentProject } = useContext(UserContext);
  const [numAcks, setNumAcks] = useState(0);
  const incrementAcks = useCallback(
    () => setNumAcks((na) => na + 1),
    [setNumAcks],
  );
  const resetAcks = () => setNumAcks(0);

  const getTestLocation = async () => {
    let nextToken = null;
    const candidateLocations = {};
    do {
      let locationSets; //First get the locationSets in this project
      ({
        data: {
          locationSetsByProjectName: { items: locationSets, nextToken },
        },
      } = await gqlClient.graphql(
        graphqlOperation(locationSetsByProjectName, {
          projectName: currentProject,
          nextToken,
        }),
      ));
      for (const locationSet of locationSets) {
        let nextToken = null;
        do {
          let locations; // Next we get the test Locations in this set
          ({
            data: {
              testLocations: { items: locations, nextToken },
            },
          } = await gqlClient.graphql(
            graphqlOperation(testLocations, {
              setId: locationSet.id,
              nextToken,
            }),
          ));
          for (const { id } of locations) {
            // And then we see what the last time was that the current user saw that particular testcase
            const {
              data: {
                observationsByLocationIdAndOwnerAndCreatedAt: { items },
              },
            } = await gqlClient.graphql(
              graphqlOperation(latestObservation, {
                locationId: id,
                owner: user.id,
              }),
            );
            /* If we find a test case that the user has never seen, there is no need to keep searching*/
            if (items.length == 0) {
              return id;
            } else {
              candidateLocations[items[0].createdAt] = id;
            }
          }
        } while (nextToken);
      }
    } while (nextToken);
    return candidateLocations[Object.keys(candidateLocations).sort()[0]];
  };

  const createTestCase = async (id) => {
    const data = await gqlClient.graphql(graphqlOperation(getLocation, { id }));
    const {
      data: { getLocation: body },
    } = data;
    body.setId = crypto.randomUUID(); // We generate a random AnnotationSetId. this way we guarantee that no annotations will be shown
    body.message_id = crypto.randomUUID();
    body.ack = async () => {
      //And when the image is acked we check whether any annotatiosn were created for that setId.
      const {
        data: {
          annotationsByAnnotationSetId: { items: res },
        },
      } = await gqlClient.graphql(
        graphqlOperation(annotationsByAnnotationSetId, {
          annotationSetId: body.setId,
        }),
      );
      if (res.length == 0) {
        body.ack = undefined;
        testFailed(body);
      }
    };
    return body;
  };

  useEffect(() => {
    if (numAcks > 100) {
      //Inject a test case when the user has acked more than N images without creating any new annotations.
      getTestLocation().then(createTestCase).then(injectTestCase);
      resetAcks();
    }
  }, [numAcks]);

  useEffect(() => {
    if (user) {
      const subCreates = gqlClient
        .graphql(
          graphqlOperation(subs.onCreateAnnotation, {
            filter: { owner: { contains: user.id } },
          }),
        )
        .subscribe(() => {
          resetAcks();
        });
      const subAcks = gqlClient
        .graphql(
          graphqlOperation(subs.onCreateObservation, {
            filter: { owner: { contains: user.id } },
          }),
        )
        .subscribe(() => {
          incrementAcks();
        });
      return () => {
        subCreates.unsubscribe();
        subAcks.unsubscribe();
      };
    }
  }, [user, incrementAcks]);
  return { numAcks };
}
