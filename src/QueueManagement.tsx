import { useContext, useEffect, useState } from 'react';
import { Button, Row, Tooltip, OverlayTrigger, Col } from 'react-bootstrap';
import { UserContext, ManagementContext, GlobalContext } from './Context';
import MyTable from './Table';
import { PurgeQueueCommand, GetQueueAttributesCommand } from '@aws-sdk/client-sqs'
import { type GetQueueAttributesCommandInput } from '@aws-sdk/client-sqs'
import { Schema } from '../amplify/data/resource'
import EditQueueModal from './EditQueueModal';
// import { publishError } from './ErrorHandler';
import ActionsDropdown from './ActionsDropdown';

export default function QueueManagement() {
  const { getSqsClient } = useContext(UserContext)!;
  const { modalToShow, showModal } = useContext(GlobalContext)!
  const { queuesHook: { data: queues, create: createQueue, delete : deleteQueue } } = useContext(ManagementContext)!;
  const { projectMembershipHook: { data: projectMemberships, update: updateProjectMembership } } = useContext(ManagementContext)!;
  const [messageCounts, setMessageCounts] = useState<{ [key: string]: number }>({});
  const [editQueueId, setEditQueueId] = useState<string | null>(null);
  

  const getSubscribedUsersCount = (queueId:string) => {
    return projectMemberships!.filter((pm) => pm.queueId === queueId).length;
  };

  async function getMessageCount(queueUrl:string) {
    try {
      const params : GetQueueAttributesCommandInput = {
        QueueUrl: queueUrl,
        AttributeNames: ['ApproximateNumberOfMessages'],
      };
      const sqsClient = await getSqsClient();
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
        if (queue.url) {
          newCounts[queue.url] = await getMessageCount(queue.url);
        }
      }
      setMessageCounts(newCounts);
    };
    updateMessageCounts();
    const intervalId = setInterval(updateMessageCounts, 60000);
    return () => clearInterval(intervalId);
  }, [queues]);

  const deleteQueueHandler = async (queue:Schema['Queue']['type']) => {
    // try {
       // TODO: Implement queue deletion logic
      // This should include:
      // 1. Deleting the queue from SQS
      // 2. Updating any users who were subscribed to this queue
      // 3. Removing the queue from the local state
      await deleteQueue(queue);
      console.log(`Queue ${queue.id} deleted successfully`);
    // } catch (error) {
    //   console.error('Error deleting queue:', error);
    //   const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    //   publishError(`Error deleting queue: ${errorMessage}`);
    // }
  };

  const unsubscribeAllUsers = async (queueId:string) => {
    // try {
      console.log('Unsubscribing all users from queue:', queueId);
      const usersToUpdate = projectMemberships?.filter(pm => pm.queueId === queueId);
      if (usersToUpdate && usersToUpdate.length > 0) {
        await Promise.all(usersToUpdate.map(pm => updateProjectMembership({ id: pm.id, queueId: null })));
        console.log(`Unsubscribed ${usersToUpdate.length} users from queue ${queueId}`);
      } else {
        console.log(`No users subscribed to queue ${queueId}`);
      }
    // } catch (error) {
    //   console.error('Error unsubscribing users:', error);
    //   const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    //   publishError(`Error unsubscribing users from queue: ${errorMessage}`);
    // }
  };

  const purgeQueueHandler = async (queueUrl:string) => {
    // try {
    console.log('Purging queue:', queueUrl);
    const sqsClient = await getSqsClient();
      await sqsClient.send(new PurgeQueueCommand({QueueUrl: queueUrl}));
      console.log(`Queue ${queueUrl} purged successfully`);
    // } catch (error) {
    //   console.error('Error purging queue:', error);
    //   const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    //   publishError(`Error purging queue: ${errorMessage}`);
    // }
  };

  const tableData = queues
    ?.map((queue) => {
      const subscribedUsersCount = getSubscribedUsersCount(queue.id);
      const messageCount = queue.url ? messageCounts[queue.url] : 0;
      const isDeleteDisabled = (subscribedUsersCount > 0) || (messageCount > 0);

      const deleteTooltip = (
        <Tooltip id={`tooltip-${queue.url}`}>
          Queue must be empty and have no subscribed users to be eligible for deletion.
        </Tooltip>
      );

      return {
        id: queue.id,
        name: queue.name, // Add this line to include the name for sorting
        rowData: [
          queue.name,
          subscribedUsersCount,
          <span key={`${queue.url}-count`}>{messageCount}</span>,
          <div key={`${queue.url}-actions`}>
            <ActionsDropdown actions={[
              {label: "Edit", onClick: () => {
                setEditQueueId(queue.id);
                showModal('editQueue');
              }},
              {label: "Unsubscribe All", onClick: () => unsubscribeAllUsers(queue.id)},
              {label: "Purge Queue", onClick: () => purgeQueueHandler(queue.url!)}
            ]} />
            <OverlayTrigger
              placement="top"
              overlay={deleteTooltip}
              trigger={['hover', 'focus']}
              show={isDeleteDisabled ? undefined : false}
            >
              <span>
                <Button 
                  className="me-2 fixed-width-button"
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
      <EditQueueModal show={modalToShow === 'editQueue'} onClose={() => showModal(null)} queueId={editQueueId} />
    </Row>
  );
}
