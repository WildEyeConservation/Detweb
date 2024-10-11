import { useContext, useState, useEffect, useCallback, useRef } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import { UserContext, GlobalContext, ManagementContext, ProjectContext } from "./Context";
import { useUpdateProgress } from "./useUpdateProgress";
import { ImageSetDropdown } from "./ImageSetDropDown";
//import { subset } from "mathjs";
import { SendMessageCommand } from "@aws-sdk/client-sqs";
import { fetchAllPaginatedResults } from "./utils";

interface CreateTaskProps {
  show: boolean;
  handleClose: () => void;
  selectedImageSets: string[];
  setSelectedImageSets: React.Dispatch<React.SetStateAction<string[]>>;
}

interface ImageDimensions {
  width: number;
  height: number;
}

function CreateTask({ show, handleClose, selectedImageSets, setSelectedImageSets }: CreateTaskProps) {
  const { client, backend } = useContext(GlobalContext)!;
  const { sqsClient } = useContext(UserContext)!;
  const { project } = useContext(ProjectContext)!;
  const [sidelap, setSidelap] = useState<number>(0);
  const [overlap, setOverlap] = useState<number>(0);
  const [width, setWidth] = useState<number>(1024);
  const [name, setName] = useState<string>("");
  const [height, setHeight] = useState<number>(1024);
  const [modelGuided, setModelGuided] = useState(false);
  const userContext = useContext(UserContext);
  const { locationSetsHook: { create: createLocationSet } } = useContext(ManagementContext)!;
  const [minX, setMinX] = useState<number>(0);
  const [maxX, setMaxX] = useState<number>(0);
  const [minY, setMinY] = useState<number>(0);
  const [maxY, setMaxY] = useState<number>(0);
  const [sidelapPercent, setSidelapPercent] = useState<number>(0);
  const [overlapPercent, setOverlapPercent] = useState<number>(0);
  const [horizontalTiles, setHorizontalTiles] = useState<number>(1);
  const [verticalTiles, setVerticalTiles] = useState<number>(1);
  const [imageDimensions, setImageDimensions] = useState<ImageDimensions | null>(null);

  const prevHorizontalTiles = useRef(horizontalTiles);
  const prevVerticalTiles = useRef(verticalTiles);
  const prevWidth = useRef(width);
  const prevHeight = useRef(height);

  const [consistentImageSizes, setConsistentImageSizes] = useState<boolean>(true);

  useEffect(() => {
    async function checkImageDimensions() {
      if (show && selectedImageSets.length > 0) {
        let allImages = [];
        let prevNextToken: string | null | undefined = undefined;

        do {
          const { data: images, nextToken } = await client.models.ImageSetMembership.imageSetMembershipsByImageSetId({
            imageSetId: selectedImageSets[0],
            selectionSet: ['image.width', 'image.height'],
            nextToken: prevNextToken
          });
          prevNextToken = nextToken;
          allImages = allImages.concat(images);
        } while (prevNextToken);

        if (allImages.length > 0) {
          const firstImageDimensions = { width: allImages[0].image.width, height: allImages[0].image.height };
          setImageDimensions(firstImageDimensions);
          setWidth(firstImageDimensions.width);
          setHeight(firstImageDimensions.height);

          const areConsistent = allImages.every(img =>
            img.image.width === firstImageDimensions.width && img.image.height === firstImageDimensions.height
          );

          setConsistentImageSizes(areConsistent);
        }
      }
    }

    checkImageDimensions();
  }, [selectedImageSets, client.models.ImageSetMembership, show]);

  const updateDimensions = useCallback(() => {
    if (imageDimensions && (prevHorizontalTiles.current !== horizontalTiles || prevVerticalTiles.current !== verticalTiles)) {
      setWidth(imageDimensions.width / horizontalTiles);
      setHeight(imageDimensions.height / verticalTiles);
      prevHorizontalTiles.current = horizontalTiles;
      prevVerticalTiles.current = verticalTiles;
    }
  }, [horizontalTiles, verticalTiles, imageDimensions]);

  const updateTiles = useCallback(() => {
    if (imageDimensions && (prevWidth.current !== width || prevHeight.current !== height)) {
      setHorizontalTiles(Math.ceil(imageDimensions.width / width));
      setVerticalTiles(Math.ceil(imageDimensions.height / height));
      prevWidth.current = width;
      prevHeight.current = height;
    }
  }, [width, height, imageDimensions]);

  useEffect(() => {
    updateDimensions();
  }, [horizontalTiles, verticalTiles, updateDimensions]);

  useEffect(() => {
    updateTiles();
  }, [width, height, updateTiles]);

  useEffect(() => {
    setOverlap(Math.round(height * (overlapPercent / 100)));
    setSidelap(Math.round(width * (sidelapPercent / 100)));
  }, [height, width, overlapPercent, sidelapPercent]);

  if (!userContext) {
    return null;
  }

  const [setImagesCompleted, setTotalImages] = useUpdateProgress({
    taskId: `Create task (model guided)`,
    indeterminateTaskName: `Loading images`,
    determinateTaskName: "Processing images",
    stepFormatter: (x: number) => `${x} images`
  });
  const [setLocationsCompleted, setTotalLocations] = useUpdateProgress({
    taskId: `Create task`,
    indeterminateTaskName: `Loading locations`,
    determinateTaskName: "Processing locations",
    stepFormatter: (x: number) => `${x} locations`
  });

  const [threshold, setThreshold] = useState(5); // New state variable for threshold

  async function handleSubmit() {
    try {
      // const client=new SNSClient({
      //   region: awsExports.aws_project_region,
      //   credentials: Auth.essentialCredentials(credentials)
      // })
      // const client = new SQSClient({region: backend.ProjectRegion,
      //   credentials: Auth.essentialCredentials(credentials)
      // });
      handleClose();
      //const images=await gqlClient.graphql({query: listImages,variables:{filter:{projectImageName:{eq:currentProject}}}})
      setTotalImages(0);
      const allImages = await fetchAllPaginatedResults(
        client.models.ImageSetMembership.imageSetMembershipsByImageSetId,
        {
          imageSetId: selectedImageSets[0],
          selectionSet: ['image.timestamp', 'image.id', 'image.width', 'image.height']
        }
      );
      setImagesCompleted(0);
      const locationSetId = createLocationSet({ name, projectId: project.id })
      if (modelGuided) {
        setTotalImages(allImages.length);
        for (const { image } of allImages) {
          const { data: imageFiles } = await client.models.ImageFile.imagesByimageId({ imageId: image.id })
          // FIXME: This is wrong. I am using the key from the jpeg file to deduce what the path to the h5 file is, but 
          // the right way to do this is to create a separate ImageFile entry as soon as we create the heatmap file.
          const key = imageFiles.find((x: any) => x.type == 'image/jpeg')?.key.replace('images', 'heatmaps')
          sqsClient.send(
            new SendMessageCommand({
              QueueUrl: backend.custom.pointFinderTaskQueueUrl,
              MessageBody: JSON.stringify({
                imageId: image.id,
                projectId: project.id,
                key: 'heatmaps/' + key + '.h5',
                width: 1024,
                height: 1024,
                threshold: 1 - Math.pow(10, -threshold),
                bucket: backend.storage.buckets[0].bucket_name,
                setId: locationSetId,
              })
            })).then(() => setImagesCompleted((s: number) => s + 1));
        }
      } else {
        const promises = [];
        let totalSteps = 0;
        for (const { image } of allImages) {
          const xSteps = Math.ceil((image.width - width) / (width - sidelap));
          const ySteps = Math.ceil((image.height - height) / (height - overlap));
          const xStepSize = (image.width - width) / xSteps;
          const yStepSize = (image.height - height) / ySteps;
          totalSteps += (xSteps + 1) * (ySteps + 1);
          for (var xStep = 0; xStep < xSteps + 1; xStep++) {
            for (var yStep = 0; yStep < ySteps + 1; yStep++) {
              const x = Math.round(
                xStep * (xStepSize ? xStepSize : 0) + width / 2,
              );
              const key = imageFiles.find((x: any) => x.type == 'image/jpeg')?.key.replace('images', 'heatmaps');
              await retryOperation(
                () => sqsClient.send(
                  new SendMessageCommand({
                    QueueUrl: backend.custom.pointFinderTaskQueueUrl,
                    MessageBody: JSON.stringify({
                      imageId: image.id,
                      projectId: project.id,
                      key: 'heatmaps/' + key + '.h5',
                      width: 1024,
                      height: 1024,
                      threshold: 1 - Math.pow(10, -threshold),
                      bucket: backend.storage.buckets[0].bucket_name,
                      setId: locationSetId,
                    })
                  })
                ),
                { retryableErrors: ['Network error', 'Connection timeout'] }
              );
              setImagesCompleted((s: number) => s + 1);
              setTotalLocations(totalSteps);
              await Promise.all(promises);
              // Publish progress update
              try {
                await client.graphql({
                  query: `mutation Publish($channelName: String!, $content: String!) {
                  publish(channelName: $channelName, content: $content) {
                    channelName
                    content
                  }
                }`,
                  variables: {
                    channelName: 'taskProgress/createTask',
                    content: JSON.stringify({
                      type: 'progress',
                      total: allImages.length,
                      completed: i + 1,
                      taskName: 'Create Task (Model Guided)'
                    })
                  }
                });
              } catch (error) {
                const errorDetails = {
                  error: error instanceof Error ? error.stack : String(error),
                  selectedImageSets,
                  modelGuided,
                  threshold
                };
                await publishError('taskProgress/createTask', {
                  message: `Error in handleSubmit: ${error instanceof Error ? error.message : String(error)}`,
                  details: errorDetails
                });
              }
            }
          }
        }
        //  else {
        //   const promises = [];
        //   let totalSteps = 0;
        //   for (const { image } of allImages) {
        //     const xSteps = Math.ceil((image.width - width) / (width - sidelap));
        //     const ySteps = Math.ceil((image.height - height) / (height - overlap));
        //     const xStepSize = (image.width - width) / xSteps;
        //     const yStepSize = (image.height - height) / ySteps;
        //     totalSteps += (xSteps + 1) * (ySteps + 1);
        //     for (var xStep = 0; xStep < xSteps + 1; xStep++) {
        //       for (var yStep = 0; yStep < ySteps + 1; yStep++) {
        //         const x = Math.round(
        //           xStep * (xStepSize ? xStepSize : 0) + width / 2,
        //         );
        //         const y = Math.round(
        //           yStep * (yStepSize ? yStepSize : 0) + height / 2,
        //         );
        //         if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        //           promises.push(
        //             client.models.Location.create({
        //               x,
        //               y,
        //               width,
        //               height,
        //               imageId: image.id,
        //               projectId: project.id,
        //               source: 'manual',
        //               setId: locationSetId,
        //             }).then(() => setLocationsCompleted((fc: any) => fc + 1)),
        //           );
        //         }
        //       }
        //     }
        //   }
        //   setTotalLocations(totalSteps);
        //   await Promise.all(promises);
        // }
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
          channelName: 'taskProgress/createTask',
          content: JSON.stringify({
            type: 'completion',
            taskName: 'Create Task'
          })
        }
      });

    } catch (error) {
      const errorDetails = {
        error: error instanceof Error ? error.stack : String(error),
        selectedImageSets,
        modelGuided,
        threshold
      };
      await publishError('taskProgress/createTask', {
        message: `Error in handleSubmit: ${error instanceof Error ? error.message : String(error)}`,
        details: errorDetails
      });
    }
  }

  return (
    <Modal show={show} onHide={handleClose}>
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
              checked={modelGuided}
              onChange={(x) => {
                console.log(x.target.checked);
                setModelGuided(x.target.checked);
              }}
            />
          </Form.Group>
          <Form.Label>Image Sets to process</Form.Label>
          <ImageSetDropdown
            selectedSets={selectedImageSets}
            setImageSets={setSelectedImageSets}
          />
          {modelGuided ? (
            <>
              <Form.Group>
                <Form.Label>Threshold</Form.Label>
                <Form.Range
                  min={1}
                  max={10}
                  step={1}
                  value={threshold}
                  onChange={(e) => setThreshold(parseFloat(e.target.value))}
                />
                <Form.Text>
                  {`Threshold value: ${threshold} -- (${(1 - Math.pow(10, -threshold)).toFixed(8)})`}
                </Form.Text>
              </Form.Group>
              <Form.Group>
                <Form.Label>Model</Form.Label>
                <Form.Select aria-label="Select AI model to use to guide annotation">
                  <option>Select AI model to use to guide annotation</option>
                  <option value="1">Elephant detection (nadir)</option>
                </Form.Select>
              </Form.Group>
            </>
          ) : (
            <>
              <Form.Group>
                <Form.Label>Width</Form.Label>
                <Form.Control
                  type="number"
                  value={width}
                  onChange={(x) => setWidth(Number(x.target.value))}
                  disabled={consistentImageSizes}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Height</Form.Label>
                <Form.Control
                  type="number"
                  value={height}
                  onChange={(x) => setHeight(Number(x.target.value))}
                  disabled={consistentImageSizes}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Number of horizontal tiles</Form.Label>
                <Form.Control
                  type="number"
                  value={horizontalTiles}
                  onChange={(x) => setHorizontalTiles(Number(x.target.value))}
                  disabled={consistentImageSizes}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Number of vertical tiles</Form.Label>
                <Form.Control
                  type="number"
                  value={verticalTiles}
                  onChange={(x) => setVerticalTiles(Number(x.target.value))}
                  disabled={consistentImageSizes}
                />
              </Form.Group>
              {consistentImageSizes && (
                <Form.Text className="text-muted">
                  Tiling is disabled because all images in the set have consistent dimensions.
                </Form.Text>
              )}
              <Form.Group>
                <Form.Label>Minimum overlap (%)</Form.Label>
                <Form.Control
                  type="number"
                  value={overlapPercent}
                  onChange={(x) => setOverlapPercent(Number(x.target.value))}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Minimum sidelap (%)</Form.Label>
                <Form.Control
                  type="number"
                  value={sidelapPercent}
                  onChange={(x) => setSidelapPercent(Number(x.target.value))}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Minimum X coordinate</Form.Label>
                <Form.Control
                  type="number"
                  value={minX}
                  onChange={(x) => setMinX(Number(x.target.value))}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Maximum X coordinate</Form.Label>
                <Form.Control
                  type="number"
                  value={maxX}
                  onChange={(x) => setMaxX(Number(x.target.value))}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Minimum Y coordinate</Form.Label>
                <Form.Control
                  type="number"
                  value={minY}
                  onChange={(x) => setMinY(Number(x.target.value))}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Maximum Y coordinate</Form.Label>
                <Form.Control
                  type="number"
                  value={maxY}
                  onChange={(x) => setMaxY(Number(x.target.value))}
                />
              </Form.Group>
            </>
          )}
          <Form.Group>
            <Form.Label>Task Name</Form.Label>
            <Form.Control
              type="string"
              value={name}
              onChange={(x) => setName(x.target.value)}
            />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={name.length == 0}
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


export default CreateTask;