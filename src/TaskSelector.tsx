import { useContext, useState, useEffect } from "react";
import AnnotationImage from "./AnnotationImage";
import { RegisterPair } from "./RegisterPair";
import { GlobalContext } from "./Context";
/* In the current implementation, we can push both registration and annotation tasks to the same queue. The task of the TaskSelector component is to identify based on 
the props that were passed whether we are dealing with an annotation or registration task and instantiate the correct component to display the task*/

interface TaskSelectorProps {
  width?: number;
  [key: string]: any;
}

const array2Matrix = (hc: number[] | null): number[][] | null => {
  if (hc && hc.length == 9) {
    const matrix = [];
    while (hc.length) matrix.push(hc.splice(0, 3));
    return matrix;
  } else {
    return null;
  }
};

export function TaskSelector(props: TaskSelectorProps) {
  const { client } = useContext(GlobalContext)!;
  const [element, setElement] = useState<JSX.Element | null>(null);
  
  useEffect(() => {
    console.log('taskselector props', props);
    if (props.location) {
      setElement(<AnnotationImage {...props} />);
    } else {
      client.models.ImageNeighbour.get({ image1Id: props.images[0], image2Id: props.images[1] }, {selectionSet: ['homography', 'image1.*', 'image2.*'] })
        .then(({ data: { homography, image1, image2 } }) => {
          setElement(<RegisterPair {...props}
            homography={array2Matrix(homography)}
            images={[image1, image2]} />)
        });
    }
  }, [props]);
  // const { location, ...restProps } = props;
  // const annotationProps = { 
  //   ...restProps, 
  //   height: 100, 
  //   x: 0, 
  //   y: 0, 
  //   image: { key: 'default.png', width: 100, height: 100 },
  //   width: width || 100,
  //   next: () => {},  
  //   prev: () => {},  
  //   fullImage: true,  
  //   visible: true,  
  //   id: 'defaultId',  
  //   ack: () => {},  
  //   setId: 'defaultSetId',
  //   locationId: '',  
  //   annotationSetId: '',  
  // };

  // const registerPairProps = {
  //   ...restProps,
  //   images: [],  
  //   selectedSet: '',  
  //   next: () => {},  
  //   prev: () => {},  
  //   visible: true,  
  //   ack: () => {},  
  // };

  return element;
}
