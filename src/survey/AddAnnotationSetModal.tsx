import { Modal, Form, Button } from "react-bootstrap";
import { Schema } from "../../amplify/data/resource";
import { useState, useContext } from "react";
import { GlobalContext } from "../Context";
import LabelEditor from "./LabelEditor";

export default function AddAnnotationSetModal({
  show,
  onClose,
  project,
  addAnnotationSet,
}: {
  show: boolean;
  onClose: () => void;
  project: Schema["Project"]["type"];
  addAnnotationSet: (annotationSet: Schema["AnnotationSet"]["type"]) => void;
}) {
  const { client } = useContext(GlobalContext)!;
  const [name, setName] = useState("");
  const [saveLabels, setSaveLabels] = useState<
    ((annotationSetId: string, projectId: string) => Promise<void>) | null
  >(null);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    if (!name) {
      alert("Please enter a name for the annotation set");
      return;
    }

    setBusy(true);

    const { data: annotationSet } = await client.models.AnnotationSet.create({
      name,
      projectId: project.id,
    });

    if (annotationSet) {
      addAnnotationSet(annotationSet);

      if (saveLabels) {
        await saveLabels(annotationSet.id, project.id);
      }
    }

    onClose();
    setBusy(false);
  }

  return (
    <Modal show={show} onHide={onClose} size="xl">
      <Modal.Header>
        <Modal.Title>Add Annotation Set</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form className="d-flex flex-column gap-2">
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
              placeholder="Enter a name"
              onChange={(e) => setName(e.target.value)}
            />
          </Form.Group>
          <LabelEditor setHandleSave={setSaveLabels} />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={handleSave} disabled={busy}>
          {busy ? "Saving..." : "Save"}
        </Button>
        <Button variant="dark" onClick={onClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
