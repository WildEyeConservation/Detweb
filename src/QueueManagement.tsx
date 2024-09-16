import { useContext, useEffect, useState } from 'react';
import { Button, Row, Tooltip, OverlayTrigger, Col } from 'react-bootstrap';
import { UserContext, ManagementContext } from './Context';
import MyTable from './Table';
import { PurgeQueueCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs'
import { type GetQueueAttributesCommandInput } from '@aws-sdk/client-sqs'
import { Schema } from '../amplify/data/resource'


export default function QueueManagement() {
  const { sqsClient } = useContext(UserContext)!;
  const { queuesHook: { data: queues, create: createQueue, delete : deleteQueue } } = useContext(ManagementContext)!;
  const { projectMembershipHook: { data: projectMemberships, update: updateProjectMembership } } = useContext(ManagementContext)!;
  const [messageCounts, setMessageCounts] = useState<{ [key: string]: number }>({});
  

  const getSubscribedUsersCount = (queueUrl:string) => {
    return projectMemberships!.filter((pm) => pm.queueUrl === queueUrl).length;
  };

  async function getMessageCount(queueUrl:string) {
    try {
      const params : GetQueueAttributesCommandInput = {
        QueueUrl: queueUrl,
        AttributeNames: ['ApproximateNumberOfMessages'],
      };
      const result = await sqsClient.send(new GetQueueAttributesCommand(params));
      return parseInt(result.Attributes?.ApproximateNumberOfMessages||"0", 10);
    } catch (error) {
      console.error('Error fetching message count:', error);
      return -1;
    }
  }

  useEffect(() => {
    const updateMessageCounts = async () => {
      const newCounts:{[key: string]: number} = {};
      for (const queue of queues) {
        if (queue.url.length > 0) {
          newCounts[queue.url] = await getMessageCount(queue.url);
        }
      }
      setMessageCounts(newCounts);
    };
    updateMessageCounts();
    const intervalId = setInterval(updateMessageCounts, 10000);
    return () => clearInterval(intervalId);
  }, [queues]);

  const deleteQueueHandler = async (queue:Schema['Queue']['type']) => {
    try {
       // TODO: Implement queue deletion logic
      // This should include:
      // 1. Deleting the queue from SQS
      // 2. Updating any users who were subscribed to this queue
      // 3. Removing the queue from the local state
      deleteQueue(queue);
    } catch (error) {
      console.error('Error deleting queue:', error);
    }
  };

  const unsubscribeAllUsers = (queueUrl:string) => {
    console.log('Unsubscribe all users button pressed for queue:', queueUrl);
    projectMemberships?.filter(pm => pm.queueUrl === queueUrl)?.forEach(
      pm => updateProjectMembership({ id: pm.id, queueUrl: null }))
  };

  const purgeQueueHandler = (queueUrl:string) => {
    console.log('Purge queue button pressed for queue:', queueUrl);
    sqsClient.send(new PurgeQueueCommand({QueueUrl: queueUrl}));
    // TODO: Implement purge queue logic
  };

  const tableData = queues
    ?.map((queue) => {
      const subscribedUsersCount = getSubscribedUsersCount(queue.url);
      const messageCount = messageCounts[queue.url];
      const isDeleteDisabled = (subscribedUsersCount > 0) || (messageCount > 0);

      const deleteTooltip = (
        <Tooltip id={`tooltip-${queue.url}`}>
          Queue must be empty and have no subscribed users to be eligible for deletion.
        </Tooltip>
      );

      return {
        id: queue.url,
        name: queue.name, // Add this line to include the name for sorting
        rowData: [
          queue.name,
          subscribedUsersCount,
          <span key={`${queue.url}-count`}>{messageCount}</span>,
          <div key={`${queue.url}-actions`}>
            <Button variant="warning" className="me-2" onClick={() => unsubscribeAllUsers(queue.url)}>
              Unsubscribe All
            </Button>
            <Button variant="info" className="me-2" onClick={() => purgeQueueHandler(queue.url)}>
              Purge Queue
            </Button>
            <OverlayTrigger
              placement="top"
              overlay={deleteTooltip}
              trigger={['hover', 'focus']}
              show={isDeleteDisabled ? undefined : false}
            >
              <span>
                <Button 
                  className="me-2"
                  variant="danger" 
                  onClick={() => deleteQueueHandler(queue)}
                  disabled={isDeleteDisabled}
                >
                  Delete
                </Button>
              </span>
            </OverlayTrigger>
          </div>,
        ],
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name)); // Sort the tableData array by name

  const tableHeadings = [
    { content: 'Queue Name' , style: { width: "300px" } },
    { content: 'Subscribed Users' },
    { content: 'Messages in Queue' },
    { content: 'Actions' },
  ];

  const addQueue = () => {
    const queueName = prompt("Please enter the name for the new queue:");
    if (queueName) {
      console.log('Adding new queue:', queueName);
      createQueue(queueName);
      // TODO: Implement actual queue creation logic
    }
  };

  return (
    <Row className="justify-content-center mt-3">
      <div>
        <h2>Queue Management</h2>
        <MyTable tableHeadings={tableHeadings} tableData={tableData || []} />
        <Col className="text-center mt-3">
          <Button variant="primary" onClick={addQueue}>
            Add New Queue
          </Button>
        </Col>
      </div>
    </Row>
  );
}
