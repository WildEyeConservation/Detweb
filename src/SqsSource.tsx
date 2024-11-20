import { useEffect, useState, useContext, useCallback } from "react";
import { UserContext,ProjectContext } from "./Context";
import { ReceiveMessageCommand, DeleteMessageCommand } from "@aws-sdk/client-sqs";

export default function useSQS(filterPredicate: (message: any) => Promise<boolean> = async () => { return true }) {
  const { currentPM } = useContext(ProjectContext)!;
  const {getSqsClient} = useContext(UserContext)!;
  const [url,setUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (currentPM.queueId) {
      currentPM.queue().then(
        ({ data: { url } }) => {
          setUrl(url);
        });
    }
  }, [currentPM]);
    
    const fetcher= useCallback(async (): Promise<Identifiable> => {
        while (true) {
            if (!url) {
                console.log('No queue URL set');
                await new Promise(resolve => setTimeout(resolve, 5000));
                continue;
            }
            const sqsClient = await getSqsClient()
            const response = await sqsClient.send(new ReceiveMessageCommand({
                QueueUrl: url,
                MaxNumberOfMessages: 1,
                MessageAttributeNames: ["All"],
                VisibilityTimeout: 600,
            }))
            if (response.Messages) {
                const entity = response.Messages[0];
                const body = JSON.parse(entity.Body!);
                body.message_id = crypto.randomUUID();
                // The messages we receive typically HAVE ids. These correspond to location ids. But there is no guarantee that we won't receive the same ID twice,
                // the admin may have launched the same task on the same queue twice, or one of our earlier messages may have passed its visibility timeout and
                // been refetched. So we have to assign our own id upon receipt to guarantee uniqueness.
                body.ack = async () => {
                    try {
                        const sqsClient = await getSqsClient();
                        await sqsClient.send(new DeleteMessageCommand({
                            QueueUrl: url,
                            ReceiptHandle: entity.ReceiptHandle,
                        }));
                    } catch {
                        console.log(
                            `Ack Failed for location ${body.id} with receipthandle ${entity.ReceiptHandle}`,
                        );
                    }
                };
                if (await filterPredicate(body)) {
                    return body;
                } else {
                    body.ack()
                }
            } else {
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }
  }, [url, getSqsClient, filterPredicate]);

  return {fetcher : url ? fetcher : undefined};
}
