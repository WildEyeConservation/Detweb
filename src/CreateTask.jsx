import React, { useContext, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import { UserContext } from './UserContext';
import { createLocation, createLocationSet } from './graphql/mutations';
import { getImagesInSet} from './gqlQueries'
import { useUpdateProgress } from './useUpdateProgress'
import {ImageSetDropdown} from './ImageSetDropDown'

function CreateTask({show,handleClose}) {
  const [sidelap,setSidelap]=useState(-1000)
  const [overlap,setOverlap]=useState(-1000)
  const [width,setWidth]=useState(1024)
  const [name,setName]=useState("")
  const [height,setHeight]=useState(1024)
  const [modelGuided,setModelGuided]=useState(false)
  const {currentProject,gqlSend} = useContext(UserContext)
  const [selectedSets,selectSets]=useState([])
  const [setImagesCompleted,setTotalImages] = useUpdateProgress({
    taskId:`Create task (model guided)`,
    indeterminateTaskName: `Loading images`,
    determinateTaskName:'Processing images',
    stepName:'images'})
  const [setLocationsCompleted,setTotalLocations] = useUpdateProgress({
    taskId:`Create task`,
    indeterminateTaskName: `Loading locations`,
    determinateTaskName:'Processing locations',
    stepName:'locations'})
  
  const {gqlGetMany,backend,sendToQueue} = useContext(UserContext)

  async function handleSubmit(){
      // const client=new SNSClient({
      //   region: awsExports.aws_project_region,
      //   credentials: Auth.essentialCredentials(credentials)
      // })
      // const client = new SQSClient({region: backend.ProjectRegion, 
      //   credentials: Auth.essentialCredentials(credentials)
      // });
      handleClose();
      //const images=await gqlClient.graphql({query: listImages,variables:{filter:{projectImageName:{eq:currentProject}}}})
      setTotalImages(0)
      let images = []
      for (const selectedSet of selectedSets){
        images=images.concat(await gqlGetMany(getImagesInSet,{name:selectedSet},setImagesCompleted))
      }
      setImagesCompleted(0)
      const {data:{createLocationSet:{id: locationSetId}}} = await gqlSend(createLocationSet,{input:{name,projectName:currentProject}});    
      if (modelGuided){
        setTotalImages(images.length)
        for (const {image} of images){
          sendToQueue(
            {QueueUrl: backend["detweb-stack-develop"].cpuTaskQueueUrl,
              MessageGroupId : crypto.randomUUID(),
              MessageDeduplicationId : crypto.randomUUID(),
              MessageBody: JSON.stringify({key:image.key,width:1024,height:1024,threshold:0.99,bucket:backend["detweb-stack-develop"].outputsBucketOut,setId:locationSetId})})
              .then(()=>setImagesCompleted(s=>s+1))
          }
      }else{
        const promises=[]
        let totalSteps=0
        for (const {image} of images){
          const xSteps=Math.ceil((image.width-width)/(width-sidelap))
          const ySteps=Math.ceil((image.height-height)/(height-overlap))
          const xStepSize=(image.width-width)/xSteps
          const yStepSize=(image.height-height)/ySteps
          totalSteps+=(xSteps+1)*(ySteps+1)
          for (var xStep=0;xStep<xSteps+1;xStep++){
            for (var yStep=0;yStep<ySteps+1;yStep++){
              const x=Math.round(xStep*(xStepSize?xStepSize:0)+width/2)
              const y=Math.round(yStep*(yStepSize?yStepSize:0)+height/2)
              promises.push(gqlSend(createLocation,{input:{x,y,width,height,imageKey:image.key,setId:locationSetId}})
                  .then(()=>setLocationsCompleted(fc=>fc+1)))
              }
            }
          }
          setTotalLocations(totalSteps)
          await Promise.all(promises)
        }
      }

  return <Modal show={show} onHide={handleClose }>
    <Modal.Header closeButton>
      <Modal.Title>Create Task</Modal.Title>
    </Modal.Header>
    <Modal.Body>
    <Form>
    <Form.Group>
    <Form.Check // prettier-ignore
        type="switch"
        id="custom-switch"
        label="Model guided annotation"
        value={modelGuided}
        onChange={(x)=>{console.log(x.target.checked);setModelGuided(x.target.checked)}}
      />      
      </Form.Group>
      <Form.Label>Image Sets to process</Form.Label>
      <ImageSetDropdown setImageSets={selectSets} selectedSets={selectedSets}/>
      {/* <Form.Label>Image Set to process</Form.Label>
      <Form.Select onChange={(e)=>{selectSet(e.target.value)}} value={selectedSet}>  
      {!selectedSet && <option value="none">Select an image set to apply the processing to:</option>}
      {imageSets?.map( q => <option key={q.name} value={q.name}>{q.name}</option>)} 
      </Form.Select>   */}
      {modelGuided ? 
      <Form.Group>
      <Form.Label>Threshold</Form.Label>
      <Form.Range label="Threshold"/>
      {/* <Form.Label>Model</Form.Label>
      <Form.Select aria-label="Select AI model to use to guide annotation">
      <option>Select AI model to use to guide annotation</option>
      <option value="1">Elephant detection (nadir)</option>
      </Form.Select> */}
      </Form.Group>
      :
      <>
      <Form.Group>
      <Form.Label>Width</Form.Label>
      <Form.Control type="number" value={width} onChange={(x)=>setWidth(x.target.value)}/>  
      </Form.Group>
      <Form.Group>
      <Form.Label>Height</Form.Label>
      <Form.Control type="number" value={height} onChange={(x)=>setHeight(x.target.value)}/>  
      </Form.Group>
      <Form.Group>
      <Form.Label>Minimum overlap</Form.Label>
      <Form.Control type="number" value={overlap} onChange={(x)=>setOverlap(x.target.value)}/>  
      </Form.Group>
      <Form.Group>
      <Form.Label>Minimum sidelap</Form.Label>
      <Form.Control type="number" value={sidelap} onChange={(x)=>setSidelap(x.target.value)}/>  
      </Form.Group>
      </>}
      <Form.Group>
      <Form.Label>Task Name</Form.Label>
      <Form.Control type="string" value={name} onChange={(x)=>setName(x.target.value)}/>  
      </Form.Group>
    </Form>
    </Modal.Body>
    <Modal.Footer>
    <Button variant="primary" onClick={handleSubmit} disabled={name.length==0}>
        Submit 
      </Button>
      <Button variant="primary" onClick={handleClose}>
        Cancel 
      </Button>
    </Modal.Footer>
  </Modal>;
}

export default CreateTask