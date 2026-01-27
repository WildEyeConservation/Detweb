import { Modal, Header, Title, Body } from '../Modal';
import { Schema } from '../amplify/client-schema';
import { Tabs, Tab } from '../Tabs';
import ProcessImages from './ProcessImages';
import EditShapeFile from './EditShapeFile';
import DefineTransects from './DefineTransects';
import EditInformation from './EditInformation';
import EditCameras from './EditCameras';
import AdvancedOptions from './AdvancedOptions';
import DeleteImages from './DeleteImages';
import Logs from './Logs';
import ManageTiles from './ManageTiles';

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
  return (
    <Modal show={show} onHide={onClose} strict={true}>
      <Header>
        <Title>Edit Survey: {project.name}</Title>
      </Header>
      <Body>
        <Tabs defaultTab={openTab || 0}>
          <Tab label='Information'>
            <EditInformation key={project.id} projectId={project.id} />
          </Tab>
          <Tab label='Process Images'>
            <ProcessImages key={project.id} projectId={project.id} />
          </Tab>
          <Tab label='Manage Tiles'>
            <ManageTiles key={project.id} project={project} />
          </Tab>
          <Tab label='Edit Cameras'>
            <EditCameras key={project.id} projectId={project.id} />
          </Tab>
          <Tab label='Edit Shape File'>
            <EditShapeFile key={project.id} projectId={project.id} />
          </Tab>
          <Tab label='Define Transects & Strata'>
            <DefineTransects key={project.id} projectId={project.id} />
          </Tab>
          <Tab label='Delete Images'>
            <DeleteImages key={project.id} projectId={project.id} />
          </Tab>
          <Tab label='Advanced Options'>
            <AdvancedOptions key={project.id} projectId={project.id} />
          </Tab>
          <Tab label='Logs'>
            <Logs key={project.id} projectId={project.id} />
          </Tab>
        </Tabs>
      </Body>
    </Modal>
  );
}
