import AnnotationImage from './AnnotationImage';
import { RegisterPair } from './RegisterPair';
import React from 'react';


/* In the current implementation, we can push both registration and annotation tasks to the same queue. the Task of the TaskSelector component is to identify based on 
the props that were passed wether we are dealing with an annotation or registration task and instantiate the correct component to display the task*/

export function TaskSelector(props){
    const {width}=props
    return width ?  <AnnotationImage {...props}/> : <RegisterPair {...props}/>
}

