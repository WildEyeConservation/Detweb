import React, { useContext, useState } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import { UserContext } from "./UserContext";
import { getImagesInSet } from "./gqlQueries";
import { useUpdateProgress } from "./useUpdateProgress";
import { ImageSetDropdown } from "./ImageSetDropDown";
import { createImageNeighbour } from "./graphql/mutations";

const getPair = `query MyQuery($image1Key: String!, $image2Key: String!) {
  imageNeighboursByImage1key(image1key: $image1Key, filter: {image2key: {eq: $image2Key}}) {
    nextToken
    items {
      homography
      id
    }
  }
}`;

const createPair = `mutation MyMutation($image1Key: String!, $image2Key: String!) {
  createImageNeighbour(input: {image1key: $image1Key, image2key: $image2Key}) {
    id
  }
}
`;

function ProcessImages({ show, handleClose }) {
  const { backend, region, sendToQueue, gqlGetMany, gqlSend } =
    useContext(UserContext);
  const [selectedSets, setSelectedSets] = useState([]);
  const [selectedProcess, selectProcess] = useState(undefined);
  const processingOptions = [
    "Run heatmap generation",
    "Compute image registrations",
  ];
  const [setRegistrationStepsCompleted, setRegistrationTotalSteps] =
    useUpdateProgress({
      taskId: `Load image registration jobs to GPU task queue`,
      indeterminateTaskName: `Loading pairs`,
      determinateTaskName: "Pushing pairs to taskqueue",
      stepName: "pairs",
    });
  const [setHeatmapStepsCompleted, setTotalHeatmapSteps] = useUpdateProgress({
    taskId: `Load heatmap generation jobs to GPU task queue`,
    indeterminateTaskName: `Loading images`,
    determinateTaskName: "Pushing images to taskqueue",
    stepName: "images",
  });

  function handleSubmit() {
    setRegistrationStepsCompleted(0);
    setRegistrationTotalSteps(0);
    setHeatmapStepsCompleted(0);
    setTotalHeatmapSteps(0);
    const callback = {
      "Run heatmap generation": setHeatmapStepsCompleted,
      "Compute image registrations": setRegistrationStepsCompleted,
    };
    for (const selectedSet of selectedSets) {
      gqlGetMany(
        getImagesInSet,
        { name: selectedSet },
        callback[selectedProcess],
      )
        .then((iml) =>
          iml.sort((a, b) => a.image.timestamp - b.image.timestamp),
        )
        .then(async (images) => {
          switch (selectedProcess) {
            case "Run heatmap generation": {
              const setId = crypto.randomUUID();
              setTotalHeatmapSteps(images.length);
              setHeatmapStepsCompleted(0);
              for (const { image } of images) {
                sendToQueue({
                  QueueUrl: backend["detweb-stack-develop"].cpuTaskQueueUrl,
                  MessageGroupId: crypto.randomUUID(),
                  MessageDeduplicationId: crypto.randomUUID(),
                  MessageBody: JSON.stringify({
                    inputBucket:
                      backend["detweb-stack-develop"].imagesBucketOut,
                    key: image.key,
                    action: "register",
                    width: 1024,
                    height: 1024,
                    setId: setId,
                    region,
                    outputBucket:
                      backend["detweb-stack-develop"].outputsBucketOut,
                  }),
                }).then(() => setHeatmapStepsCompleted((s) => s + 1));
              }
              break;
            }
            case "Compute image registrations": {
              setRegistrationTotalSteps(images.length - 1);
              setRegistrationStepsCompleted(0);
              for (let i = 0; i < images.length - 1; i++) {
                setRegistrationStepsCompleted(i + 1);
                const { image: image1 } = images[i];
                const { image: image2 } = images[i + 1];
                if (image2.timestamp - image1.timestamp < 5) {
                  const {
                    data: {
                      imageNeighboursByImage1key: { items },
                    },
                  } = await gqlSend(getPair, {
                    image1Key: image1.key,
                    image2Key: image2.key,
                  });
                  var id = null;
                  if (items.length == 0) {
                    //Create an entry for the pair
                    ({
                      data: {
                        createImageNeighbour: { id },
                      },
                    } = await gqlSend(createPair, {
                      image1Key: image1.key,
                      image2Key: image2.key,
                    }));
                    console.log(id);
                  } else {
                    if (items[0].homography) {
                      //If a homography allready exists for the pair in question we can skip
                      continue;
                    }
                    id = items[0].id;
                  }
                  sendToQueue({
                    QueueUrl: backend["detweb-stack-develop"].gpuTaskQueueUrl,
                    MessageGroupId: crypto.randomUUID(),
                    MessageDeduplicationId: crypto.randomUUID(),
                    MessageBody: JSON.stringify({
                      inputBucket:
                        backend["detweb-stack-develop"].imagesBucketOut,
                      id: id,
                      keys: [image1.key, image2.key],
                      action: "register",
                      region,
                      outputBucket:
                        backend["detweb-stack-develop"].outputsBucketOut,
                    }),
                  });
                }
              }
              break;
            }
          }
        });
    }
    handleClose();
  }

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
              setImageSets={setSelectedSets}
              selectedSets={selectedSets}
            />
            {/* <Form.Select onChange={(e)=>{selectSet(e.target.value)}} value={selectedSet}>  
      {!selectedSet && <option value="none">Select an image set to apply the processing to:</option>}
      {imageSets?.map( q => <option key={q.name} value={q.name}>{q.name}</option>)}  
      </Form.Select>  */}
          </Form.Group>
          <Form.Group>
            <Form.Label>Processing Task</Form.Label>
            <Form.Select
              onChange={(e) => {
                selectProcess(e.target.value);
              }}
              value={selectedProcess}
            >
              {!selectedProcess && (
                <option value="none">Select processing task:</option>
              )}
              {processingOptions?.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          {/* <Form.Group>
      <Form.Label>Model</Form.Label>
      <Form.Select aria-label="Select model to run on image set">
      <option>Select model to run on image set</option>
      <option value="1">Elephant detection (nadir)</option>
      </Form.Select>
      </Form.Group> */}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!selectedSets}
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

export default ProcessImages;
