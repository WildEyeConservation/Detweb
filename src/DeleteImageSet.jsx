import React,{useContext, useState} from 'react';
import { Stack,Modal,Form,Button } from 'react-bootstrap';
import { useUpdateProgress } from './useUpdateProgress';
import { ImageSetDropdown } from './ImageSetDropDown';
import { UserContext } from './UserContext';
import { gqlClient } from './App';
import { graphqlOperation } from './App';

function DeleteImageSet({show,handleClose}) {
  const [selectedSet,selectSet]=useState(undefined)
  const {gqlSend}=useContext(UserContext)
  const [setStepsCompleted,setTotalSteps] = useUpdateProgress({
    taskId:`Deleting Image set`,
    indeterminateTaskName: `Loading image set memberships`,
    determinateTaskName:'Deleting image set memberships',
    stepName:'memberships'})

  const imageSetMembershipsByImageSetName = /* GraphQL */ `
    query ImageSetMembershipsByImageSetName(
      $imageSetName: String!
      $nextToken: String
    ) {
      imageSetMembershipsByImageSetName(
        imageSetName: $imageSetName
        nextToken: $nextToken
      ) {
        items {
          id
        }
        nextToken
      }
    }
  `;
  
  const deleteImageSetMembership =`
  mutation MyMutation($id: ID = "") {
    deleteImageSetMembership(input: {id: $id}) {
      id
    }
  }`;


  const deleteImageSet =`
  mutation MyMutation($name: String = "") {
    deleteImageSet(input: {name: $name}) {
      name
    }
  }`;

  async function handleSubmit(){       
    let nextToken,items,allItems=[]
    handleClose();
    setTotalSteps(0)
    do{
      ({data:{imageSetMembershipsByImageSetName:{nextToken,items}}}=await gqlClient.graphql(graphqlOperation(imageSetMembershipsByImageSetName,{imageSetName:selectedSet,nextToken})))
      allItems=allItems.concat(items)
      setStepsCompleted(allItems.length)
    } while (nextToken)
    setTotalSteps(allItems.length)
    let i=0
    for (const id of allItems){
      await gqlClient.graphql(graphqlOperation(deleteImageSetMembership,id))
      i+=1
      setStepsCompleted(i)
    }
    await gqlSend(deleteImageSet,{name:selectedSet})
  }

  return <Modal show={show} onHide={handleClose }>
    <Modal.Header closeButton>
      <Modal.Title>Delete Image Set</Modal.Title>
    </Modal.Header>
    <Modal.Body>
    <Form>
      <Stack gap={4}>
      <Form.Group>
      <Form.Label>Image Set to delete</Form.Label>
      <ImageSetDropdown setImageSet={selectSet} selectedSet={selectedSet}/>
      </Form.Group>
      </Stack>
    </Form>
    </Modal.Body>
    <Modal.Footer>
    <Button variant="primary" onClick={handleSubmit} disabled={!selectedSet}>
        Submit 
      </Button>
      <Button variant="primary" onClick={handleClose}>
        Cancel 
      </Button>
    </Modal.Footer>
  </Modal>;
}

export default DeleteImageSet