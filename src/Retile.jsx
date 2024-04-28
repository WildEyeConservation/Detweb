import React, { useContext, useState } from "react";
import { Stack, Modal, Form, Button } from "react-bootstrap";
import { UserContext } from "./UserContext";
import { ImageSetDropdown } from "./ImageSetDropDown";
import { imageSetMembershipsByImageSetName } from "./graphql/queries";
import backendInfo from "./cdk-exports.json";
const backend = backendInfo["detweb-stack-develop"];

function Retile({ show, handleClose }) {
  const [selectedSets, setImageSets] = useState(undefined);
  const { invoke, gqlSend } = useContext(UserContext);

  async function handleSubmit() {
    handleClose();
    let nextToken, items;
    let allItems = [];
    for (const imageSet of selectedSets) {
      do {
        ({
          data: {
            imageSetMembershipsByImageSetName: { items, nextToken },
          },
        } = await gqlSend(imageSetMembershipsByImageSetName, {
          imageSetName: imageSet,
          nextToken,
        }));
        allItems = allItems.concat(items);
      } while (nextToken);
      //  allItems=allItems.filter(({imageKey})=>imageKey.startsWith("SangoDay1A/1122"))
      allItems.map(({ imageKey }) => {
        const params = {
          FunctionName:
            "arn:aws:lambda:af-south-1:275736403632:function:detweb-stack-develop-tileImage42302E57-exz2oBIP9AFq",
          Payload: JSON.stringify({
            Records: [
              {
                s3: {
                  bucket: { name: backend.imagesBucketOut },
                  object: { key: "public/images/" + imageKey },
                },
                eventName: "ObjectCreated",
              },
            ],
          }),
        };
        invoke(params);
      });
    }
  }

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Retile Images</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Stack gap={4}>
            <Form.Group>
              <Form.Label>Annotation Set</Form.Label>
              <ImageSetDropdown
                setImageSets={setImageSets}
                selectedSets={selectedSets}
              />
            </Form.Group>
            {/* <CsvDownloadButton data={[{x:1,y:2,timestamp:"Now"},{x:1,y:2,timestamp:"Now"},{x:1,timestamp:"Now"}]}>Download</CsvDownloadButton> */}
          </Stack>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!selectedSets}
        >
          Retile
        </Button>
        <Button variant="primary" onClick={handleClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default Retile;
