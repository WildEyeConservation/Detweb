import { useCallback , useState,useContext,useEffect} from "react";
import { ImageContext, UserContext, GlobalContext } from "./Context";
import type { ImageType } from "./schemaTypes";
import type { AnnotationsHook } from "./Context";
import L from "leaflet";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { inv } from "mathjs";
import { array2Matrix, makeTransform } from "./utils";

export function ImageContextFromHook({ hook, locationId, image, children, secondaryQueueUrl, taskTag }: { hook: AnnotationsHook, locationId: string, image: ImageType, children: React.ReactNode,secondaryQueueUrl?:string,taskTag:string }) {
    const [annoCount, setAnnoCount] = useState(0)
    const {client} = useContext(GlobalContext);
    const [startLoadingTimestamp, _] = useState<number>(Date.now())

    const [visibleTimestamp, setVisibleTimestamp] = useState<number | undefined>(undefined)
    const [fullyLoadedTimestamp, setFullyLoadedTimestamp] = useState<number | undefined>(undefined)
    const {getSqsClient} = useContext(UserContext);
    const [zoom, setZoom] = useState(1)
    const [transformToPrev, setTransformToPrev] = useState<((c1: [number, number]) => [number, number]) | null>(null);
    //testing
    const { setCurrentAnnoCount, setCurrentTaskTag} = useContext(UserContext)!;

    useEffect(() => {
        setCurrentTaskTag(taskTag);
    }, []);

    useEffect(() => {
        client.models.ImageNeighbour.imageNeighboursByImage2key({ image2Id: image.id }).then((neighbours) => {
            if (neighbours?.data[0]?.homography)
                setTransformToPrev(() => makeTransform(inv(array2Matrix(neighbours.data[0].homography))));
        })
    }, [image])
  

    const create = useCallback((annotation) => {
        // Create an objectID if this is the primary observation (first time this object was observed)
        if (transformToPrev) {
            const transformedPoint = transformToPrev([annotation.x, annotation.y]);
            if (!(transformedPoint[0] >= 0 && transformedPoint[0] <= image.width && transformedPoint[1] >= 0 && transformedPoint[1] <= image.height)) {
                annotation.id=crypto.randomUUID()
                //annotation.objectId = annotation.id;
            }
        }
        if (secondaryQueueUrl) {
            getSqsClient().then(sqsClient => sqsClient.send(new SendMessageCommand({
                QueueUrl: secondaryQueueUrl,
                MessageBody: JSON.stringify({location:{id: locationId, x:annotation.x,y:annotation.y,width:100,height:100,image,annotationSetId:annotation.setId},allowOutside:true,zoom,taskTag: taskTag ? taskTag + ' - Secondary' : 'Secondary'})
            })));
        }
        setAnnoCount(old=>old + 1)

        setCurrentAnnoCount(old=>{
            const newCount = {...old};
            newCount[annotation.categoryId] = (newCount[annotation.categoryId] || []).concat([{x:annotation.x,y:annotation.y}]);
            return newCount;

        });
        return hook.create(annotation)
    }, [hook.create,setAnnoCount,secondaryQueueUrl,zoom,taskTag])

    const update = useCallback((annotation) => {
        // Create an objectID if this is the primary observation (first time this object was observed)
        if (transformToPrev && annotation.x && annotation.y && !annotation.shadow) {
            const transformedPoint = transformToPrev([annotation.x, annotation.y]);
            if (!(transformedPoint[0] >= 0 && transformedPoint[0] <= image.width && transformedPoint[1] >= 0 && transformedPoint[1] <= image.height)) {
                annotation.objectId = annotation.id;
            } 
        }
        if (secondaryQueueUrl) {
            getSqsClient().then(sqsClient => sqsClient.send(new SendMessageCommand({
                QueueUrl: secondaryQueueUrl,
                MessageBody: JSON.stringify({location:{id: locationId, x:annotation.x,y:annotation.y,width:100,height:100,image,annotationSetId:annotation.setId},allowOutside:true,zoom,taskTag: taskTag ? taskTag + ' - Secondary' : 'Secondary'})
            })));
        }

        const oldAnnotation = hook.data.find((a) => a.id === annotation.id);

        setCurrentAnnoCount(old=>{
            const newCount = {...old};
            newCount[oldAnnotation!.categoryId] = (newCount[oldAnnotation!.categoryId] || []).filter((a) => a.x !== oldAnnotation!.x && a.y !== oldAnnotation!.y);
            newCount[annotation.categoryId] = (newCount[annotation.categoryId] || []).concat([{x:annotation.x || oldAnnotation!.x,y:annotation.y || oldAnnotation!.y}]);
            return newCount;
        });
        const { shadow, proposedObjectId, image, object, project, set, createdAt, updatedAt,owner,category,id, ...annoStripped } = annotation;
        return hook.update({...annoStripped, id})
    }, [hook.create,setAnnoCount,secondaryQueueUrl,zoom,taskTag])


    const _delete = useCallback((annotation) => {
        setAnnoCount(old=>old - 1)
        setCurrentAnnoCount(old=>{
            const newCount = {...old};
            newCount[annotation.categoryId] = (newCount[annotation.categoryId] || []).filter((a) => a.x !== annotation.x && a.y !== annotation.y);
            return newCount;
        });
        return hook.delete(annotation)
    }, [hook.delete,setAnnoCount,setCurrentAnnoCount])

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
        annotationsHook: { ...hook, create,update, delete:_delete },
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