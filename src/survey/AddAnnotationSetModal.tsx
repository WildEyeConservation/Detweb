import { Modal, Form, Button } from "react-bootstrap";
import { Schema } from "../../amplify/data/resource";
import { useState, useContext } from "react";
import { GlobalContext } from "../Context";

export default function AddAnnotationSetModal({
  show,
  onClose,
  project,
  addAnnotationSet,
  categories,
  setTab,
}: {
  show: boolean;
  onClose: () => void;
  project: Schema["Project"]["type"];
  addAnnotationSet: (annotationSet: Schema["AnnotationSet"]["type"]) => void;
  categories: { name: string }[];
  setTab: (tab: number) => void;
}) {
  const { client, showModal } = useContext(GlobalContext)!;
  const [name, setName] = useState("");

  async function handleSave() {
    const { data: annotationSet } = await client.models.AnnotationSet.create({
      name,
      projectId: project.id,
    });

    if (annotationSet) {
      addAnnotationSet(annotationSet);
    }

    onClose();
  }

  return (
    <Modal show={show} onHide={onClose}>
      <Modal.Header>
        <Modal.Title>Add Annotation Set</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group>
            <Form.Label className="mb-0">Name</Form.Label>
            <span
              className="text-muted d-block mb-1"
              style={{ fontSize: "12px" }}
            >
              A descriptive name for your annotation set to help you identify
              it.
            </span>
            <Form.Control
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Form.Group>
          <Form.Group>
            <Form.Label className="mt-3 mb-0">Labels</Form.Label>
            <span className="text-muted d-block" style={{ fontSize: "12px" }}>
              Labels are survey wide and may not be edited here.
            </span>
            <div
              className="d-flex flex-column gap-2 border p-2 mb-2 mt-1"
              style={{ fontSize: "14px" }}
            >
              {categories.length === 0 ? (
                <p className="mb-0">No labels found</p>
              ) : (
                categories
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((category) => (
                    <p key={crypto.randomUUID()} className="mb-0">
                      {category.name}
                    </p>
                  ))
              )}
            </div>
            <Button
              variant="info"
              onClick={() => {
                setTab(0); // Labels tab in edit modal
                showModal("editSurvey");
              }}
            >
              Edit Labels
            </Button>
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={handleSave}>
          Save
        </Button>
        <Button variant="dark" onClick={onClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
