import React, { useContext, useEffect, useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import { GlobalContext } from "./Context";
import { Tab, Tabs } from "./Tabs";
import MoveObservations from "./MoveObservations";
import { Schema } from "../amplify/data/resource";
import LabelEditor from "./survey/LabelEditor";

interface EditAnnotationSetModalProps {
  show: boolean;
  handleClose: () => void;
  annotationSet: { id: string; name: string };
  setAnnotationSet?: (annotationSet: { id: string; name: string }) => void;
  setSelectedSets?: (sets: string[]) => void;
  project: Schema["Project"]["type"];
  categories: { name: string }[];
  setEditSurveyTab: (tab: number) => void;
}

const EditAnnotationSetModal: React.FC<EditAnnotationSetModalProps> = ({
  show,
  handleClose,
  annotationSet,
  setSelectedSets,
  setAnnotationSet,
  project,
}) => {
  const { client } = useContext(GlobalContext)!;
  const [newName, setNewName] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [tab, setTab] = useState<number>(0);
  const [handleMove, setHandleMove] = useState<() => Promise<void>>(() =>
    Promise.resolve()
  );
  const [saveLabels, setSaveLabels] = useState<
    ((annotationSetId: string, projectId: string) => Promise<void>) | null
  >(null);

  const handleSave = async () => {
    if (annotationSet && newName.trim() !== "") {
      setBusy(true);

      const { data: result } = await client.models.AnnotationSet.update({
        id: annotationSet.id,
        name: newName,
      });

      if (setAnnotationSet && result) {
        setAnnotationSet({ id: result.id, name: result.name });
        if (saveLabels) {
          await saveLabels(annotationSet.id, project.id);
        }
      }

      handleClose();

      if (setSelectedSets) {
        setSelectedSets([]);
      }

      setBusy(false);
    }
  };

  useEffect(() => {
    setNewName(annotationSet.name);
  }, [annotationSet.name]);

  return (
    <Modal show={show} onHide={handleClose} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>Edit Annotation Set</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs
          onTabChange={(tab) => {
            setTab(tab);
          }}
        >
          <Tab label="Basic">
            <Form className="mt-1 d-flex flex-column gap-2">
              <Form.Group controlId="annotationSetName">
                <Form.Label>Name</Form.Label>
                <Form.Control
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Enter new name"
                />
              </Form.Group>
              <LabelEditor
                defaultLabels={project.annotationSets.find(
                  (set) => set.id === annotationSet.id
                )?.categories.map((category) => ({
                  id: category.id,
                  name: category.name,
                  shortcutKey: category.shortcutKey,
                  color: category.color,
                }))}
                setHandleSave={setSaveLabels}
              />
            </Form>
          </Tab>
          <Tab label="Advanced">
            <Form className="mt-1">
              <Form.Group controlId="moveObservations">
                <Form.Label style={{ fontSize: "16px", marginTop: "8px" }}>
                  Move Observations
                </Form.Label>
                <MoveObservations
                  annotationSetId={annotationSet.id}
                  project={project}
                  setHandleMove={setHandleMove}
                />
              </Form.Group>
            </Form>
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={() => {
            switch (tab) {
              case 0:
                handleSave();
                break;
              case 1:
                handleMove();
                break;
            }
          }}
        >
          {busy
            ? "Saving..."
            : tab === 1
            ? "Move Observations"
            : "Save Changes"}
        </Button>
        <Button
          variant="dark"
          onClick={() => {
            handleClose();
            if (setSelectedSets) {
              setSelectedSets([]);
            }
          }}
        >
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default EditAnnotationSetModal;
