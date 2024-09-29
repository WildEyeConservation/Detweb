import { useMemo,useContext} from 'react';
import BaseImage from './BaseImage';
import { withAckOnTimeout } from './useAckOnTimeout';
import { Legend } from './Legend';
import Location from './Location';
import { withCreateObservation } from './useCreateObservation';
import CreateAnnotationOnClick from './CreateAnnotationOnClick';
import { GlobalContext } from './Context';
// import { UserContext } from './UserContext';
// import { useMapEvents } from 'react-leaflet';
import { ShowMarkers } from './ShowMarkers';
import { useOptimisticAnnotation } from './useOptimisticUpdates';

const Image = withCreateObservation(withAckOnTimeout(BaseImage));

export default function AnnotationImage(props) {
  const { location, next, prev, containerheight = 800, containerwidth = 1024, visible, id, ack, annotationSetId } = props
  const {client} = useContext(GlobalContext)!;
  const subscriptionFilter = useMemo(() => ({
    filter: { and:[{setId: { eq: location.annotationSetId }}, {imageId: { eq: location.image.id }}]}
  }), [annotationSetId,location.image.id]);
  const annotationsHook = useOptimisticAnnotation(
    async () => client.models.Annotation.annotationsByImageIdAndSetId({imageId: location.image.id, setId: {eq: annotationSetId}}),
    subscriptionFilter)
  return (<Image
            containerwidth={containerwidth}
            containerheight={containerheight}
            visible={visible}
            location={location}
            id={id} 
            prev={prev}
            next={next}
            ack={ack}
            annotationSet={annotationSetId}>
            {location && <Location {...location}/>} 
            <CreateAnnotationOnClick {...{annotationsHook, location, annotationSet: annotationSetId, source: 'manual'}}/>
            <ShowMarkers annotationsHook={annotationsHook}/>
            {/* <PushToSecondary {...props} /> */}
          <Legend position="bottomright" /> 
        </Image >
  );
}

