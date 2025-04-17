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
    const loadPair = async (id1: string, id2: string, isReversed: boolean = false) => {
      try {
        const { data: { homography, image1, image2 } } = await client.models.ImageNeighbour.get(
          { image1Id: id1, image2Id: id2 },
          { selectionSet: ['homography', 'image1.*', 'image2.*'] }
        );
        
        const homographyMatrix = array2Matrix(homography);
        const transforms = homographyMatrix ? [
          makeTransform(isReversed ? inv(homographyMatrix) : homographyMatrix),
          makeTransform(isReversed ? homographyMatrix : inv(homographyMatrix))
        ] : null;
        
        setElement(<RegisterPair 
          transforms={transforms}
          visible={true}
          selectedSet={selectedSet!}
          images={isReversed ? [image2, image1] : [image1, image2]} />);
      } catch (error) {
        if (!isReversed) {
          // If first attempt fails, try with reversed parameters
          loadPair(image2Id!, image1Id!, true);
        }
      }
    };

    if (image1Id && image2Id) {
      loadPair(image1Id, image2Id);
    }
  }, [image1Id, image2Id, selectedSet]);
    
  return element;
}