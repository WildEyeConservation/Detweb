import { Modal, Form, Button } from "react-bootstrap";
import { Schema } from "../../amplify/data/resource";
import { useState, useContext, useEffect } from "react";
import { GlobalContext, UserContext } from "../Context";
import LabelEditor from "./LabelEditor";
import { LoadBalancerListenerProtocol } from "aws-cdk-lib/cloud-assembly-schema";

export default function AddAnnotationSetModal({
  show,
  onClose,
  project,
  addAnnotationSet,
  allProjects,
}: {
  show: boolean;
  onClose: () => void;
  project: Schema["Project"]["type"];
  addAnnotationSet: (annotationSet: Schema["AnnotationSet"]["type"]) => void;
  allProjects: Schema["Project"]["type"][];
}) {
  const { client } = useContext(GlobalContext)!;
  const [name, setName] = useState("");
  const [saveLabels, setSaveLabels] = useState<
    ((annotationSetId: string, projectId: string) => Promise<void>) | null
  >(null);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedAnnotationSet, setSelectedAnnotationSet] =
    useState<string>("");
  const [busy, setBusy] = useState(false);
  const [importedLabels, setImportedLabels] = useState<Schema["Category"]["type"][]>([]);

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

  function handleAnnotationSetChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const annotationSetId = e.target.value;
    setSelectedAnnotationSet(annotationSetId);

    const annotationSet = allProjects
      .find((p) => p.id === selectedProject)
      ?.annotationSets.find((s) => s.id === annotationSetId);

    if (annotationSet) {
      setImportedLabels(annotationSet.categories);
    }
  }

  return (
    <Modal show={show} onHide={onClose} size="xl">
      <Modal.Header closeButton>
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
          <Form.Group>
            <Form.Label className="mb-0">Load Labels</Form.Label>
            <span
              className="text-muted d-block mb-1"
              style={{ fontSize: "12px" }}
            >
              Load labels from a previous annotation set.
            </span>
            <Form.Select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
            >
              <option value="">Select a survey</option>
              {allProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Form.Select>
            <Form.Select
              className="mt-1"
              disabled={!selectedProject}
              value={selectedAnnotationSet}
              onChange={handleAnnotationSetChange}
            >
              <option value="">Select an annotation set</option>
              {allProjects
                .find((p) => p.id === selectedProject)
                ?.annotationSets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </Form.Select>
          </Form.Group>
          <LabelEditor
            importLabels={importedLabels}
            setHandleSave={setSaveLabels}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={handleSave} disabled={busy}>
          {busy ? "Creating..." : "Create"}
        </Button>
        <Button variant="dark" onClick={onClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
