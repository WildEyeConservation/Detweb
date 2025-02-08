import { useContext, useState } from "react";
import { Stack, Modal, Form, Button } from "react-bootstrap";
import { getLocationsInSet } from "./gqlQueries";
import { QueueDropdown } from "./QueueDropDown";
import { useUpdateProgress } from "./useUpdateProgress";
import { AnnotationSetDropdown } from "./AnnotationSetDropDown";
import { LocationSetDropdown } from "./LocationSetDropDown";
import { GlobalContext, ManagementContext, UserContext, ProjectContext } from "./Context";
import { SendMessageCommand, SendMessageBatchCommand } from "@aws-sdk/client-sqs";
import { aws_elasticloadbalancingv2_targets } from "aws-cdk-lib";
import { QueryCommand } from "@aws-sdk/client-dynamodb";
import { retryOperation } from './utils/retryOperation';
import pLimit from 'p-limit';

interface LaunchTaskProps {
  show: boolean;
  handleClose: () => void;
  selectedTasks: string[];
  setSelectedTasks: React.Dispatch<React.SetStateAction<string[]>>;
}

interface ObservationsResponse {
  data: {
    observationsByLocationId: {
      items: { id: string }[];
    };
  };
}

function LaunchTask({ show, handleClose, selectedTasks, setSelectedTasks }: LaunchTaskProps) {
  const { client, backend } = useContext(GlobalContext)!;
  const { getSqsClient, getDynamoClient } = useContext(UserContext)!;
  const { queuesHook: { data: queues } } = useContext(ManagementContext)!;
  const [queueId, setQueueId] = useState<string | null>(null);
  const [url2, setUrl2] = useState<string | null>(null);
  const [annotationSet, setAnnotationSet] = useState<string | undefined>(undefined);
  const [filterObserved, setFilterObserved] = useState(false);
  const [secondaryQueue, setSecondaryQueue] = useState(false);
  const [allowOutside, setAllowOutside] = useState(true);
  const userContext = useContext(UserContext);
  const [zoom, setZoom] = useState<number | undefined>(undefined);
  const [lowerLimit, setLowerLimit] = useState(0);
  const [upperLimit, setUpperLimit] = useState(1);
  const [taskTag, setTaskTag] = useState<string>('');
  const [skipLocationWithAnnotations, setSkipLocationWithAnnotations] = useState(false);
  if (!userContext) {
    return null;
  }
  const limitConnections = pLimit(10);

  async function queryLocations(locationSetId: string): Promise<string[]> {
    const dynamoClient = await getDynamoClient();
    const locationIds: string[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
        const command = new QueryCommand({
            TableName: backend.custom.locationTable,
            IndexName: "locationsBySetIdAndConfidence",
            KeyConditionExpression: "setId = :locationSetId and confidence BETWEEN :lowerLimit and :upperLimit",
            ExpressionAttributeValues: {
                ":locationSetId": {
                    "S": locationSetId
                },
              ":lowerLimit": {
                "N": lowerLimit.toString()
              },
              ":upperLimit": {
                "N": upperLimit.toString()
              }
            },
            ProjectionExpression: "id",
            ExclusiveStartKey: lastEvaluatedKey,
            // Increase page size for better throughput
            Limit: 1000
        });

        try {
          const response = await dynamoClient.send(command);
          setStepsCompleted((s: number) => s + response.Items.length)
            // Extract imageIds from the response
            if (response.Items) {
                const pageLocationIds = response.Items.map(item => item.id.S!);
                locationIds.push(...pageLocationIds);
            }
            lastEvaluatedKey = response.LastEvaluatedKey;
        } catch (error) {
            console.error("Error querying DynamoDB:", error);
            throw error;
        }
    } while (lastEvaluatedKey);

    return locationIds;
  }
  
  async function queryObservations(annotationSetId: string): Promise<string[]> {
    const dynamoClient = await getDynamoClient();
    const locationIds: string[] = [];
    let lastEvaluatedKey: Record<string, any> | undefined = undefined;
    do {
        const command = new QueryCommand({
            TableName: backend.custom.observationTable,
            IndexName: "observationsByAnnotationSetIdAndCreatedAt",
            KeyConditionExpression: "annotationSetId  = :annotationSetId ",
            ExpressionAttributeValues: {
                ":annotationSetId": {
                    "S": annotationSetId 
                }
            },
            ProjectionExpression: "locationId",
            ExclusiveStartKey: lastEvaluatedKey,
            // Increase page size for better throughput
            Limit: 1000
        });

        try {
          const response = await dynamoClient.send(command);
          setStepsCompleted((s: number) => s + response.Items.length)
            // Extract imageIds from the response
            if (response.Items) {
                const pageLocationIds = response.Items.map(item => item.locationId.S!);
                locationIds.push(...pageLocationIds);
            }
            lastEvaluatedKey = response.LastEvaluatedKey;
        } catch (error) {
            console.error("Error querying DynamoDB:", error);
            throw error;
        }
    } while (lastEvaluatedKey);
    return locationIds;
}


  const [setStepsCompleted, setTotalSteps] = useUpdateProgress({
    taskId: `Launch task`,
    indeterminateTaskName: `Loading locations`,
    determinateTaskName: "Enqueueing locations",
    stepFormatter: (count)=>`${count} locations`,
  });

  async function handleSubmit() {
    // try {
    handleClose();
    let promises = []
    setStepsCompleted(0);
    setTotalSteps(0);

    const allSeenLocations = filterObserved ? await queryObservations(annotationSet!) : [];
    const allLocations = await Promise.all(selectedTasks.map(async (task) => {
        return await queryLocations(task)
    })).then(arrays => arrays.flat()).then(locations => locations.filter(l => !allSeenLocations.includes(l)));
          
    setStepsCompleted(0);
    setTotalSteps(allLocations.length);
    let queueUrl = queues?.find(q => q.id == queueId)?.url;
    let secondaryQueueUrl = secondaryQueue ? queues?.find(q => q.id == url2)?.url : undefined;
    if (!queueUrl) {
      throw new Error("Queue URL not found");
    }

    if (zoom) {
      await client.models.Queue.update({id: queueId, zoom: zoom});
    }

    const batchSize = 10;
    for (let i = 0; i < allLocations.length; i += batchSize) {
      const locationBatch = allLocations.slice(i, i + batchSize);
      const batchEntries = [];
      
      for (const locationId of locationBatch) {
        const location = {id: locationId, annotationSetId: annotationSet};
        batchEntries.push({
          Id: `msg-${locationId}`, // Required unique ID for each message in batch
          MessageBody: JSON.stringify({ location, allowOutside, taskTag, secondaryQueueUrl, skipLocationWithAnnotations})
        });
      }

      if (batchEntries.length > 0) {  
        limitConnections(() =>
          getSqsClient().then(sqsClient => sqsClient.send(
            new SendMessageBatchCommand({
              QueueUrl: queueUrl,
              Entries: batchEntries
            })
          ))
        ).then(() => setStepsCompleted((s: number) => s + batchEntries.length));
      }
    }

    for (const taskId of selectedTasks) {
      await client.models.TasksOnAnnotationSet.create({
        annotationSetId: annotationSet!,
        locationSetId: taskId,
      });
    }

    // hack to trigger effect that updates tasks launched on annotation set
    await client.models.AnnotationSet.update({id: annotationSet!});
    // } catch (error) {
    //   console.error('Error in LaunchTask handleSubmit:', error);
    //   const errorDetails = {
    //     error: error instanceof Error ? error.stack : String(error),
    //     selectedTasks,
    //     queueId,
    //     annotationSet,
    //     filterObserved
    //   };
    //   if (error instanceof Error) {
    //     publishError('taskProgress/launchTask', `Error launching task: ${error.message}`, errorDetails);
    //   } else {
    //     publishError('taskProgress/launchTask', `Error launching task: ${String(error)}`, errorDetails);
    //   }
    //   location.annotationSetId = annotationSet;
    //   promises.push(
    //     sqsClient.send(
    //       new SendMessageCommand({
    //         QueueUrl: queueUrl!,
    //         MessageBody: JSON.stringify({location })
    //       })).then(() => setStepsCompleted((s: number) => s + 1))  
    //   );
    // }
  }

 
  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Launch Task</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Stack gap={4}>
            <Form.Group>
              <Form.Label>Location Set</Form.Label>
              <LocationSetDropdown
                setTasks={setSelectedTasks}
                selectedTasks={selectedTasks}
              />
              <Form.Check className="mt-2"
                type="switch"
                label="Skip locations with annotations"
                checked={skipLocationWithAnnotations}
                onChange={(x) => setSkipLocationWithAnnotations(x.target.checked)}
              />
              {/* <Form.Select onChange={(e)=>{setLocationSet(e.target.value)}} value={locationSet}>  
      {locationSet =="none" && <option>Select a location set to process:</option>}
      {locationSets?.map( q => <option key={q.id} value={q.id} >{q.name}</option>)}
      </Form.Select>   */}
            </Form.Group>
            <Form.Group>
              <Form.Label>Task Tag</Form.Label>
              <Form.Control
                type="text"
                value={taskTag}
                onChange={(e) => setTaskTag(e.target.value)}
                placeholder="Enter a tag for this task"
              />
            </Form.Group>
            <Form.Group>
              <Form.Label>Annotation Set</Form.Label>
              <AnnotationSetDropdown
                setAnnotationSet={setAnnotationSet}
                selectedSet={annotationSet}
              />
              <Form.Check className="mt-2"
                type="switch"
                label="Allow annotations outside location borders"
                checked={allowOutside}
                onChange={(x) => setAllowOutside(x.target.checked)}
              />
              <Form.Check className="mt-2"
                type="switch"
                label="Unobserved (on this annotationset) only"
                checked={filterObserved}
                onChange={(x) => setFilterObserved(x.target.checked)}
              />
              {/* <Form.Select onChange={(e)=>{if (e.target.value=="new"){onNewAnnotationSet().then(set=>setAnnotationSet(set))} else setAnnotationSet(e.target.value)}} value={annotationSet}>  
      {annotationSet=="none" && <option>Select an annotation set to apply the processing to:</option>}<option value="new">Add new Annotation Set</option>
      {annotationSets?.map( q => <option key={q.id} value={q.id} >{q.name}</option>)}
      </Form.Select>  */}
            </Form.Group>
            <Form.Group>
              <Form.Label>Target Queue</Form.Label>
              <QueueDropdown setQueue={setQueueId} currentQueue={queueId} />
            </Form.Group>
            <Form.Group>
              <Form.Check // prettier-ignore
                type="switch"
                id="custom-switch"
                label="Send Detections to secondary queue"
                checked={secondaryQueue}
                onChange={(x) => {
                  setSecondaryQueue(x.target.checked);
                }}
              />
              {secondaryQueue && (
                <Form.Group>
                  <Form.Label>Secondary queue</Form.Label>
                  <QueueDropdown setQueue={setUrl2} currentQueue={url2} />
                </Form.Group>
              )}
            </Form.Group>
            <Form.Group>
              <Form.Label>Zoom Level</Form.Label>
              <Form.Select 
                value={zoom} 
                onChange={(e) => setZoom(e.target.value=="auto" ? undefined : e.target.value)}
              >
                <option value="auto">Auto</option>
                {[...Array(13)].map((_, i) => (
                  <option key={i} value={i}>Level {i}</option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group>
              <Form.Label>Filter by confidence value:</Form.Label>
              <div className="d-flex align-items-center gap-2">
                <Form.Control
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={lowerLimit}
                  onChange={(e) => setLowerLimit(Number(e.target.value))}
                  style={{ width: '80px' }}
                />
                <span>to</span>
                <Form.Control
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={upperLimit}
                  onChange={(e) => setUpperLimit(Number(e.target.value))}
                  style={{ width: '80px' }}
                />
              </div>
            </Form.Group>
          </Stack>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!selectedTasks.length || !annotationSet || !queueId}
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


export default LaunchTask;