import { memo, useMemo } from 'react';
import BaseImage from './BaseImage';
import { withAckOnTimeout } from './useAckOnTimeout';
import { Legend } from './Legend';
import Location from './Location';
import { withCreateObservation } from './useCreateObservation';
import CreateAnnotationOnClick from './CreateAnnotationOnClick';
import { useAnnotations } from './useGqlCached';
// import { UserContext } from './UserContext';
// import { useMapEvents } from 'react-leaflet';
import Annotations from './AnnotationsContext';
import { ShowMarkers } from './ShowMarkers';


const Image = memo(withAckOnTimeout(withCreateObservation(BaseImage)));

interface AnnotationImageProps {
  width: number;
  height: number;
  x: number;
  y: number;
  image: {
    key: string;
    width?: number;
    height?: number;
  };
  next: () => void;
  prev: () => void;
  fullImage: boolean;
  containerheight?: number;
  containerwidth?: number;
  visible: boolean;
  id: string;
  ack: () => void,
  setId: string;
  isTest?: boolean;
  locationId: string;
  annotationSetId: string;
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
export default function AnnotationImage(props: AnnotationImageProps) {
  const { width, height, x, y, image, next, prev, fullImage, containerheight = 800, containerwidth = 1024, visible, id, ack, setId, isTest, locationId, annotationSetId  } = props;
  const annotationsHook = useAnnotations(image.key, setId);

  const img = {
    key: image.key,
    width: image.width ?? 0, 
    height: image.height ?? 0 
  };

  return (
    <Annotations annotationsHook={annotationsHook}>
      {image?.width && useMemo(() =>
        <Image containerwidth={String(containerwidth)} containerheight={String(containerheight)} width={width} height={height} x={x} y={y} visible={visible} id={id} img={img}
          prev={prev} next={next} fullImage={fullImage} ack={ack || (() => {})} setId={setId} locationId={locationId} annotationSetId={annotationSetId} boundsxy={[[x, y], [x + width, y + height]]}>
          <Location {...{ x, y, width, height, isTest: isTest ? 1 : 0, id }} />
          {typeof ack === 'function' && (
            <>
              <CreateAnnotationOnClick {...{ setId, image, x, y, width, height, annotationsHook, location: { x, y, width, height} }}
              />
              <ShowMarkers annotations={annotationsHook.annotations}/>
              {/* <PushToSecondary {...props} /> */}
            </>
          )}
          <Legend position="bottomright" />
        </Image>, [width,height,x,y,image,next,prev, fullImage,containerheight,containerwidth,visible,id,ack,setId,locationId,annotationSetId])}
    </Annotations>
  );
}

