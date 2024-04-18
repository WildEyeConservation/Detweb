import React,{useContext, useState} from 'react';
import { Stack,Modal,Form,Button } from 'react-bootstrap';
import { UserContext } from './UserContext';
import { QueueDropdown } from './QueueDropDown';
import { useUpdateProgress } from './useUpdateProgress';
import { AnnotationSetDropdown } from './AnnotationSetDropDown';
import {getImage,imageNeighboursByImage1key,imageNeighboursByImage2key,annotationsByImageKey} from './graphql/queries'

function LaunchRegistration({show,handleClose}) {
  const [url,setUrl]=useState(undefined)
  const [annotationSet,setAnnotationSet]=useState(undefined)
  const {sendToQueue,gqlSend} = useContext(UserContext)
  const [setStepsCompleted,setTotalSteps] = useUpdateProgress({
    taskId:`Launch registration task`,
    indeterminateTaskName: `Finding images with annotations`,
    determinateTaskName:'Enqueueing pairs',
    stepName:'locations'})  
  const pairsSubmitted=new Set()
  
    const array2Matrix=(hc)=>{
      if (hc){
      const matrix = [];
      while(hc.length) matrix.push(hc.splice(0,3));
      return matrix}else{
        return null
      }
    }

    const handlePair = async (neighbours,annos) => {
      for (const pair of neighbours) {
        if (!pairsSubmitted.has(pair.id)) {
          pairsSubmitted.add(pair.id);
          const homography = array2Matrix(pair.homography);
          // if (homography){
          //   const anno1=annos[pair.image1key]
          //   const anno2=annos[pair.image2key]
          //   console.log(anno1)
          // }
          if (homography){
            await sendToQueue({
              QueueUrl: url,
              MessageGroupId: crypto.randomUUID(),
              MessageDeduplicationId: crypto.randomUUID(),
              MessageBody: JSON.stringify(
                {
                  key: pair.image1key + pair.image2key,
                  selectedSet: annotationSet,
                  images: await Promise.all([pair.image1key, pair.image2key].map(async (key) => await gqlSend(getImage, { key }).then(({ data: { getImage: image } }) => image))),
                  homography: homography
                })
            });
          }
        }
      }
    };

  async function handleSubmit(){       
    handleClose();
    const query=`query MyQuery($nextToken: String, $annotationSetId: ID!) {
      annotationsByAnnotationSetId(annotationSetId: $annotationSetId, nextToken: $nextToken) {
        items {
          obscured
          image {
            timestamp
            key
          }
        }
        nextToken
      }
    }
    `  
    let nextToken=undefined
    const images=new Object()
    do{
      let annotations;
      ({data:{annotationsByAnnotationSetId:{items:annotations,nextToken}}}=await gqlSend(query,{nextToken,annotationSetId:annotationSet}))
      setStepsCompleted(i=>i+annotations.length)
      for (const {obscured,image:{key,timestamp}} of annotations){
          if (!obscured){
            images[timestamp]=key
          }
      }  
    } while (nextToken)
    setStepsCompleted(0)
    setTotalSteps(Object.keys(images).length)

    const sortedTimestamps=Object.keys(images).sort()
    const annos={}
    // for (const timestamp of sortedTimestamps){
    //   nextToken=null
    //   do{
    //     const data=await gqlSend(annotationsByImageKey,{imageKey:images[timestamp],nextToken})
    //     annos[images[timestamp]]=data.data.annotationsByImageKey.items
    //   }while (nextToken)
    //   setStepsCompleted(i=>i+1)
    // }
    setTotalSteps(Object.keys(images).length)
    setStepsCompleted(0)
    for (const timestamp of sortedTimestamps){
      const { data: { imageNeighboursByImage2key: { items: neighbours1 } } } = await gqlSend(imageNeighboursByImage2key,{image2key:images[timestamp]})
      await handlePair(neighbours1,annos)
      const { data: { imageNeighboursByImage1key: { items: neighbours2 } } } = await gqlSend(imageNeighboursByImage1key,{image1key:images[timestamp]})
      await handlePair(neighbours2,annos)
      setStepsCompleted(x=>x+1)
    }

    // const tempBuffer= await Promise.all(Object.keys(pairs)?.map(
    //   async id=>{
    //     const pair=pairs[id];
    //     const homography=array2Matrix(pair.homography)
    //     return {key        : pair.image1key+pair.image2key,
    //             images     : await Promise.all([pair.image1key,pair.image2key].map(async key=>await gqlSend(getImage,{key}).then(({data:{getImage:image}})=>image))),
    //             transforms : [transform(homography),transform(inv(homography))]
    //             }}))
    //   tempBuffer.sort((a,b)=>a.key>b.key ? 1 : -1)
    // setBuffer(tempBuffer)
  }

  return <Modal show={show} onHide={handleClose }>
    <Modal.Header closeButton>
      <Modal.Title>Launch Registration Task</Modal.Title>
    </Modal.Header>
    <Modal.Body>
    <Form>
      <Stack gap={4}>
      <Form.Group>
      <Form.Label>Annotation Set</Form.Label>
      <AnnotationSetDropdown setAnnotationSet={setAnnotationSet} selectedSet={annotationSet} canCreate={false}/> 
      </Form.Group>
      <Form.Group>
      <Form.Label>Target Queue</Form.Label>
      <QueueDropdown setQueue={setUrl} currentQueue={url}/>
      </Form.Group>
      </Stack>
    </Form>
    </Modal.Body>
    <Modal.Footer>
    <Button variant="primary" onClick={handleSubmit} disabled={!annotationSet || !url}>
        Submit 
      </Button>
      <Button variant="primary" onClick={handleClose}>
        Cancel 
      </Button>
    </Modal.Footer>
  </Modal>;
}

export default LaunchRegistration