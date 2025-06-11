import { Modal, Button } from "react-bootstrap";
import { Schema } from "../../amplify/data/resource";
import { Tabs, Tab } from "../Tabs";
import { useState } from "react";
import ProcessImages from "./ProcessImages";
import CreateSubset from "../CreateSubset";

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
  setSelectedSets: (sets: string[]) => void;
}) {
  const [handleSubmit, setHandleSubmit] = useState<
    (() => Promise<void>) | null
  >(null);
  const [tab, setTab] = useState(openTab || 0);
  const [loading, setLoading] = useState(false);
  const [prevButtonLabel, setPrevButtonLabel] = useState("Process");
  const [buttonLabel, setButtonLabel] = useState("Process");
  const [submitDisabled, setSubmitDisabled] = useState(false);

  function handleOnClick() {
    if (handleSubmit) {
      handleSubmit();
    }
  }

  return (
    <Modal show={show} onHide={onClose} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>Edit Survey: {project.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs
          defaultTab={openTab || 0}
          onTabChange={(tab) => {
            setTab(tab);
            let label = "";
            switch (tab) {
              case 0:
                label = "Process";
                break;
              case 1:
                label = "Transect Definition";
                break;
              case 2:
                label = "Create Subsets";
                break;
            }
            setButtonLabel(label);
            setPrevButtonLabel(label);
          }}
          className="mb-2"
        >
          <Tab label="Process Images">
            <ProcessImages
              onClose={onClose}
              projectId={project.id}
              setHandleSubmit={setHandleSubmit}
              setSubmitDisabled={setSubmitDisabled}
            />
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          disabled={submitDisabled}
          onClick={handleOnClick}
        >
          {buttonLabel}
        </Button>
        <Button variant="dark" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
