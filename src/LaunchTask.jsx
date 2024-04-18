import React,{useContext, useState} from 'react';
import { Stack,Modal,Form,Button } from 'react-bootstrap';
import { UserContext } from './UserContext';
import { getLocationsInSet } from './gqlQueries';
import { QueueDropdown } from './QueueDropDown';
import { useUpdateProgress } from './useUpdateProgress';
import { AnnotationSetDropdown } from './AnnotationSetDropDown';
import { LocationSetDropdown } from './LocationSetDropDown';
function LaunchTask({show,handleClose}) {
  const [url,setUrl]=useState(undefined)
  const [url2,setUrl2]=useState(undefined)
  const [annotationSet,setAnnotationSet]=useState(undefined)
  const [locationSet,setLocationSet]=useState(undefined)
  const [filterObserved, setFilterObserved]=useState(false)
  const [secondaryQueue,setSecondaryQueue]=useState(false)
  const {sendToQueue,gqlSend,gqlGetMany} = useContext(UserContext)
  const [setStepsCompleted,setTotalSteps] = useUpdateProgress({
    taskId:`Launch task`,
    indeterminateTaskName: `Loading locations`,
    determinateTaskName:'Enqueueing locations',
    stepName:'locations'})

  const checkForObservations=`
  query MyQuery($locationId: ID!) {
    observationsByLocationId(locationId: $locationId) {
      items {
        id
      }
    }
  }`

  async function handleSubmit(){       
    handleClose();
    const promises =[]
    setTotalSteps(0)
    const locations= await gqlGetMany(getLocationsInSet,{id:locationSet},setStepsCompleted)
    setStepsCompleted(0)
    setTotalSteps(locations.length)
    let queued=0
    for (const location of locations){
      if (filterObserved){
        const {data:{observationsByLocationId:{items}}} = await gqlSend(checkForObservations,{locationId:location.id})
        if (items.length>0){
          setStepsCompleted(fc=>fc+1)
          continue
        }
      }
      location.setId=annotationSet
      location.secondaryQueue = secondaryQueue && url2
      queued+=1
      console.log(`Queueing ${queued}`)
      promises.push(sendToQueue({QueueUrl: url,
          MessageGroupId : crypto.randomUUID(),
          MessageDeduplicationId : crypto.randomUUID(),
          MessageBody: JSON.stringify(location)})
        .then(()=>setStepsCompleted(fc=>fc+1)))
    }
    await Promise.all(promises)
  }

  return <Modal show={show} onHide={handleClose }>
    <Modal.Header closeButton>
      <Modal.Title>Launch Task</Modal.Title>
    </Modal.Header>
    <Modal.Body>
    <Form>
      <Stack gap={4}>
      <Form.Group>
      <Form.Label>Location Set</Form.Label>
      <LocationSetDropdown setLocationSet={setLocationSet} selectedSet={locationSet}/>
      {/* <Form.Select onChange={(e)=>{setLocationSet(e.target.value)}} value={locationSet}>  
      {locationSet =="none" && <option>Select a location set to process:</option>}
      {locationSets?.map( q => <option key={q.id} value={q.id} >{q.name}</option>)}
      </Form.Select>   */}
      </Form.Group>
      <Form.Group>
      <Form.Label>Annotation Set</Form.Label>
      <AnnotationSetDropdown setAnnotationSet={setAnnotationSet} selectedSet={annotationSet}/> 
      <Form.Check 
        type="switch"
        label="Unobserved only"
        checked={filterObserved}
        onChange= {(x)=>setFilterObserved(x.target.checked)}/>
      {/* <Form.Select onChange={(e)=>{if (e.target.value=="new"){onNewAnnotationSet().then(set=>setAnnotationSet(set))} else setAnnotationSet(e.target.value)}} value={annotationSet}>  
      {annotationSet=="none" && <option>Select an annotation set to apply the processing to:</option>}<option value="new">Add new Annotation Set</option>
      {annotationSets?.map( q => <option key={q.id} value={q.id} >{q.name}</option>)}
      </Form.Select>  */}
      </Form.Group>
      <Form.Group>
      <Form.Label>Target Queue</Form.Label>
      <QueueDropdown setQueue={setUrl} currentQueue={url}/>
      </Form.Group>
      <Form.Group>
      <Form.Check // prettier-ignore
        type="switch"
        id="custom-switch"
        label="Send Detections to secondary queue"
        checked={secondaryQueue}
        onChange={(x)=>{setSecondaryQueue(x.target.checked)}}
      />
      {secondaryQueue && <Form.Group>
      <Form.Label>Secondary queue</Form.Label>
      <QueueDropdown setQueue={setUrl2} currentQueue={url2}/>
      </Form.Group>}
      </Form.Group>
      </Stack>
    </Form>
    </Modal.Body>
    <Modal.Footer>
    <Button variant="primary" onClick={handleSubmit} disabled={!locationSet || !annotationSet || !url}>
        Submit 
      </Button>
      <Button variant="primary" onClick={handleClose}>
        Cancel 
      </Button>
    </Modal.Footer>
  </Modal>;
}

export default LaunchTask