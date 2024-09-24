import { useContext, useState } from "react";
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

function CreateTask({ show, handleClose, selectedImageSets, setSelectedImageSets }: CreateTaskProps) {
  const { client, backend } = useContext(GlobalContext)!;
  const { sqsClient } = useContext(UserContext)!;
  const { project } = useContext(ProjectContext)!;
  const [sidelap, setSidelap] = useState<number>(-1000);
  const [overlap, setOverlap] = useState<number>(-1000);
  const [width, setWidth] = useState<number>(1024);
  const [name, setName] = useState<string>("");
  const [height, setHeight] = useState<number>(1024);
  const [modelGuided, setModelGuided] = useState(false);
  const userContext = useContext(UserContext);
  const { locationSetsHook: { create: createLocationSet } } = useContext(ManagementContext)!;
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
    let images: any[] = [];
    let prevNextToken: string | null | undefined = undefined;
    let allImages = [];
    do {
      const { data: images, nextToken } = await client.models.ImageSetMembership.imageSetMembershipsByImageSetId({
        imageSetId: selectedImageSets[0],
        selectionSet: ['image.timestamp', 'image.id','image.width','image.height'],
        nextToken: prevNextToken
      })
      prevNextToken = nextToken
      allImages = allImages.concat(images)
    } while (prevNextToken)
  setImagesCompleted(0);
  const locationSetId = createLocationSet({ name, projectId: project.id })
  if (modelGuided) {
      setTotalImages(allImages.length);
    for (const { image } of allImages) {
      const { data: imageFiles } = await client.models.ImageFile.imagesByimageId({ imageId: image.id })
      // FIXME: This is wrong. I am using the key from the jpeg file to deduce what the path to the h5 file is, but 
      // the right way to do this is to create a separate ImageFile entry as soon as we create the heatmap file.
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
      setTotalLocations(totalSteps);
      await Promise.all(promises);
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
          {/* <Form.Label>Image Set to process</Form.Label>
      <Form.Select onChange={(e)=>{selectSet(e.target.value)}} value={selectedSet}>  
      {!selectedSet && <option value="none">Select an image set to apply the processing to:</option>}
      {imageSets?.map( q => <option key={q.name} value={q.name}>{q.name}</option>)} 
      </Form.Select>   */}
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
                <Form.Label>Minimum overlap</Form.Label>
                <Form.Control
                  type="number"
                  value={overlap}
                  onChange={(x) => setOverlap(Number(x.target.value))}
                />
              </Form.Group>
              <Form.Group>
                <Form.Label>Minimum sidelap</Form.Label>
                <Form.Control
                  type="number"
                  value={sidelap}
                  onChange={(x) => setSidelap(Number(x.target.value))}
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
