import React, { useCallback, useContext,memo,useState} from "react";
import { UserContext, ProjectContext, GlobalContext } from "./Context";
import { UseAckOnTimeoutProps } from "./useAckOnTimeout"; 
import { BaseImageProps } from "./BaseImage";
import { LocationType, AnnotationSetType } from "./schemaTypes";
import { ImageContext } from "./Context";

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
  }, ack } = props;
  const { annoCount, startLoadingTimestamp, visibleTimestamp, fullyLoadedTimestamp } = useContext(ImageContext)!;
  const { setJobsCompleted } = useContext(UserContext)!;
  const { project } = useContext(ProjectContext)!;
  const { client } = useContext(GlobalContext)!;
  const [acked, setAcked] = useState(false);

  const newAck = useCallback(() => {
    //FIXME: This is a hack. it relies on the fact that we know the current system delays submissions by 2s, but if the timeout changes 
    //or is removed, this will generate incorrect results.
    const submittedTimestamp = Date.now() - 2000;
    if (!acked && location && annotationSetId && project) {
      client.models.Observation.create({
        annotationSetId: annotationSetId,
        annotationCount: annoCount,
        timeTaken: submittedTimestamp ? submittedTimestamp - visibleTimestamp : 0,
        waitingTime: startLoadingTimestamp ? fullyLoadedTimestamp - visibleTimestamp : 0,
        loadingTime: fullyLoadedTimestamp ? fullyLoadedTimestamp - startLoadingTimestamp : 0,
        locationId: id,
        projectId: project.id,
      });
      setAcked(true);
    }
    ack();
    setJobsCompleted?.((x: number) => x + 1);
  }, [location, project, acked,visibleTimestamp,startLoadingTimestamp,fullyLoadedTimestamp,annoCount]);

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
  return memo(WithCreateObservation);
}
