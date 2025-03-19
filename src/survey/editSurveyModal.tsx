import { Modal, Button } from "react-bootstrap";
import { Schema } from "../../amplify/data/resource";
import { Tabs, Tab } from "../Tabs";
import LabelEditor from "./LabelEditor";
import { useState } from "react";

export default function EditSurveyModal({
  show,
  onClose,
  project,
  openTab,
}: {
  show: boolean;
  onClose: () => void;
  project: Schema["Project"]["type"];
  openTab?: number;
}) {
  const [saveLabels, setSaveLabels] = useState<
    ((projectId: string) => Promise<void>) | null
  >(null);
  const [tab, setTab] = useState(openTab || 0);
  const [loading, setLoading] = useState(false);

  return (
    <Modal show={show} onHide={onClose} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>Edit Survey: {project.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs defaultTab={openTab || 0} onTabChange={(tab) => setTab(tab)}>
          <Tab label="Labels" className="mt-1">
            <LabelEditor
              defaultLabels={project.categories.map((category) => ({
                id: category.id,
                name: category.name,
                shortcutKey: category.shortcutKey,
                color: category.color,
              }))}
              setHandleSave={setSaveLabels}
            />
          </Tab>
          <Tab label="Add GPS Data">Yes</Tab>
          <Tab label="Process Images">Yes</Tab>
          <Tab label="Create Subsets">Yes</Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            switch (tab) {
              case 0:
                if (saveLabels) {
                  await saveLabels(project.id);
                }
                break;
            }
            setLoading(false);
          }}
        >
          {loading ? "Saving..." : "Save"}
        </Button>
        <Button variant="dark" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
