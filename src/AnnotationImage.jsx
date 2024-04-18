import React,{ memo, useContext } from "react";
import BaseImage from "./BaseImage";
import { withAckOnTimeout } from './useAckOnTimeout'
import { Legend } from './Legend';
import Location from "./Location";
import { withCreateObservation } from "./useCreateObservation";
import CreateAnnotationOnClick from "./CreateAnnotationOnClick";
import { useAnnotations } from "./useGqlCached";
import { UserContext } from "./UserContext";
import { useMapEvents } from "react-leaflet";
const Image=memo(withCreateObservation(withAckOnTimeout(BaseImage)))

const PushToSecondary=memo(function PushToSecondary(props){
    const {sendToQueue}=useContext(UserContext)
      useMapEvents({
          click:()=>{
              sendToQueue({QueueUrl: props.secondaryQueue,
                MessageGroupId : crypto.randomUUID(),
                MessageDeduplicationId : crypto.randomUUID(),
                MessageBody: JSON.stringify(props)})
              }
          },[]);
    return   
})


const AnnotationImage= memo(function AnnotationImage(props){
    const annotationsHook = useAnnotations(props.image.key,props.setId)
    return  <Image containerwidth={1024} containerheight={800} {...props}>
                <Location {...props} />
                {props.ack &&
                    <><CreateAnnotationOnClick setId={props.setId} image={props.image} annotationsHook={annotationsHook} location={{x:props.x,y:props.y,width:props.width,height:props.height}}/>
                <PushToSecondary {...props}/></>}
                <Legend position='bottomright' />
            </Image>
})
export default AnnotationImage

