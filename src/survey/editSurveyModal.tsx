import { Modal, Button } from "react-bootstrap";
import { Schema } from "../../amplify/data/resource";
import { Tabs, Tab } from "../Tabs";
import { useState } from "react";
import AddGpsData from "../AddGpsData";
import ProcessImages from "../ProcessImages";
import CreateSubset from "../CreateSubset";

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

  return (
    <Modal show={show} onHide={onClose} size="xl">
      <Modal.Header closeButton>
        <Modal.Title>Edit Survey: {project.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs
          defaultTab={openTab || 0}
          onTabChange={(tab) => {
            // setTab(tab);
            // let label = "";
            // switch (tab) {
            //   case 0:
            //     label = "Submit";
            //     break;
            //   case 1:
            //     label = "Process";
            //     break;
            //   case 3:
            //     label = "Launch";
            //     break;
            // }
            // setButtonLabel(label);
            // setPrevButtonLabel(label);
          }}
        >
          <Tab label="Transects" className="mt-1">
            <p className="mb-0">
            Transects
            </p>
          </Tab>
          <Tab label="Create Subsets" className="mt-1">
            <CreateSubset
              imageSets={project.imageSets}
              setSelectedSets={setSelectedSets}
            />
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="dark" onClick={onClose}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
