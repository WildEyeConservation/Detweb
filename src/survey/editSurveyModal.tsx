import { Modal, Button } from 'react-bootstrap';
import { Schema } from '../../amplify/data/resource';
import { Tabs, Tab } from '../Tabs';
import { useState } from 'react';
import ProcessImages from './ProcessImages';
import CreateSubset from '../CreateSubset';
import EditShapeFile from './EditShapeFile';
import DefineTransects from './DefineTransects';
import EditInformation from './EditInformation';
import EditCameras from './EditCameras';

export default function EditSurveyModal({
  show,
  onClose,
  project,
  openTab,
}: {
  show: boolean;
  onClose: () => void;
  project: Schema['Project']['type'];
  openTab?: number;
  setSelectedSets: (sets: string[]) => void;
}) {
  const [handleSubmit, setHandleSubmit] = useState<
    (() => Promise<void>) | null
  >(null);
  const [tab, setTab] = useState(openTab || 0);
  const [prevButtonLabel, setPrevButtonLabel] = useState('Save');
  const [buttonLabel, setButtonLabel] = useState('Save');
  const [submitDisabled, setSubmitDisabled] = useState(false);
  const [closeDisabled, setCloseDisabled] = useState(false);

  function handleOnClick() {
    if (handleSubmit) {
      handleSubmit();
    }
  }

  return (
    <Modal show={show} onHide={onClose} size='xl' backdrop='static'>
      <Modal.Header>
        <Modal.Title>Edit Survey: {project.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs
          defaultTab={openTab || 0}
          onTabChange={(tab) => {
            setTab(tab);
            let label = '';
            switch (tab) {
              case 0:
                label = 'Save';
                break;
              case 1:
                label = 'Process';
                break;
              case 2:
                label = 'Save Cameras';
                break;
              case 3:
                label = 'Save Shapefile';
                break;
              case 4:
                label = 'Save Work';
                break;
            }
            setButtonLabel(label);
            setPrevButtonLabel(label);
          }}
          className='mb-2'
        >
          <Tab label='Information'>
            <EditInformation
              key={project.id}
              projectId={project.id}
              setHandleSubmit={setHandleSubmit}
              setSubmitDisabled={setSubmitDisabled}
              setCloseDisabled={setCloseDisabled}
            />
          </Tab>
          <Tab label='Process Images'>
            <ProcessImages
              key={project.id}
              onClose={onClose}
              projectId={project.id}
              setHandleSubmit={setHandleSubmit}
              setSubmitDisabled={setSubmitDisabled}
            />
          </Tab>
          <Tab label='Edit Cameras'>
            <EditCameras
              key={project.id}
              projectId={project.id}
              setHandleSubmit={setHandleSubmit}
              setSubmitDisabled={setSubmitDisabled}
              setCloseDisabled={setCloseDisabled}
            />
          </Tab>
          <Tab label='Edit Shape File'>
            <EditShapeFile
              key={project.id}
              projectId={project.id}
              setHandleSubmit={setHandleSubmit}
              setSubmitDisabled={setSubmitDisabled}
              setCloseDisabled={setCloseDisabled}
            />
          </Tab>
          <Tab label='Define Transects & Strata'>
            <DefineTransects
              key={project.id}
              projectId={project.id}
              setHandleSubmit={setHandleSubmit}
              setSubmitDisabled={setSubmitDisabled}
              setCloseDisabled={setCloseDisabled}
            />
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant='primary'
          disabled={submitDisabled}
          onClick={handleOnClick}
        >
          {buttonLabel}
        </Button>
        <Button variant='dark' onClick={onClose} disabled={closeDisabled}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
