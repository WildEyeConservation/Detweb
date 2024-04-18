import React, {useState, useEffect, useContext} from 'react';
import './Registration.css'
import BaseImage from './BaseImage'
//import Legend from "./Legend";
import CreateAnnotationOnClick from './CreateAnnotationOnClick';
import { AnnotationSetDropdown } from './AnnotationSetDropDown';
import { Stack } from 'react-bootstrap';
import { useAnnotations } from './useGqlCached';
import { UserContext } from './UserContext';
// import CreateBatchRectangle from './createBatchRectangle';

/**
 * Registration is a component that is responsible for rendering the registration page of the Detweb interface.
 * @component
 *
 */

function Review(){
  const [images,setImages]=useState(undefined)
  const [selectedAnnotationSet,selectAnnotationSet]=useState(undefined)
  const {gqlSend}=useContext(UserContext)
  const [index,setIndex]=useState(0)

  const getAnnotations=`query MyQuery($annotationSetId: ID!, $nextToken: String, $filter: ModelAnnotationFilterInput = {}) {
    annotationsByAnnotationSetId(annotationSetId: $annotationSetId, nextToken: $nextToken, filter: $filter) {
      nextToken
      items {
        imageKey,
        image{
          width,
          height,
          timestamp
        }
      }
    }
  }
  `

  //This effect is responsible for finding all the relevant images to display
  useEffect(()=>{
    const go = async ()=>{
      let nextToken=undefined
      const images={}
      do{
        let annotations;
        const res=await gqlSend(getAnnotations,{annotationSetId:selectedAnnotationSet,nextToken});
        ({data:{annotationsByAnnotationSetId:{items:annotations,nextToken}}}=res)
        for (const {imageKey,image} of annotations){
          images[imageKey]=image
        }  
      } while (nextToken)
      setImages(Object.keys(images).sort().map(x=>{return {...(images[x]),key:x}}))
      setIndex(0)
    } 
    if (selectedAnnotationSet) go()
//.then(({data:{listImageNeighbours:{items:p}}})=>setPairs(p))
  },[selectedAnnotationSet])

    const annotationsHook = useAnnotations(images?.[index]?.key,selectedAnnotationSet)
    
    //const annhash=hash([annotationsHooks?.[0]?.annotations,annotationsHooks?.[1]?.annotations])

return <Stack gap={3}>
      <AnnotationSetDropdown setAnnotationSet={selectAnnotationSet} selectedSet={selectedAnnotationSet} canCreate={false}/>
      {/* <CategoriesDropdown setSelectedCategories={setSelectedCategories} selectedSet={selectedCategories}/> */}
      <div className='d-flex flex-column flex-grow-1'>
      <div className='d-flex flex-row flex-grow-1' >
                {images &&  
                <BaseImage setId={selectedAnnotationSet} key={images[index].key} boundsxy={[[0, 0],[images[index].width, images[index].height]]}
                     containerwidth='90vw'
                     containerheight='80vh'
                     image={images[index]}
                     x={images[index].width/2}
                     y={images[index].height/2}
                     width={images[index].width}
                     height={images[index].height}
                     center_xy={[0,0]}
                     onNext={index<images.length-1 ? ()=>{setIndex(i=>i+1)}:undefined}
                     onPrev={index>0              ? ()=>{setIndex(i=>i-1)}:undefined}
                  >
                    {/* <CreateBatchRectangle setId={selectedAnnotationSet} image={images[index]} annotationsHook={annotationsHook}/> */}
                   <CreateAnnotationOnClick setId={selectedAnnotationSet} image={images[index]} annotationsHook={annotationsHook}/> 
                  </BaseImage>} 
                <br/>
        </div>
    </div>
    </Stack>
  }

export default Review