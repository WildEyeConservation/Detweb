import React, { useCallback, useContext } from "react";
import { UserContext } from "./UserContext";
import { createObservationMinimal } from "./gqlQueries";
import { gqlClient, graphqlOperation } from "./App";
import { UseAckOnTimeoutProps } from "./useAckOnTimeout"; 
import { BaseImageProps } from "./BaseImage";

/* This hook will take an ack callback as input and create a new ack callback that:
- Uses the graphQL API to create an Observation entry for the current user.
- Calls the old callback
*/

interface UseCreateObservationProps {
  ack: () => void;
  locationId: string;
  annotationSetId: string;
}

export default function useCreateObservation({
  ack = () => {},
  locationId,
  annotationSetId,
}: UseCreateObservationProps) {
  const { user, setJobsCompleted } = useContext(UserContext)!;

  const newAck = useCallback(() => {
    if (!user) return;
    gqlClient.graphql(
      graphqlOperation(createObservationMinimal, {
        input: { annotationSetId, locationId, owner: user.id },
      })
    );
    ack();
    setJobsCompleted?.((x: number) => x + 1);
  }, [ack, setJobsCompleted, user, annotationSetId, locationId]);

  return newAck;
}


export interface WithCreateObservationProps extends UseCreateObservationProps {
  [key: string]: any;
}

interface CombinedProps extends WithCreateObservationProps, UseAckOnTimeoutProps, BaseImageProps {}

export function withCreateObservation<T extends CombinedProps>(
  WrappedComponent: React.ComponentType<T>
) {
  const WithCreateObservation: React.FC<T> = (props) => {
    const { ack, id, setId, ...rest } = props;
    const newAck = useCreateObservation({
      ack,
      locationId: id ?? "",
      annotationSetId: setId ?? "",
    });
    return <WrappedComponent {...(rest as T)} ack={newAck} />;
  };
  return WithCreateObservation;
}
