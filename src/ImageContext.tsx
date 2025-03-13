import { useCallback , useState,useContext,useEffect, useMemo} from "react";
import { ImageContext, UserContext, GlobalContext } from "./Context";
import type { ImageType } from "./schemaTypes";
import type { AnnotationsHook } from "./Context";
import L from "leaflet";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { inv } from "mathjs";
import { array2Matrix, makeTransform } from "./utils";
import { useQueries, useQuery } from "@tanstack/react-query";


export function ImageContextFromHook({ hook, locationId, image, children, secondaryQueueUrl, taskTag }: { hook: AnnotationsHook, locationId: string, image: ImageType, children: React.ReactNode,secondaryQueueUrl?:string,taskTag:string }) {
    const [annoCount, setAnnoCount] = useState(0)
    const {client} = useContext(GlobalContext);
    const [startLoadingTimestamp, _] = useState<number>(Date.now())
    const [visibleTimestamp, setVisibleTimestamp] = useState<number | undefined>(undefined)
    const [fullyLoadedTimestamp, setFullyLoadedTimestamp] = useState<number | undefined>(undefined)
    const {getSqsClient} = useContext(UserContext);
    const [zoom, setZoom] = useState(1)
    //testing
    const { setCurrentAnnoCount, setCurrentTaskTag } = useContext(UserContext)!;
    
    // imageNeighboursQueries contains a list of queries that fetch the neighbours of each image.
    const prevNeighboursQuery = useQuery({
        queryKey: ['prevNeighbours', image.id],
        queryFn: () => {
        return client.models.ImageNeighbour.imageNeighboursByImage2key({ image2Id: image.id })
        },
        staleTime: Infinity, // Data will never become stale automatically
        cacheTime: 1000 * 60 * 60, // Cache for 1 hour
    })

    const prevNeighbours = useMemo(() => {
        //return a dictionary using the image1Id as the key and the transform as the value
        return prevNeighboursQuery.data?.data?.reduce((acc, n) => {
            if (n.homography) {
                acc[n.image1Id] = {fwd: makeTransform(inv(array2Matrix(n.homography))), bwd: makeTransform(array2Matrix(n.homography))};
            }else{
                acc[n.image1Id] = {fwd: undefined, bwd: undefined};
            }
            return acc;
        }, {} as Record<string, {fwd: ((c1: [number, number]) => [number, number]), bwd: ((c1: [number, number]) => [number, number])}>);
    }, [prevNeighboursQuery.data])

    const nextNeighboursQuery = useQuery({
        queryKey: ['nextNeighbours', image.id],
        queryFn: () => {
        return client.models.ImageNeighbour.imageNeighboursByImage1key({image1Id:image.id});
        },
        staleTime: Infinity, // Data will never become stale automatically
        cacheTime: 1000 * 60 * 60, // Cache for 1 hour
    })  

    const nextNeighbours = useMemo(() => {
        //return a dictionary using the image2Id as the key and the transform as the value
        return nextNeighboursQuery.data?.data?.reduce((acc, n) => {
            acc[n.image2Id] = {fwd: makeTransform(array2Matrix(n.homography)), bwd: makeTransform(inv(array2Matrix(n.homography)))};
            return acc;
        }, {} as Record<string, {fwd: ((c1: [number, number]) => [number, number]), bwd: ((c1: [number, number]) => [number, number])}>);
    }, [nextNeighboursQuery.data])

    const imageMetaDataQueries = useQueries({
        queries: [...Object.keys(prevNeighbours || {}), image.id, ...Object.keys(nextNeighbours || {})].map((n) => ({
            queryKey: ['imageMetaData', n],
            queryFn: () => {
                return client.models.Image.get({id: n});
            },
            staleTime: Infinity, // Data will never become stale automatically
            cacheTime: 1000 * 60 * 60, // Cache for 1 hour
        }))
    });

    const imageMetaData = useMemo(() => {
        return imageMetaDataQueries.filter(q => q.isSuccess).map(q => q.data.data);
    }, [imageMetaDataQueries])

    const prevImages = useMemo(() => {
        const prevImages = imageMetaData?.filter(i => Object.keys(prevNeighbours || {}).includes(i.id)).sort((a, b) => b.timestamp - a.timestamp);
        return prevImages?.map(i => ({ image: i, transform: prevNeighbours?.[i.id] }))
    }, [imageMetaData, prevNeighbours])

    const nextImages = useMemo(() => {
        const nextImages = imageMetaData?.filter(i => Object.keys(nextNeighbours || {}).includes(i.id)).sort((a, b) => a.timestamp - b.timestamp);
        return nextImages?.map(i => ({ image: i, transform: nextNeighbours?.[i.id] }))
    }, [imageMetaData, nextNeighbours])

    const queriesComplete = imageMetaDataQueries.every(q => q.isSuccess) && prevNeighboursQuery.isSuccess && nextNeighboursQuery.isSuccess;

    useEffect(() => {
        setCurrentTaskTag(taskTag);
    }, []);
  
    const create = useCallback((annotation) => {
        //Check if this annotation maps to the interior of any of the previous images
        const insidePreviousImage = prevImages.reduce((acc, im) => {
            const transformedPoint = im.transform.fwd([annotation.x, annotation.y]);
            if ((transformedPoint[0] >= 0 && transformedPoint[0] <= im.image.width && transformedPoint[1] >= 0 && transformedPoint[1] <= im.image.height)) {
                return true;
            }
            return acc;
        }, false)
        // Create an objectID only if this is the primary observation (first time this object was observed)
        if (!insidePreviousImage) {
            annotation.id = crypto.randomUUID()
            annotation.objectId = annotation.id;
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
        const { shadow, proposedObjectId, image, object, project, set, createdAt, updatedAt, owner, category, id, ...annoStripped } = annotation;
        if (shadow) {
            //Check if this annotation maps to the interior of any of the previous images
            const insidePreviousImage = prevImages.reduce((acc, im) => {
                const transformedPoint = im.transform.fwd([annotation.x, annotation.y]);
                if ((transformedPoint[0] >= 0 && transformedPoint[0] <= im.image.width && transformedPoint[1] >= 0 && transformedPoint[1] <= im.image.height)) {
                    return true;
                }
                return acc;
            }, false)
            if (!insidePreviousImage) {
                return hook.create({...annoStripped, id: proposedObjectId})
            }
            else {
                return hook.create({ ...annoStripped, objectId: annoStripped.objectId || proposedObjectId})
            }
        } else {
            return hook.update({ ...annoStripped, id, objectId: annoStripped.objectId || proposedObjectId})
        }
        
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
        prevImages,
        nextImages,
        queriesComplete
    }}>
        {children}
    </ImageContext.Provider>
}