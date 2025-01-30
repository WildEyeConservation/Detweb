import { useContext, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import { UserContext } from "./Context";
import { useUpdateProgress } from "./useUpdateProgress";
import { ImageSetDropdown } from "./ImageSetDropDown";
import { GlobalContext } from "./Context";
import { SendMessageCommand, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { fetchAllPaginatedResults } from "./utils";
import { ImageType } from "./schemaTypes";
import pLimit from "p-limit";
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
  const {getSqsClient} = useContext(UserContext)!
  const [selectedProcess, selectProcess] = useState<string | undefined>(undefined);
  const [recomputeExisting, setRecomputeExisting] = useState(false);
  const limit = pLimit(10);

  const processingOptions = [
    "Run heatmap generation",
    "Compute image registrations",
  ];

  const [setMetaDataLoadingStepsCompleted, setMetaDataLoadingTotalSteps] = useUpdateProgress({
    taskId: `Load image metadata`,
    indeterminateTaskName: `Loading metadata`,
    determinateTaskName: "Loading metadata",
    stepFormatter: (steps:number)=>`images ${steps}`,
  });

  const [setMessagePreppingStepsCompleted, setMessagePreppingTotalSteps] = useUpdateProgress({
    taskId: `Prep messages for task queue`,
    indeterminateTaskName: `Querying existing neighbour data`,
    determinateTaskName: "Querying existing neighbour data",
    stepFormatter: (steps:number)=>`pairs ${steps}`,
  });

  const [setRegistrationStepsCompleted, setRegistrationTotalSteps] = useUpdateProgress({
    taskId: `Pushing image registration jobs to GPU task queue`,
    indeterminateTaskName: `Loading pairs`,
    determinateTaskName: "Pushing pairs to taskqueue",
    stepFormatter: (steps:number)=>`pairs ${steps}`,
  });

  const [setHeatmapStepsCompleted, setTotalHeatmapSteps] = useUpdateProgress({
    taskId: `Load heatmap generation jobs to GPU task queue`,
    indeterminateTaskName: `Loading images`,
    determinateTaskName: "Pushing images to taskqueue",
    stepFormatter: (pairs:number)=>`steps ${pairs}`,
  });

  async function handlePair(image1: ImageType, image2: ImageType) {
    console.log(`Processing pair ${image1.id} and ${image2.id}`)
    const {data: existingNeighbour } = await client.models.ImageNeighbour.get({
      image1Id: image1.id,
      image2Id: image2.id,
    }, { selectionSet: ["homography"] });
    
    if (existingNeighbour?.homography && !recomputeExisting) {
      console.log(`Homography already exists for pair ${image1.id} and ${image2.id}`)
      setMessagePreppingStepsCompleted((s) => s + 1);
      return null; // Return null for filtered pairs
    }
    
    if (!existingNeighbour) {
      await client.models.ImageNeighbour.create({
        image1Id: image1.id,
        image2Id: image2.id,
      });
    }
    setMessagePreppingStepsCompleted((s) => s + 1);
    // Return the message instead of sending it immediately
    return {
      Id: `${image1.id}-${image2.id}`, // Required unique ID for batch entries
      MessageBody: JSON.stringify({
        inputBucket: backend.custom.inputsBucket,
        image1Id: image1.id,
        image2Id: image2.id,
        keys: [image1.originalPath, image2.originalPath],
        action: "register"
      })
    };
  }

  async function handleSubmit() {
    handleClose();
    setRegistrationStepsCompleted(0);
    setRegistrationTotalSteps(0);
    setHeatmapStepsCompleted(0);
    setTotalHeatmapSteps(0);
    // try {
      switch (selectedProcess) {
        case "Run heatmap generation": {
          const allImages = await Promise.all(selectedImageSets.map(async (selectedSet) => 
            (await fetchAllPaginatedResults(
              client.models.ImageSetMembership.imageSetMembershipsByImageSetId,
              {imageSetId: selectedSet, selectionSet: ["imageId"]}
            ))
          )).then(arrays =>
            arrays.flatMap(im => im.map(i => i.imageId)));
          // const allImages = await fetchAllPaginatedResults(
          //   client.models.ImageSetMembership.imageSetMembershipsByImageSetId,
          //   {imageSetId: selectedImageSets[0], selectionSet: ["imageId"]}
          // )
          // const allImages = await Promise.all(selectedImageSets.map(async (selectedSet) => 
          //   (await client.models.ImageSetMembership.imageSetMembershipsByImageSetId(
          //     {imageSetId: selectedSet })).data.map(im => im.imageId)
          // )).then(arrays => arrays.flat());    
          //const setId = crypto.randomUUID();
          setTotalHeatmapSteps(allImages.length);
          setHeatmapStepsCompleted(0);
          allImages.map(async (id) => {
            const {data :imageFiles} = await client.models.ImageFile.imagesByimageId({imageId: id})
            const path = imageFiles.find((imageFile) => imageFile.type == 'image/jpeg')?.path
              if (path) {
                await client.mutations.processImages({
                  s3key: path!,
                  model: "heatmap",
                })
              } else {
                console.log(`No image file found for image ${id}. Skipping`)
              }
              setHeatmapStepsCompleted((s) => s + 1);
          })
        }
        break;
        case "Compute image registrations": {
          setMetaDataLoadingStepsCompleted(0)
          if (selectedImageSets.length > 1) {
            // Even though much (but not all) of the following code can hhandel multiple sets, I chose to disable this for now, becuase there are real questions
            // about how to handle multiple sets with overlapping membership. What is the user expecting? Does he want to link images within each set only or should 
            // we create links between images in different sets? There is a potential use case for either.
            alert("Computing registrations for multiple image sets in a single pass is not currently supported. Please run this task for each image set separately.");
            return;
          }

          const imageCount = (await client.models.ImageSet.get({ id: selectedImageSets[0] }, {selectionSet: ["imageCount"]}))?.data?.imageCount ?? 0;
          setMetaDataLoadingTotalSteps(imageCount);
          // Gather all images in selected sets into a single array
          const images = await Promise.all(selectedImageSets.map(async (selectedSet) => 
            (await fetchAllPaginatedResults(
              client.models.ImageSetMembership.imageSetMembershipsByImageSetId,
              {imageSetId: selectedSet, selectionSet: ["image.id", "image.timestamp", "image.originalPath"]}, setMetaDataLoadingStepsCompleted
            ))
          )).then(arrays =>
            arrays.flat().map(
              ({ image }) => image))
            .then(images =>
              images.sort((a, b) => a.timestamp - b.timestamp))
          setMessagePreppingTotalSteps(images.length - 1);
          setMessagePreppingStepsCompleted(0);
          const pairPromises = [];
          for (let i = 0; i < images.length - 1; i++) {
            const image1 = images[i];
            const image2 = images[i + 1];
            if (image2.timestamp - image1.timestamp < 5) {
              pairPromises.push(handlePair(image1, image2));
            } else {
              console.log(`Skipping pair ${image1.id} and ${image2.id} because the time difference is greater than 5 seconds`);
              setMessagePreppingStepsCompleted((s) => s + 1);
            }
          }

          const messages = (await Promise.all(pairPromises)).filter((msg): msg is NonNullable<typeof msg> => msg !== null);

          setRegistrationTotalSteps(messages.length);
          setRegistrationStepsCompleted(0);
          // Send messages in batches of 10
          const sqsClient = await getSqsClient();
          for (let i = 0; i < messages.length; i += 10) {
            const batch = messages.slice(i, i + 10);
            await limit(() => sqsClient.send(
              new SendMessageBatchCommand({
                QueueUrl: backend.custom.lightglueTaskQueueUrl,
                Entries: batch
              })
            ));
            setRegistrationStepsCompleted((s) => s + batch.length);
          }
        }
      }
    // } catch (error) {
    //   const errorDetails = {
    //     error: error instanceof Error ? error.stack : String(error),
    //     selectedProcess,
    //     selectedImageSets
    //   };
    //   await publishError('taskProgress/processImages', `Error in handleSubmit: ${error instanceof Error ? error.message : String(error)}`, errorDetails);
    // }
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
          {selectedProcess === "Compute image registrations" && (
            <Form.Group className="mt-3">
              <Form.Check
                type="checkbox"
                label="Recompute existing homographies"
                checked={recomputeExisting}
                onChange={(e) => setRecomputeExisting(e.target.checked)}
              />
            </Form.Group>
          )}
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
