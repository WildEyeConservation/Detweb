import React, { useCallback, useContext } from "react";
import { UserContext, ProjectContext, GlobalContext } from "./Context";
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

export default function useCreateObservation(props: UseCreateObservationProps) {
  const { location: {
    annotationSetId,
    id
  } ,ack} = props;
  const { setJobsCompleted } = useContext(UserContext)!;
  const { project } = useContext(ProjectContext)!;
  const { client } = useContext(GlobalContext)!;

  const newAck = useCallback(() => {
    if (location && annotationSetId && project) {
      client.models.Observation.create({
        annotationSetId: annotationSetId,
        locationId: id,
        projectId: project.id,
      });
    }
    ack();
    setJobsCompleted?.((x: number) => x + 1);
  }, [location, project]);

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
    const {location,ack} = props;
    const newAck = useCreateObservation({location,ack});
    return <WrappedComponent {...props} location={{ ...location, ack: newAck }} />;
  };
  return WithCreateObservation;
}
