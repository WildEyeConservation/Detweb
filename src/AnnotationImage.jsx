import React, { memo, useContext, useState, useEffect } from "react";
import BaseImage from "./BaseImage";
import { withAckOnTimeout } from "./useAckOnTimeout";
import { Legend } from "./Legend";
import Location from "./Location";
import { withCreateObservation } from "./useCreateObservation";
import CreateAnnotationOnClick from "./CreateAnnotationOnClick";
import { useAnnotations } from "./useGqlCached";
import { UserContext } from "./UserContext";
import { useMapEvents } from "react-leaflet";
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
    [],
  );
  return;
});

const AnnotationImage = memo(function AnnotationImage(props) {
  const annotationsHook = useAnnotations(props.image.key, props.setId);

  /* The following snippet triggers a rerender every 100ms, which with the current code causes a visual "crash" (UI stops rendering all components and becomes 
    extremely laggy) within ~14s. It is used to easily reproduce laggy behaviour and crashes sometimes intermittently experienced on pages with "many annotations" 
    (it turns out that the actual determinant of crashing is not the number of annotations on the image, but the number of updates to the annotations, but obviously 
    large numbers of updates become more likely as the number of annotations rise so users percieve this as being linked to annotation number) I ultimately traced
    the issue to re-renders (of the MapContainer Component specifically) and am currently trying to figure out how to prevent this (while still rerendering 
    children of MapContainer that actually need to update such as ShowAnnotations). This snippet helps me reproduce the problem quickly and easily and thus helps
    me know when it is fixed.
    
  const [counter, setCounter] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setCounter((counter) => counter + 1), 100);
    return () => clearInterval(timer);
  }, []);*/

  return (
    <Image containerwidth={1024} containerheight={800} {...props}>
      <Location {...props} />
      {props.ack && (
        <>
          <CreateAnnotationOnClick
            setId={props.setId}
            image={props.image}
            annotationsHook={annotationsHook}
            location={{
              x: props.x,
              y: props.y,
              width: props.width,
              height: props.height,
            }}
          />
          <PushToSecondary {...props} />
        </>
      )}
      <Legend position="bottomright" />
    </Image>
  );
});
export default AnnotationImage;
