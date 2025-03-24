import { Modal, Button } from "react-bootstrap";
import { Schema } from "../../amplify/data/resource";
import { Tabs, Tab } from "../Tabs";
import LabelEditor from "./LabelEditor";
import { useState } from "react";
import AddGpsData from "../AddGpsData";
import ProcessImages from "../ProcessImages";
import CreateSubset from "../CreateSubset";
import LaunchRegistration from "../LaunchRegistration";

export default function EditSurveyModal({
  show,
  onClose,
  project,
  openTab,
  setSelectedSets,
}: {
  show: boolean;
  onClose: () => void;
  project: Schema["Project"]["type"];
  openTab?: number;
  setSelectedSets: (sets: string[]) => void;
}) {
  const [addGpsData, setAddGpsData] = useState<(() => Promise<void>) | null>(
    null
  );
  const [tab, setTab] = useState(openTab || 0);
  const [loading, setLoading] = useState(false);
  const [prevButtonLabel, setPrevButtonLabel] = useState("Save");
  const [buttonLabel, setButtonLabel] = useState("Save");
  const [processImages, setProcessImages] = useState<
    (() => Promise<void>) | null
  >(null);
  const [launchRegistration, setLaunchRegistration] = useState<
    (() => Promise<void>) | null
  >(null);

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
                label = "Submit";
                break;
              case 1:
                label = "Process";
                break;
              case 3:
                label = "Launch";
                break;
            }
            setButtonLabel(label);
            setPrevButtonLabel(label);
          }}
        >
          <Tab label="Add GPS Data" className="mt-1">
            <AddGpsData
              imageSets={project.imageSets}
              setHandleSubmit={setAddGpsData}
            />
          </Tab>
          <Tab label="Process Images" className="mt-1">
            <ProcessImages
              imageSets={project.imageSets}
              setHandleSubmit={setProcessImages}
            />
          </Tab>
          <Tab label="Create Subsets" className="mt-1">
            <CreateSubset
              imageSets={project.imageSets}
              setSelectedSets={setSelectedSets}
            />
          </Tab>
          <Tab label="Launch Registration" className="mt-1">
            <LaunchRegistration
              project={project}
              setHandleSubmit={setLaunchRegistration}
            />
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        {tab !== 2 && (
          <Button
            variant="primary"
            disabled={loading}
            onClick={async () => {
              setLoading(true);
              switch (tab) {
                case 0:
                  if (addGpsData) {
                    setButtonLabel("Submitting...");
                    await addGpsData();
                  }
                  break;
                case 1:
                  if (processImages) {
                    setButtonLabel("Processing...");
                    await processImages();
                  }
                  break;
                case 3:
                  if (launchRegistration) {
                    setButtonLabel("Launching...");
                    await launchRegistration();
                  }
                  break;
              }
              setButtonLabel(prevButtonLabel);
              setLoading(false);
            }}
          >
            {buttonLabel}
          </Button>
        )}
        <Button variant="dark" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
