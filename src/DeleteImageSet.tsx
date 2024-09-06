import { useContext, useState } from "react";
import { Stack, Modal, Form, Button } from "react-bootstrap";
import { useUpdateProgress } from "./useUpdateProgress";
import { ImageSetDropdown } from "./ImageSetDropDown";
import { UserContext } from "./UserContext";
import { gqlClient } from "./App";
import { graphqlOperation } from "./App";
import { GraphQLResult } from "aws-amplify/api";

interface DeleteImageSetProps {
  show: boolean;
  handleClose: () => void;
}

interface ImageSetMembership {
  id: string;
}

interface ImageSetMembershipsByImageSetNameResponse {
  imageSetMembershipsByImageSetName: {
    items: ImageSetMembership[];
    nextToken: string | null;
  };
}

function DeleteImageSet({ show, handleClose }: DeleteImageSetProps) {
  const [selectedSets, setSelectedSets] = useState<string[] | undefined>(undefined);
  
  const handleSelectSet = (selected: string[]) => {
    setSelectedSets(selected.length > 0 ? selected : undefined);
  };

  const userContext = useContext(UserContext);
  if (!userContext) {
    return null;
  }
  const { gqlSend } = userContext;
  const [setStepsCompleted, setTotalSteps] = useUpdateProgress({
    taskId: `Deleting Image set`,
    indeterminateTaskName: `Loading image set memberships`,
    determinateTaskName: "Deleting image set memberships",
    stepName: "memberships",
  });

  const imageSetMembershipsByImageSetName = /* GraphQL */ `
    query ImageSetMembershipsByImageSetName(
      $imageSetName: String!
      $nextToken: String
    ) {
      imageSetMembershipsByImageSetName(
        imageSetName: $imageSetName
        nextToken: $nextToken
      ) {
        items {
          id
        }
        nextToken
      }
    }
  `;

  const deleteImageSetMembership = `
  mutation MyMutation($id: ID = "") {
    deleteImageSetMembership(input: {id: $id}) {
      id
    }
  }`;

  const deleteImageSet = `
  mutation MyMutation($name: String = "") {
    deleteImageSet(input: {name: $name}) {
      name
    }
  }`;

  async function handleSubmit() {
    let nextToken: string | null = null,
      items: { id: string }[] = [],
      allItems : { id: string }[] = [];
    handleClose();
    setTotalSteps(0);
    do {
      const response = (await gqlClient.graphql(
        graphqlOperation(imageSetMembershipsByImageSetName, {
          imageSetName: selectedSets ? selectedSets[0] : undefined,
          nextToken,
        }),
      )) as GraphQLResult<ImageSetMembershipsByImageSetNameResponse>;

      const data = response.data?.imageSetMembershipsByImageSetName;
      if (data) {
        nextToken = data.nextToken;
        items = data.items;
        allItems = allItems.concat(items);
        setStepsCompleted(allItems.length);
      } else {
        break;
      }
    } while (nextToken);
    setTotalSteps(allItems.length);
    let i = 0;
    for (const id of allItems) {
      await gqlClient.graphql(graphqlOperation(deleteImageSetMembership, id));
      i += 1;
      setStepsCompleted(i);
    }
    await gqlSend(deleteImageSet, { name: selectedSets ? selectedSets[0] : undefined });
  }

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Delete Image Set</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Stack gap={4}>
            <Form.Group>
              <Form.Label>Image Set to delete</Form.Label>
              <ImageSetDropdown
                setImageSets={handleSelectSet} 
                selectedSets={selectedSets}
              />
            </Form.Group>
          </Stack>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={handleSubmit}
          disabled={!selectedSets}
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

export default DeleteImageSet;
