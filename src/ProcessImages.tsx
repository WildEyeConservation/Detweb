import { useContext, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import { UserContext } from "./Context";
import { getImagesInSet } from "./gqlQueries";
import { useUpdateProgress } from "./useUpdateProgress";
import { ImageSetDropdown } from "./ImageSetDropDown";
import { GlobalContext } from "./Context";


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
  const { client } = useContext(GlobalContext)!
  const [selectedProcess, selectProcess] = useState<string | undefined>(undefined);

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
    setRegistrationStepsCompleted(0);
    setRegistrationTotalSteps(0);
    setHeatmapStepsCompleted(0);
    setTotalHeatmapSteps(0);
    
    const allImages = await selectedImageSets.reduce(async (acc, selectedSet) => {
      const images = (await client.models.ImageSet.get(
        { id: selectedSet },
        { selectionSet: ["images.image.timestamp", "images.image.id"] }
      )).data?.images || [];
      return [...await acc, ...images];
    }, Promise.resolve([] as { image: { id: string; timestamp: string | null } }[]));

      switch (selectedProcess) {
        case "Run heatmap generation": {
          //const setId = crypto.randomUUID();
          setTotalHeatmapSteps(allImages.length);
          setHeatmapStepsCompleted(0);
          allImages.map(async ({ image }) => {
            const { data: imageFiles } = await client.models.ImageFile.list({ filter: { imageId: { eq: image.id } } })
            const path = imageFiles.find((imageFile) => imageFile.type == 'image/jpeg')?.path
              if (path) {
                client.mutations.processImages({
                s3key: path!,
                model: "heatmap",
              })
            }
            setHeatmapStepsCompleted((s) => s + 1);
          })
        }
        // case "Compute image registrations": {
        //   setRegistrationTotalSteps(images.length - 1);
        //   setRegistrationStepsCompleted(0);
        //   for (let i = 0; i < images.length - 1; i++) {
        //     setRegistrationStepsCompleted(i + 1);
        //     const { image: image1 } = images[i];
        //     const { image: image2 } = images[i + 1];
        //     if (image2.timestamp - image1.timestamp < 5) {
        //       const response = await gqlSend(getPair, {
        //         image1Key: image1.key,
        //         image2Key: image2.key,
        //       }) as { data: { imageNeighboursByImage1key: { items: { homography: string | null, id: string }[] } } };

        //       const {
        //         data: {
        //           imageNeighboursByImage1key: { items },
        //         },
        //       } = response;
              
        //       let id = null;
        //       if (items.length === 0) {
        //         // const response = await gqlSend(getPair, {
        //         //   image1Key: image1.key,
        //         //   image2Key: image2.key,
        //         // }) as { data: { imageNeighboursByImage1key: { items: { homography: string | null, id: string }[] } } };
                
        //       } else {
        //         if (items[0].homography) {
        //           continue;
        //         }
        //         id = items[0].id;
        //       }
        //       await sendToQueue({
        //         QueueUrl: backend.custom.gpuTaskQueueUrl,
        //         MessageGroupId: crypto.randomUUID(),
        //         MessageDeduplicationId: crypto.randomUUID(),
        //         MessageBody: JSON.stringify({
        //           inputBucket: backend.custom.inputsBucket,
        //           id: id,
        //           keys: [image1.key, image2.key],
        //           action: "register",
        //           region,
        //           outputBucket: backend.custom.outputBucket,
        //         }),
        //       });
        //     }
        //   }
        //   break;
        // }
      }
      handleClose();
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
