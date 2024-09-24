import { memo, useMemo } from 'react';
import BaseImage from './BaseImage';
import { withAckOnTimeout } from './useAckOnTimeout';
import { Legend } from './Legend';
import Location from './Location';
import { withCreateObservation } from './useCreateObservation';
import CreateAnnotationOnClick from './CreateAnnotationOnClick';
// import { UserContext } from './UserContext';
// import { useMapEvents } from 'react-leaflet';
import Annotations from './AnnotationsContext';
import { ShowMarkers } from './ShowMarkers';
import { ImageMetaType, LocationType, AnnotationSetType } from './schemaTypes';
import { ProjectContext } from './Context'
import { useContext } from 'react';

const Image = memo(withCreateObservation(withAckOnTimeout(BaseImage)));
//const Image = memo(BaseImage);

interface AnnotationImageProps {
  imageMeta: ImageMetaType;
  location?: LocationType;
  next: () => void;
  prev: () => void;
  fullImage: boolean;
  containerheight?: number;
  containerwidth?: number;
  visible: boolean;
  id: string;
  ack: () => void,
  annotationSet: AnnotationSetType;
  isTest?: boolean;
}

// interface PushToSecondaryProps {
//   secondaryQueue: string;
//   [key: string]: any;
// }


// const PushToSecondary = memo(function PushToSecondary(props: PushToSecondaryProps) {
//   const { sendToQueue } = useContext(UserContext)!;

//   useMapEvents({
//     click: () => {
//       sendToQueue({
//         QueueUrl: props.secondaryQueue,
//         MessageGroupId: crypto.randomUUID(),
//         MessageDeduplicationId: crypto.randomUUID(),
//         MessageBody: JSON.stringify(props),
//       });
//     },
//   });

//   return null;
// });
export default function AnnotationImage(props) {
  const { location, next, prev, fullImage, containerheight = 800, containerwidth = 1024, visible, id, ack, setId, isTest, annotationSetId } =props
  const {annotationsHook} = useContext(ProjectContext)!;
  //const annotationsHook = useAnnotations(imageMeta.id, annotationSet.id);
  return (
    <Annotations annotationsHook={annotationsHook}>
      {useMemo(() =>
        <Image
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
          <ShowMarkers imageId={location.image.id} annotationSetId={location.annotationSetId}/>
          {/* <PushToSecondary {...props} /> */}
          <Legend position="bottomright" /> 
        </Image>, [location,next,prev, fullImage,containerheight,containerwidth,visible,id,ack,annotationSetId])}
    </Annotations>
  );
}

