import React, { useContext, useState } from "react";
import { Stack, Modal, Form, Button } from "react-bootstrap";
import { UserContext, GlobalContext,ManagementContext } from "./Context";
import { QueueDropdown } from "./QueueDropDown";
import { AnnotationSetDropdown } from "./AnnotationSetDropdownMulti";
import { fetchAllPaginatedResults } from "./utils";
import { ImageNeighbourType } from "./schemaTypes";
import { SendMessageCommand } from "@aws-sdk/client-sqs";

interface LaunchRegistrationProps {
  show: boolean;
  handleClose: () => void;
  selectedSets: string[];
  setSelectedSets: React.Dispatch<React.SetStateAction<string[]>>;
}

const LaunchRegistration: React.FC<LaunchRegistrationProps> = ({ show, handleClose, selectedSets, setSelectedSets }) => {
  const [url, setUrl] = useState<string | null>(null);
  const { client }=useContext(GlobalContext)!;
  const { sqsClient } = useContext(UserContext)!;
  const {queuesHook : { data : queues}} = useContext(ManagementContext)!;
  // const [setStepsCompleted, setTotalSteps] = useUpdateProgress({
  //   taskId: `Launch registration task`,
  //   indeterminateTaskName: `Finding images with annotations`,
  //   determinateTaskName: "Enqueueing pairs",
  //   stepName: "locations",
  // });
  
  async function handleSubmit() {
    /* What we want to do is get a list of images that have annotations in them in the designated 
    annotationSets and then get all the imageneighbours entries for each image. we deduplicate this list 
    and push the imageNeighbourIds into the queue sorted by the timestamp of the first image in the pair.
    Pushing to the queue in sorted order is not strictly required, but it makes the registration process 
    a little easier if pairs are processed in order.*/
    for (const annotationSetId of selectedSets) {
      const annotations: { image: { id: string; timestamp: number } }[] =
        await fetchAllPaginatedResults(
          client.models.Annotation.annotationsByAnnotationSetId,
          {
            setId: annotationSetId,
            selectionSet: ['image.id', 'image.timestamp']
          })
      
      type Prettify<T> = {
        [K in keyof T]: T[K];
      } & {};

      type functionType = Prettify<typeof client.models.Annotation.annotationsByAnnotationSetId>

      const images: Record<number, string> = {}
      annotations.forEach(({ image }) => {
        images[image.timestamp] = image.id
      })

      const neighboursAllreadyAdded = new Set<string>()
      
      //Sort images by timestamp
      const sortedTimestamps = Object.keys(images).sort();
      const neighbours: ImageNeighbourType[] = []
      for (const timestamp of sortedTimestamps) {
        const neighbours1 = await client.models.ImageNeighbour.imageNeighboursByImage1key({ image1Id: images[timestamp] })
        neighbours1.data.forEach(neighbour => {
          if (!neighboursAllreadyAdded.has(neighbour.image1Id)) {
            neighboursAllreadyAdded.add(neighbour.image1Id)
            neighbours.push(neighbour)
          }
        })
        const neighbours2 = await client.models.ImageNeighbour.imageNeighboursByImage2key({ image2Id: images[timestamp] })
        neighbours2.data.forEach(neighbour => {
          if (!neighboursAllreadyAdded.has(neighbour.image2Id)) {
            neighboursAllreadyAdded.add(neighbour.image2Id)
            neighbours.push(neighbour)
          }
        })
      }
      neighbours.forEach(neighbour =>
        sqsClient.send(
          new SendMessageCommand({
            QueueUrl: queues.find(queue => queue.id == url)?.url,
            MessageBody: JSON.stringify({ selectedSet: annotationSetId, images:[neighbour.image1Id,neighbour.image2Id]})
          })
        )
      )
    }
    handleClose()
  }

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Launch Registration Task</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Stack gap={4}>
            <Form.Group>
              <Form.Label>Annotation Set</Form.Label>
              <AnnotationSetDropdown
                            selectedSets={selectedSets}
                            setSelectedSets={setSelectedSets}
                            canCreate={false}
              />
              {/* <AnnotationSetDropdown
                setAnnotationSet={handleSetAnnotationSet}
                selectedSet={annotationSet}
                canCreate={false}
              /> */}
            </Form.Group>
            <Form.Group>
              <Form.Label>Target Queue</Form.Label>
              <QueueDropdown setQueue={setUrl} currentQueue={url} />
            </Form.Group>
          </Stack>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!(selectedSets.length && url)}
        >
          Submit
        </Button>
        <Button variant="primary" onClick={handleClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default LaunchRegistration;
