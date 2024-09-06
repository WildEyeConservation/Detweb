import React, { useContext, useState } from "react";
import { Stack, Modal, Form, Button } from "react-bootstrap";
import { UserContext } from "./UserContext";
import { ImageSetDropdown } from "./ImageSetDropDown";
import { imageSetMembershipsByImageSetName } from "./graphql/queries";
import backend from "../amplify_outputs.json";

interface RetileProps{
  show: boolean;
  handleClose: ()=> void;
}

interface ImageSetMembership {
  imageKey: string;
}

interface GraphQLResponse {
  data: {
    imageSetMembershipsByImageSetName: {
      items: ImageSetMembership[];
      nextToken: string | null;
    };
  };
}

const Retile: React.FC<RetileProps> = ({ show, handleClose }) =>{
  const [selectedSets, setImageSets] = useState<string[] | undefined>(undefined);
  const { invoke, gqlSend } = useContext(UserContext)!;

  async function handleSubmit() {
    if(!selectedSets) return;
    handleClose();
    let allItems: ImageSetMembership[] = [];

    for (const imageSet of selectedSets) {
      let nextToken: string | null = null;
      do {
        const response = await gqlSend(imageSetMembershipsByImageSetName, {
          imageSetName: imageSet,
          nextToken,
        }) as GraphQLResponse;
        const { items, nextToken: newNextToken } = response.data.imageSetMembershipsByImageSetName;
        allItems = allItems.concat(items);
        nextToken = newNextToken;
      } while (nextToken);
    }

    allItems.map(({ imageKey }) => {
      const params = {
        FunctionName:
          "arn:aws:lambda:af-south-1:275736403632:function:detweb-stack-test-tileImage42302E57-exz2oBIP9AFq",
        Payload: JSON.stringify({
          Records: [
            {
              s3: {
                bucket: { name: backend.custom.inputsBucket },
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
