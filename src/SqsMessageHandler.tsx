import { useContext, useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Button from "react-bootstrap/Button";
import BaseImage from "./BaseImage";
import { UserContext } from "./UserContext";
import { ShowMarkers } from "./ShowMarkers";

const Image = BaseImage;

interface ErrData {
  image: { key: string };
  width: number;
  height: number;
  x: number;
  y: number;
  loc_id: string;
  msg: string;
  setId: string;
  ack: () => Promise<void>;
}

interface Message {
  showModal: boolean;
  errData: ErrData;
}

export function MessageHandler() {
  const { currentProject, user, getFromQueue, getQueueUrl, deleteFromQueue } =
    useContext(UserContext)!;
  const [queueUrl, setQueueUrl] = useState<string | null>();
  const [retry, setRetry] = useState(0);
  const [message, setMessage] = useState<Message | null>(null);
  const triggerRetry = () => setRetry((r) => r + 1);
  const { annotations } = useAnnotations(
    message?.errData.image.key || "",
    message?.errData?.setId || ""
  );

  useEffect(() => {
    if (user && currentProject) {
      const tryGetUrl = async () => {
        try {
          console.log(
            `trying to get the SQS queue URL for ${user.id}_${currentProject}`,
          );
          await getQueueUrl({ QueueName: `${user.id}_${currentProject}` }).then(
            ({ QueueUrl }) => {
              setQueueUrl(QueueUrl);
              console.log("URL set!");
            },
          );
        } catch (err) {
          console.log(`Failed to get URL. Will retry in 30s`);
          const timer = setTimeout(triggerRetry, 30000); //If the relevant msg queue we check back every 30s
          return () => {
            console.log(
              "User or project has changed. Clearing URL and stopping scheduled retries",
            );
            clearTimeout(timer);
            setQueueUrl(null);
          };
        }
      };
      tryGetUrl();
    }
  }, [currentProject, user, retry]);

  useEffect(() => {
    if (queueUrl && !message) {
      const checkForMessage = () =>
        getFromQueue({
          AttributeNames: ["SentTimestamp"],
          MaxNumberOfMessages: 1,
          MessageAttributeNames: ["All"],
          QueueUrl: queueUrl,
          VisibilityTimeout: 6000,
        }).then((response) => {
          if ("Messages" in response) {
            const entity = response.Messages[0];
            const body = JSON.parse(entity.Body);
            setMessage({
              showModal: true,
              errData: {
                image: { key: body.imageKey },
                width: 512,
                height: 512,
                x: body.x,
                y: body.y,
                loc_id: body.loc_id,
                msg: body.message,
                setId: body.annotationSetId,
                ack: async () => {
                  setMessage(null);
                  deleteFromQueue({
                    QueueUrl: queueUrl,
                    ReceiptHandle: entity.ReceiptHandle,
                  });
                },
              },
            });
          }
        });
      checkForMessage();
      const interval = setInterval(checkForMessage, 10000); // If the queue does exist, we check back every 10s
      return () => clearInterval(interval);
    }
  }, [queueUrl, message]);

  return (
    <Modal size="lg" show={message?.showModal} backdrop="static">
      {message?.errData && (
        <>
          <Modal.Header>
            <Modal.Title>{message.errData.msg}</Modal.Title>
          </Modal.Header>
          <Modal.Body text-center>
            <Row>
              <Col />
              <Col xs={10} className="align-middle justify-content-center">
                <Image
                  containerwidth="512px"
                  containerheight="512px"
                  img={{
                    key: message.errData.image.key,
                    width: message.errData.width,
                    height: message.errData.height,
                  }}
                  visible={true}
                  //id="image-id"
                  boundsxy={[[message.errData.x, message.errData.y], [message.errData.x + message.errData.width, message.errData.y + message.errData.height]]}
                  {...message.errData}
                >
                  <ShowMarkers annotations={annotations} />
                </Image>
              </Col>
              <Col />
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={message.errData.ack}>
              OK
            </Button>
          </Modal.Footer>
        </>
      )}
    </Modal>
  );
}
