import React, { useEffect, useContext, useState } from 'react';
import { GlobalContext } from './Context';
import OverlapOutline from './OverlapOutline';
import { ImageType } from './schemaTypes';
import { multiply, inv} from "mathjs";
import { makeTransform, array2Matrix } from './utils';
interface OverlapLoaderProps {
    image: ImageType;
    loadPrevious: boolean;
}

const OverlapLoader: React.FC<OverlapLoaderProps> = ({ image, loadPrevious = false }) => {
    const { client } = useContext(GlobalContext)!;
    const [transform, setTransform] = useState<((c1: [number, number]) => [number, number]) | null>(null);

    useEffect(() => {
        async function loadOverlap() {
            let neighbours;
            if (!loadPrevious) {
                neighbours = await client.models.ImageNeighbour.imageNeighboursByImage1key({ image1Id: image.id })
            } else {
                neighbours = await client.models.ImageNeighbour.imageNeighboursByImage2key({ image2Id: image.id })
            } 
            if (neighbours.data.length && neighbours.data[0].homography.length) {
                const H = array2Matrix(neighbours.data[0].homography);
                if (H) {
                    const f = loadPrevious? makeTransform(H) : makeTransform(inv(H));
                    setTransform(()=>f);
                }
            }
        }
        loadOverlap();
    }, [image]);

  return transform && <OverlapOutline transform={transform} image={image} />
};

export default OverlapLoader;
