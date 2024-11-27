import React, { useContext, useState } from "react";
import { Stack, Modal, Form, Button } from "react-bootstrap";
import { UserContext, GlobalContext,ManagementContext } from "./Context";
import { QueueDropdown } from "./QueueDropDown";
import { AnnotationSetDropdown } from "./AnnotationSetDropdownMulti";
import { fetchAllPaginatedResults } from "./utils";
import { ImageNeighbourType } from "./schemaTypes";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { ImageSetDropdown } from "./ImageSetDropDown";
import * as math from 'mathjs';
import { useRetry } from "./useRetry";

interface LaunchRegistrationProps {
  show: boolean;
  handleClose: () => void;
  selectedSets: string[];
  setSelectedSets: React.Dispatch<React.SetStateAction<string[]>>;
}

const LaunchRegistration: React.FC<LaunchRegistrationProps> = ({ show, handleClose, selectedSets, setSelectedSets }) => {
  const [url, setUrl] = useState<string | null>(null);
  const { client }=useContext(GlobalContext)!;
  const { getSqsClient } = useContext(UserContext)!;
  const {queuesHook : { data : queues}} = useContext(ManagementContext)!;
  const [selectedImageSets, setSelectedImageSets] = useState<string[]>([]);
  const [selectedType, setSelectedType] = useState<boolean>(false);
  const { executeWithRetry } = useRetry();
  // const [setStepsCompleted, setTotalSteps] = useUpdateProgress({
  //   taskId: `Launch registration task`,
  //   indeterminateTaskName: `Finding images with annotations`,
  //   determinateTaskName: "Enqueueing pairs",
  //   stepName: "locations",
  // });

  async function findPath(image1: { id: string, timestamp: number }, image2: { id: string, timestamp: number }) {
    const homographies: number[][] = []
    let currentId = image1.id
    do {
      const { data: neighbour } = await executeWithRetry(() => client.models.ImageNeighbour.imageNeighboursByImage1key({ image1Id: currentId }, { selectionSet: ['image2.id', 'image2.timestamp', 'homography'] }))
      homographies.push(neighbour[0].homography)
      if (neighbour[0].image2.id == image2.id) break;
      currentId = neighbour[0].image2.id
    } while (true)

    // Convert homographies to mathjs matrices
    const matrices = homographies.map(h => math.reshape(h, [3, 3]));

    // Multiply all matrices together
    const totalTransform = matrices.reduce((acc, matrix) =>
      math.multiply(acc, matrix));

    return math.reshape(totalTransform,[9])
    // Normalize the homography
    const normalizedTransform = normalizeHomography(totalTransform);

    // Convert the result back to a 2D array
    const finalHomography = normalizedTransform.toArray() as number[][];

    return finalHomography;
  }

  function normalizeHomography(homography: math.Matrix): math.Matrix {
    // Get the bottom-right element
    const scale = homography.get([8]);
    
    // If scale is zero or very close to zero, return the original matrix to avoid division by zero
    if (Math.abs(scale) < 1e-10) {
      console.warn('Warning: Homography scale is very close to zero. Normalization skipped.');
      return homography;
    }

    // Divide all elements by the scale
    return math.divide(homography, scale) as math.Matrix;
  }
  
  async function handleSubmit() {
    /* What we want to do is get a list of images that have annotations in them in the designated 
    annotationSets and then get all the imageneighbours entries for each image. we deduplicate this list 
    and push the imageNeighbourIds into the queue sorted by the timestamp of the first image in the pair.
    Pushing to the queue in sorted order is not strictly required, but it makes the registration process 
    a little easier if pairs are processed in order.*/
    if (!selectedType) {
      for (const annotationSetId of selectedSets) {
        const annotations: { image: { id: string; timestamp: number } }[] =
          await fetchAllPaginatedResults(
            client.models.Annotation.annotationsByAnnotationSetId,
            {
              setId: annotationSetId,
              selectionSet: ['image.id', 'image.timestamp']
            })
      
        const images: Record<number, string> = {}
        annotations.forEach(({ image }) => {
          images[image.timestamp] = image.id
        })

        const neighboursAllreadyAdded = new Set<string>()
      
        //Sort images by timestamp
        const sortedTimestamps = Object.keys(images).sort();
        const neighbours: ImageNeighbourType[] = []
        for (const timestamp of sortedTimestamps) {
          const neighbours1 = await executeWithRetry(() => client.models.ImageNeighbour.imageNeighboursByImage1key({ image1Id: images[timestamp] }))
          neighbours1.data.forEach(neighbour => {
            if (!neighboursAllreadyAdded.has(neighbour.image1Id)) {
              neighboursAllreadyAdded.add(neighbour.image1Id)
              neighbours.push(neighbour)
            }
          })
          const neighbours2 = await executeWithRetry(() => client.models.ImageNeighbour.imageNeighboursByImage2key({ image2Id: images[timestamp] }))
          neighbours2.data.forEach(neighbour => {
            if (!neighboursAllreadyAdded.has(neighbour.image2Id)) {
              neighboursAllreadyAdded.add(neighbour.image2Id)
              neighbours.push(neighbour)
            }
          })
        }
        neighbours.forEach(neighbour =>
          getSqsClient().then(sqsClient => sqsClient.send(
            new SendMessageCommand({
              QueueUrl: queues.find(queue => queue.id == url)?.url,
              MessageBody: JSON.stringify({ selectedSet: annotationSetId, images: [neighbour.image1Id, neighbour.image2Id] })
            }))
          )
        )
      }
    } else {
      
      for (const imageSetId of selectedImageSets) {
        const images: { image: { id: string, timestamp: number, annotations: { setId: string }[] } }[] = [];
        //Paginate through the image set memberships
        let nextToken: string | undefined;
        do {
          const { data: imageBatch, nextToken: nextTokenBatch } = await executeWithRetry(() => client.models.ImageSetMembership.imageSetMembershipsByImageSetId({ imageSetId },
          {
            selectionSet: ['image.id',
              'image.timestamp',
              'image.annotations.setId'],
            nextToken
          }))
        //Filter out images that don't have annotations in the selected annotation sets
          images.push(...imageBatch)
          nextToken = nextTokenBatch
        } while (nextToken)
        //Sort the images by timestamp
        images.sort((a, b) => a.image.timestamp - b.image.timestamp)
        // Iterate through the images in chronological order, keep a record of the previous image
        let previousImage: { id: string, timestamp: number, annotations: { setId: string }[] } | undefined = undefined;
        for (const image of images) {
          //Check if the image or the previous image has any annotations in the selected annotation sets
          if (image.image.annotations?.some(annotation => selectedSets.includes(annotation.setId)) ||
            (previousImage && previousImage.image.annotations.some(annotation => selectedSets.includes(annotation.setId)))) {
            const homography = await findPath(previousImage.image, image.image)
            const { data: imageNeighbour } = await executeWithRetry(() => client.models.ImageNeighbour.create({
              image1Id: previousImage.image.id,
              image2Id: image.image.id,
              homography
            }))
            await getSqsClient().then(sqsClient => sqsClient.send(
              new SendMessageCommand({
                QueueUrl: queues.find(queue => queue.id == url)?.url,
                MessageBody: JSON.stringify({ selectedSet: selectedSets[0], images: [previousImage.image.id, image.image.id]})
              }))
            )
          }
          previousImage = image
        }
        console.log(imageSetMemberships)
      }
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
              <Form.Check
                type="switch"
                label="Filter by ImageSet"
                checked={selectedType}
                onChange={(e) => setSelectedType(e.target.checked)}
              />
              </Form.Group>
            <Form.Group>
              <AnnotationSetDropdown
                            selectedSets={selectedSets}
                            setSelectedSets={setSelectedSets}
                            canCreate={false}
              />
              </Form.Group>
{selectedType && 
            <Form.Group>
          <Form.Label>Image Set</Form.Label>
          <ImageSetDropdown
            selectedSets={selectedImageSets}
            setImageSets={setSelectedImageSets}
            canCreate={false}
          />
            </Form.Group>
            }              {/* <AnnotationSetDropdown
                setAnnotationSet={handleSetAnnotationSet}
                selectedSet={annotationSet}
                canCreate={false}
              /> */}
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
