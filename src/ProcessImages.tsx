import { useContext, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import { UserContext } from "./Context";
import { useUpdateProgress } from "./useUpdateProgress";
import { ImageSetDropdown } from "./ImageSetDropDown";
import { GlobalContext } from "./Context";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { retryOperation } from './utils/retryOperation';

// const createPair = `mutation MyMutation($image1Key: String!, $image2Key: String!) {
//   createImageNeighbour(input: {image1key: $image1Key, image2key: $image2Key}) {
//     id
//   }
// }`;

interface ProcessImagesProps {
  show: boolean;
  handleClose: () => void;
  selectedImageSets: string[];
  setSelectedImageSets: React.Dispatch<React.SetStateAction<string[]>>
}

export default function ProcessImages({ show, handleClose, selectedImageSets, setSelectedImageSets }: ProcessImagesProps) {
  const { client, backend } = useContext(GlobalContext)!
  const [selectedProcess, selectProcess] = useState<string | undefined>(undefined);
  const { sqsClient } = useContext(UserContext)!;


  const processingOptions = [
    "Run heatmap generation",
    "Compute image registrations",
  ];

  const [setRegistrationStepsCompleted, setRegistrationTotalSteps] = useUpdateProgress({
    taskId: `Load image registration jobs to GPU task queue`,
    indeterminateTaskName: `Loading pairs`,
    determinateTaskName: "Pushing pairs to taskqueue",
    stepFormatter: (steps:number)=>`steps ${steps}`,
  });

  const [setHeatmapStepsCompleted, setTotalHeatmapSteps] = useUpdateProgress({
    taskId: `Load heatmap generation jobs to GPU task queue`,
    indeterminateTaskName: `Loading images`,
    determinateTaskName: "Pushing images to taskqueue",
    stepFormatter: (pairs:number)=>`steps ${pairs}`,
  });

  async function handleSubmit() {
    try {
      handleClose();
      setRegistrationStepsCompleted(0);
      setRegistrationTotalSteps(0);
      setHeatmapStepsCompleted(0);
      setTotalHeatmapSteps(0);
      switch (selectedProcess) {
        case "Run heatmap generation": {
          const allImages = await Promise.all(selectedImageSets.map(async (selectedSet) => 
            retryOperation(
              () => client.models.ImageSetMembership.imageSetMembershipsByImageSetId({imageSetId: selectedSet }),
              { retryableErrors: ['Network error', 'Connection timeout'] }
            ).then(result => result.data.map(im => im.imageId))
          )).then(arrays => arrays.flat());    
          //const setId = crypto.randomUUID();
          setTotalHeatmapSteps(allImages.length);
          setHeatmapStepsCompleted(0);
          for (let i = 0; i < allImages.length; i++) {
            try {
              const id = allImages[i];
              const { data: imageFiles } = await retryOperation(
                () => client.models.ImageFile.imagesByimageId({imageId: id}),
                { retryableErrors: ['Network error', 'Connection timeout'] }
              );
              const path = imageFiles.find((imageFile) => imageFile.type == 'image/jpeg')?.path;
              if (path) {
                await retryOperation(
                  () => client.mutations.processImages({
                    s3key: path!,
                    model: "heatmap",
                  }),
                  { retryableErrors: ['Network error', 'Connection timeout'] }
                );
                setHeatmapStepsCompleted((s) => s + 1);

                // Publish progress update
                await client.graphql({
                  query: `mutation Publish($channelName: String!, $content: String!) {
                    publish(channelName: $channelName, content: $content) {
                      channelName
                      content
                    }
                  }`,
                  variables: {
                    channelName: 'taskProgress/processImages',
                    content: JSON.stringify({
                      type: 'progress',
                      total: allImages.length,
                      completed: i + 1,
                      taskName: 'Run heatmap generation'
                    })
                  }
                });
              }
            } catch (error) {
              const errorDetails = {
                error: error instanceof Error ? error.stack : String(error),
                imageId: id,
                processStep: 'Run heatmap generation'
              };
              await publishError('taskProgress/processImages', `Error processing image ${id}: ${error instanceof Error ? error.message : String(error)}`, errorDetails);
            }
          }

          // Publish completion message
          await client.graphql({
            query: `mutation Publish($channelName: String!, $content: String!) {
              publish(channelName: $channelName, content: $content) {
                channelName
                content
              }
            }`,
            variables: {
              channelName: 'taskProgress/processImages',
              content: JSON.stringify({
                type: 'completion',
                taskName: 'Run heatmap generation'
              })
            }
          });
          break;
        }
        case "Compute image registrations": {
          const images = await Promise.all(selectedImageSets.map(async (selectedSet) => 
            retryOperation(
              () => client.models.ImageSetMembership.imageSetMembershipsByImageSetId(
                { imageSetId: selectedSet, selectionSet: ["image.id", "image.timestamp", "image.files.key", "image.files.type"] }
              ),
              { retryableErrors: ['Network error', 'Connection timeout'] }
            ).then(result => result.data)
          )).then(arrays => arrays.flat())
            .then(images=>images.map(({image})=>image))
            .then(images => images.sort((a, b) => a.timestamp - b.timestamp));
          setRegistrationTotalSteps(images.length - 1);
          setRegistrationStepsCompleted(0);
          for (let i = 0; i < images.length - 1; i++) {
            try {
              setRegistrationStepsCompleted(i + 1);
              const image1 = images[i];
              const image2 = images[i + 1];
              if (image2.timestamp - image1.timestamp < 5) {
                const { data } = await retryOperation(
                  () => client.models.ImageNeighbour.create({
                    image1Id: image1.id,
                    image2Id: image2.id,
                  }),
                  { retryableErrors: ['Network error', 'Connection timeout'] }
                );
                //If the create failed, it is typically because the record allready exists. Let us check if it allready has an associated homography before we launch a task to compute it
                if (!data) {
                  const { data } = await retryOperation(
                    () => client.models.ImageNeighbour.get({
                      image1Id: image1.id,
                      image2Id: image2.id,
                    }),
                    { retryableErrors: ['Network error', 'Connection timeout'] }
                  );
                  if (data.homography) {
                    continue;
                  }
                }
                const file1 = image1.files.find((f) => f.type == 'image/jpeg').key;
                const file2 = image2.files.find((f) => f.type == 'image/jpeg').key;
                await retryOperation(
                  () => sqsClient.send(
                    new SendMessageCommand({
                      QueueUrl: backend.custom.lightglueTaskQueueUrl,
                      MessageBody: JSON.stringify({
                        inputBucket: backend.custom.inputsBucket,
                        image1Id: image1.id,
                        image2Id: image2.id,
                        keys: [file1, file2],
                        action: "register"
                      })
                    })
                  ),
                  { retryableErrors: ['Network error', 'Connection timeout'] }
                );
                
                // Publish progress update
                await client.graphql({
                  query: `mutation Publish($channelName: String!, $content: String!) {
                    publish(channelName: $channelName, content: $content) {
                      channelName
                      content
                    }
                  }`,
                  variables: {
                    channelName: 'taskProgress/processImages',
                    content: JSON.stringify({
                      type: 'progress',
                      total: images.length - 1,
                      completed: i + 1,
                      taskName: 'Compute image registrations'
                    })
                  }
                });
              }
            } catch (error) {
              const errorDetails = {
                error: error instanceof Error ? error.stack : String(error),
                image1Id: image1.id,
                image2Id: image2.id,
                processStep: 'Compute image registrations'
              };
              await publishError('taskProgress/processImages', `Error computing registration for images ${image1.id} and ${image2.id}: ${error instanceof Error ? error.message : String(error)}`, errorDetails);
            }
          }

          // Publish completion message
          await client.graphql({
            query: `mutation Publish($channelName: String!, $content: String!) {
              publish(channelName: $channelName, content: $content) {
                channelName
                content
              }
            }`,
            variables: {
              channelName: 'taskProgress/processImages',
              content: JSON.stringify({
                type: 'completion',
                taskName: 'Compute image registrations'
              })
            }
          });
          break;
        }
      }
    } catch (error) {
      const errorDetails = {
        error: error instanceof Error ? error.stack : String(error),
        selectedProcess,
        selectedImageSets
      };
      await publishError('taskProgress/processImages', `Error in handleSubmit: ${error instanceof Error ? error.message : String(error)}`, errorDetails);
    }
  };
    

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Process Imagery</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group>
            <Form.Label>Image Set to process</Form.Label>
            <ImageSetDropdown
              selectedSets={selectedImageSets}
              setImageSets={setSelectedImageSets}
            />

          </Form.Group>
          <Form.Group>
            <Form.Label>Processing Task</Form.Label>
            <Form.Select
              onChange={(e) => selectProcess(e.target.value)}
              value={selectedProcess}
            >
              {!selectedProcess && (
                <option value="none">Select processing task:</option>
              )}
              {processingOptions.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!selectedImageSets?.length || !selectedProcess}
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

async function publishError(channelName: string, errorMessage: string) {
  await client.graphql({
    query: `mutation Publish($channelName: String!, $content: String!) {
      publish(channelName: $channelName, content: $content) {
        channelName
        content
      }
    }`,
    variables: {
      channelName,
      content: JSON.stringify({
        type: 'error',
        message: errorMessage
      })
    }
  });
}