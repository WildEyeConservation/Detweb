import { useContext, useState, useEffect, useCallback, useRef } from "react";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Modal from "react-bootstrap/Modal";
import { UserContext, GlobalContext, ManagementContext, ProjectContext } from "./Context";
import { useUpdateProgress } from "./useUpdateProgress";
import { ImageSetDropdown } from "./ImageSetDropDown";
//import { subset } from "mathjs";
import { SendMessageCommand } from "@aws-sdk/client-sqs";

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

  useEffect(() => {
    async function fetchImageDimensions() {
      const { data: images } = await client.models.ImageSetMembership.imageSetMembershipsByImageSetId({
        imageSetId: selectedImageSets[0],
        selectionSet: ['image.width', 'image.height'],
        limit: 1
      });
      if (images.length > 0) {
        const dimensions = { width: images[0].image.width, height: images[0].image.height };
        setImageDimensions(dimensions);
        setWidth(dimensions.width);
        setHeight(dimensions.height);
      }
    }
    if (selectedImageSets.length > 0) {
      fetchImageDimensions();
    }
  }, [selectedImageSets, client.models.ImageSetMembership]);

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
    stepFormatter: (x:number) => `${x} images`
  });
  const [setLocationsCompleted, setTotalLocations] = useUpdateProgress({
    taskId: `Create task`,
    indeterminateTaskName: `Loading locations`,
    determinateTaskName: "Processing locations",
    stepFormatter: (x:number) => `${x} locations`
  });

  const [threshold, setThreshold] = useState(5); // New state variable for threshold

  async function handleSubmit() {
    try {
      handleClose();
      setTotalImages(0);
      let images: any[] = [];
      let prevNextToken: string | null | undefined = undefined;
      let allImages = [];
      do {
        const { data: images, nextToken } = await client.models.ImageSetMembership.imageSetMembershipsByImageSetId({
          imageSetId: selectedImageSets[0],
          selectionSet: ['image.timestamp', 'image.id','image.width','image.height'],
          nextToken: prevNextToken
        });
        prevNextToken = nextToken;
        allImages = allImages.concat(images);
      } while (prevNextToken);

      setImagesCompleted(0);
      const locationSetId = createLocationSet({ name, projectId: project.id });

      if (modelGuided) {
        setTotalImages(allImages.length);
        for (const { image } of allImages) {
          const { data: imageFiles } = await client.models.ImageFile.imagesByimageId({ imageId: image.id })
          const key = imageFiles.find((x: any) => x.type == 'image/jpeg')?.key.replace('images','heatmaps')
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
              const y = Math.round(
                yStep * (yStepSize ? yStepSize : 0) + height / 2,
              );
              if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                promises.push(
                  client.models.Location.create({
                    x,
                    y,
                    width,
                    height,
                    imageId: image.id,
                    projectId: project.id,
                    source: 'manual',
                    setId: locationSetId,
                  }).then(() => setLocationsCompleted((fc: any) => fc + 1)),
                );
              }
            }
          }
        }
        setTotalLocations(totalSteps);
        await Promise.all(promises);
      }
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      publishError(`Error creating task: ${error.message}`);
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
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Height</Form.Label>
                <Form.Control
                  type="number"
                  value={height}
                  onChange={(x) => setHeight(Number(x.target.value))}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Number of horizontal tiles</Form.Label>
                <Form.Control
                  type="number"
                  value={horizontalTiles}
                  onChange={(x) => setHorizontalTiles(Number(x.target.value))}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Number of vertical tiles</Form.Label>
                <Form.Control
                  type="number"
                  value={verticalTiles}
                  onChange={(x) => setVerticalTiles(Number(x.target.value))}
                />
              </Form.Group>
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
