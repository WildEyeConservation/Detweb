import { useEffect, useState, useContext, useCallback } from "react";
import { UserContext,ProjectContext } from "./Context";
import { ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";

interface SQSMessage {
  message_id: string;
  ack: () => Promise<void>;
  id?: string;
}

export default function useSQS() {
  const { currentPM } = useContext(ProjectContext)!;
  const {getSqsClient} = useContext(UserContext)!;
  const [buffer, setBuffer] = useState<SQSMessage[]>([]);
  const [url,setUrl] = useState<string | undefined>(undefined);
  const [retryCount] = useState(0);
  const [index, setIndex] = useState(0);
  const next = useCallback(() => setIndex(index=>index + 1), []);
  const prev = useCallback(() => setIndex(index=>index - 1), []);

  const margin = 3;
  console.log("sqs!!!!");

  useEffect(() => {
    if (currentPM.queueId) {
      currentPM.queue().then(
        ({ data: { url } }) => {
          setUrl(url);
        });
    }
  }, [currentPM]);

  function getMessages() {
    //Then try to get new Jobs.

    getSqsClient().then(sqsClient => sqsClient.send(new ReceiveMessageCommand({
      QueueUrl: url,
      MaxNumberOfMessages: 10,
      MessageAttributeNames: ["All"],
      VisibilityTimeout: 600,
      })).then((messages) => {
      if ("Messages" in messages) {
        const bodies = messages.Messages.map((entity: { ReceiptHandle: any; Body: string; }) => {
          // const timer = setInterval(() => {
          //   refreshVisibility({
          //     // ChangeMessageVisibilityRequest
          //     QueueUrl: currentQueue, // required
          //     ReceiptHandle: entity.ReceiptHandle, // required
          //     VisibilityTimeout: 60, // required
          //   });
          // }, 30000);
          const body = JSON.parse(entity.Body);
          body.message_id = crypto.randomUUID();
          // The messages we recieve typically HAVE ids. These correspond to location ids. But there is no guarantee that we won't receive the same ID twice,
          // the admin may have launched the same task on the same queue twice, or one of our earlier messages may have passed its visibility timeout and
          // been refetched. So we have to assign our own id upon receipt to guarantee uniqueness.
          body.ack = async () => {
            try {
              const sqsClient = await getSqsClient();
              await sqsClient.send(new DeleteMessageCommand({
                QueueUrl: url,
                ReceiptHandle: entity.ReceiptHandle,
              }));
              //clearInterval(timer);
              console.log(
                `Ack Succeeded for location ${body.message_id} with receipthandle ${entity.ReceiptHandle}`,
              );
            } catch {
              console.log(
                `Ack Failed for location ${body.id} with receipthandle ${entity.ReceiptHandle}`,
              );
            }
          };
          return body;
        });
        setBuffer((buffer_) => buffer_.concat(bodies));
      } else {
        //If no messages were available, try again in 5s
        setTimeout(getMessages, 5000);
      }
    }));
  }

  //If the index gets too close to the end of the buffer we need to load mode messages.
  useEffect(() => {
    console.log("here we go");
    //If we CAN access SQS and we NEED additional jobs
    if (buffer.length - index <= margin && url) {
      getMessages();
    }
  }, [index, retryCount, buffer, url ]);

  const inject = (message: SQSMessage) => {
    setBuffer((buffer_) => [
      ...buffer_.slice(0, index + 3),
      message,
      ...buffer_.slice(index + 3),
    ]);
  };
  return {
    buffer,
    index,
    next,
    prev,
    inject,
  };
}
