import React, { memo, useContext, useState, useEffect, useMemo } from 'react';
import BaseImage from './BaseImage';
import { withAckOnTimeout } from './useAckOnTimeout';
import { Legend } from './Legend';
import Location from './Location';
import { withCreateObservation } from './useCreateObservation';
import CreateAnnotationOnClick from './CreateAnnotationOnClick';
import { useAnnotations } from './useGqlCached';
import { UserContext } from './UserContext';
import { useMapEvents } from 'react-leaflet';
import Annotations from './AnnotationsContext';
import { ShowMarkers } from './ShowMarkers';
const Image = memo(withCreateObservation(withAckOnTimeout(BaseImage)));

const PushToSecondary = memo(function PushToSecondary(props) {
  const { sendToQueue } = useContext(UserContext);
  useMapEvents(
    {
      click: () => {
        sendToQueue({
          QueueUrl: props.secondaryQueue,
          MessageGroupId: crypto.randomUUID(),
          MessageDeduplicationId: crypto.randomUUID(),
          MessageBody: JSON.stringify(props),
        });
      },
    },
    []
  );
  return;
});

export default function AnnotationImage(props) {
  const { width, height, x, y, image, next, prev, fullImage, containerheight = 800, containerwidth = 1024, visible, id, ack, setId, isTest } =props
  const annotationsHook = useAnnotations(image.key, setId);

  return (
    <Annotations annotationsHook={annotationsHook}>
      {image?.width && useMemo(() =>
        <Image containerwidth={containerwidth} containerheight={containerheight} width={width} height={height} x={x} y={y} visible={visible} id={id} img={image}
          prev={prev} next={next} fullImage={fullImage} ack={ack} setId={setId}>
          <Location {...{ x, y, width, height, isTest }} />
          {ack && (
            <>
              <CreateAnnotationOnClick {...{ setId, image, x, y, width, height }}
              />
              <ShowMarkers />
              {/* <PushToSecondary {...props} /> */}
            </>
          )}
          <Legend position="bottomright" />
        </Image>, [width,height,x,y,image,next,prev, fullImage,containerheight,containerwidth,visible,id,ack,setId,ack])}
    </Annotations>
  );
}

