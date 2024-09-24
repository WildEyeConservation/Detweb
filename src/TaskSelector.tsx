import AnnotationImage from "./AnnotationImage";
import { RegisterPair } from "./RegisterPair";

/* In the current implementation, we can push both registration and annotation tasks to the same queue. The task of the TaskSelector component is to identify based on 
the props that were passed whether we are dealing with an annotation or registration task and instantiate the correct component to display the task*/

interface TaskSelectorProps {
  width?: number;
  [key: string]: any;
}

export function TaskSelector(props: TaskSelectorProps) {
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

  return props.location ? <AnnotationImage {...props} /> : <RegisterPair {...props} />;
}
