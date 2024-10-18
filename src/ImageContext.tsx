import { useCallback } from "react";
import { ImageContext, ImageContextType } from "./Context";
import type { ImageType } from "./schemaTypes";
import type { AnnotationsHook } from "./Context";
import L from "leaflet";

export function ImageContextFromHook({ hook, image, children }: { hook: AnnotationsHook, image: ImageType, children: React.ReactNode }) {

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
            annotationsHook: hook
        }}>
        {children}
    </ImageContext.Provider>
}