import React, { useCallback, useContext } from "react";
import { UserContext } from "./Context";
import { UseAckOnTimeoutProps } from "./useAckOnTimeout"; 
import { BaseImageProps } from "./BaseImage";
import { LocationType, AnnotationSetType } from "./schemaTypes";

/* This hook will take an ack callback as input and create a new ack callback that:
- Uses the graphQL API to create an Observation entry for the current user.
- Calls the old callback
*/

interface UseCreateObservationProps {
  ack: () => void;
  location?: LocationType;
  annotationSet: AnnotationSetType;
}

export default function useCreateObservation({
  ack = () => {},
  location,
  annotationSet,
}: UseCreateObservationProps) {
  const { user, setJobsCompleted, currentProject } = useContext(UserContext)!;

  const newAck = useCallback(() => {
    if (!user || !location || !annotationSet || !currentProject) return;
    GQL_Client.models.Observation.create({
      annotationSetId: annotationSet.id,
      locationId: location.id,
      projectId: currentProject.id,
    });
    ack();
    setJobsCompleted?.((x: number) => x + 1);
  }, [ack, setJobsCompleted, annotationSet.id, location?.id, currentProject?.id]);

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
    const { ack, location, annotationSet} = props;
    const newAck = useCreateObservation({
      ack,
      location,
      annotationSet,
    });
    return <WrappedComponent {...props} ack={newAck} />;
  };
  return WithCreateObservation;
}
