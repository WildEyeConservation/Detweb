import React, { useEffect, useContext, useState } from 'react';
import { GlobalContext } from './Context';
import OverlapOutline from './OverlapOutline';
import { ImageType } from './schemaTypes';
import { multiply, inv} from "mathjs";
import { makeTransform, array2Matrix } from './utils';
import { LayersControl, LayerGroup } from 'react-leaflet';

interface OverlapsLoaderProps {
    image: ImageType;
}

const OverlapsLoader: React.FC<OverlapsLoaderProps> = ({ image}) => {
    const { client } = useContext(GlobalContext)!;
    const [overlaps, setOverlaps] = useState<{transform: ((c1: [number, number]) => [number, number]) | null, image: ImageType}[]>([]);

    useEffect(() => {
        async function loadOverlaps() {
            const prevNeighbours = (await client.models.ImageNeighbour.imageNeighboursByImage1key({ image1Id: image.id })).data
                .filter(n => n.homography)
                .map(async n => { return { transform: makeTransform(inv(array2Matrix(n.homography))), image: (await n.image2()).data } });
            const nextNeighbours = (await client.models.ImageNeighbour.imageNeighboursByImage2key({ image2Id: image.id })).data
                .filter(n => n.homography)
                .map(async n => { return { transform: makeTransform(array2Matrix(n.homography)), image: (await n.image1()).data } });
            const neighbours = [...prevNeighbours, ...nextNeighbours];
            const result = await Promise.all(neighbours);
            result.sort((a, b) => a.image.originalPath.localeCompare(b.image.originalPath));
            setOverlaps(result);
        }
        loadOverlaps();
    }, [image]);

    return <>
        {overlaps.map((overlap, idx) => <LayersControl.Overlay name={`Overlap ${overlap.image.originalPath}`} key={idx} checked={false}>
        <LayerGroup>
        <OverlapOutline transform={overlap.transform} image={overlap.image} />
        </LayerGroup>
        </LayersControl.Overlay>)}
    </>
};

export default OverlapsLoader;
