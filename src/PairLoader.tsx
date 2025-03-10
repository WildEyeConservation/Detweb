import { useParams } from 'react-router-dom';
import { useContext, useEffect, useState } from 'react';
import { GlobalContext } from './Context';
import { RegisterPair } from './RegisterPair';
import { array2Matrix, makeTransform } from "./utils";
import { inv } from 'mathjs';

export function PairLoader() {
  const { image1Id,image2Id,selectedSet } = useParams();
  const [element, setElement] = useState<JSX.Element | null>(null);
  const { client } = useContext(GlobalContext)!;
  
  useEffect(() => {
    client.models.ImageNeighbour.get({ image1Id, image2Id }, {selectionSet: ['homography', 'image1.*', 'image2.*'] })
      .then(({ data: { homography, image1, image2 } }) => {
        const homographyMatrix = array2Matrix(homography);
        const transforms = homographyMatrix ? [makeTransform(homographyMatrix), makeTransform(inv(homographyMatrix))] : null;
      setElement(<RegisterPair 
        transforms={transforms}
        visible={true}
        selectedSet={selectedSet!}
        images={[image1, image2]} />)
    });
  }, [image1Id, image2Id, selectedSet]);
    
    return element;
}