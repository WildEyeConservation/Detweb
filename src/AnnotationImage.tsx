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

const Image = memo(withAckOnTimeout(withCreateObservation(BaseImage)));

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
export default function AnnotationImage({ imageMeta, location, next, prev, fullImage, containerheight, containerwidth, visible, id, ack, annotationSet}: AnnotationImageProps) {
  const annotationsHook = useAnnotations(imageMeta.id, annotationSet.id);
  return (
    <Annotations annotationsHook={annotationsHook}>
      {useMemo(() =>
        <Image
          containerwidth={containerwidth}
          containerheight={containerheight}
          location={location}
          imageMeta={imageMeta}
          visible={visible}
          id={id} 
          prev={prev}
          next={next}
          ack={ack}
          annotationSet={annotationSet}>
          {location && <Location {...location}/>}
          {typeof ack === 'function' && (
            <>
              <CreateAnnotationOnClick {...{image: imageMeta, annotationsHook, location, annotationSet, source: 'manual'}}/>
              <ShowMarkers annotations={annotationsHook.annotations}/>
              {/* <PushToSecondary {...props} /> */}
            </>
          )}
          <Legend position="bottomright" />
        </Image>, [location,imageMeta,next,prev, fullImage,containerheight,containerwidth,visible,id,ack,annotationSet])}
    </Annotations>
  );
}

