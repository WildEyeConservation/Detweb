import { useCallback , useState,useContext} from "react";
import { ImageContext, UserContext } from "./Context";
import type { ImageType } from "./schemaTypes";
import type { AnnotationsHook } from "./Context";
import L from "leaflet";
import { SendMessageCommand } from "@aws-sdk/client-sqs";

export function ImageContextFromHook({ hook, image, children, secondaryQueueUrl, taskTag }: { hook: AnnotationsHook, image: ImageType, children: React.ReactNode,secondaryQueueUrl?:string,taskTag:string }) {
    const [annoCount, setAnnoCount] = useState(0)
    const [startLoadingTimestamp, _] = useState<number>(Date.now())
    const [visibleTimestamp, setVisibleTimestamp] = useState<number | undefined>(undefined)
    const [fullyLoadedTimestamp, setFullyLoadedTimestamp] = useState<number | undefined>(undefined)
    const {getSqsClient} = useContext(UserContext);
    const [zoom,setZoom] = useState(1)

    const create = useCallback((annotation) => {
        if (secondaryQueueUrl) {
            getSqsClient().then(sqsClient => sqsClient.send(new SendMessageCommand({
                QueueUrl: secondaryQueueUrl,
                MessageBody: JSON.stringify({location:{x:annotation.x,y:annotation.y,width:100,height:100,image,annotationSetId:annotation.setId},allowOutside:true,zoom,taskTag:taskTag+'Secondary'})
            })));
        }
        setAnnoCount(old=>old + 1)
        return hook.create(annotation)
    }, [hook.create,setAnnoCount,secondaryQueueUrl,zoom,taskTag])

    const _delete = useCallback((annotation) => {
        setAnnoCount(old=>old - 1)
        return hook.delete(annotation)
    }, [hook.delete,setAnnoCount])

    const scale = Math.pow(
        2,
        Math.ceil(Math.log2(Math.max(image.width, image.height))) - 8,
    );

    const xy2latLng = useCallback((input: L.Point | [number, number] | Array<L.Point | [number, number]>): L.LatLng | L.LatLng[] => {
        if (Array.isArray(input)) {
            if (Array.isArray(input[0])) {
                return (input as [number, number][]).map((x) => xy2latLng(x) as L.LatLng);
            } else {
                const [lng, lat] = input as [number, number];
                return L.latLng(-lat / scale, lng / scale);
            }
        } else {
            return L.latLng(-input.y / scale, input.x / scale);
        }
    }, [scale]);

    const latLng2xy = useCallback((input: L.LatLng | [number, number] | Array<L.LatLng | [number, number]>): L.Point | L.Point[] => {
        if (Array.isArray(input)) {
            if (Array.isArray(input[0])) {
                return (input as Array<L.LatLng | [number, number]>).map((x) => latLng2xy(x) as L.Point);
            } else {
                return L.point((input as [number, number])[1] * scale, -(input as [number, number])[0] * scale);
            }
        } else {
            return L.point(input.lng * scale, -input.lat * scale);
        }
    }, [scale]);
    
    return <ImageContext.Provider value={{
            latLng2xy,
            xy2latLng,
        annotationsHook: { ...hook, create, delete:_delete },
        annoCount,
        startLoadingTimestamp,
        visibleTimestamp,
        fullyLoadedTimestamp,
        setVisibleTimestamp,
        setFullyLoadedTimestamp,
        zoom,
        setZoom,
    }}>
        {children}
    </ImageContext.Provider>
}