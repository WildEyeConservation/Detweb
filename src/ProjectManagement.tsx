import { useContext } from 'react';
import { Button, Card } from 'react-bootstrap';
import { Tabs, Tab } from './Tabs';
import QueueManagement from './QueueManagement.tsx';
import ImageSetManagement from './ImageSetManagement.tsx';
import DefineCategories from './DefineCategories.tsx';
import { GlobalContext, ProjectContext } from './Context.tsx';
import DeleteImageSet from './DeleteImageSet.tsx';
import FilesUploadComponent from './FilesUploadComponent.tsx';
import ExportData from './ExportData.tsx';
import TaskManagement from './TaskManagement.tsx';
import AnnotationSetManagement from './AnnotationSetManagement.tsx';
import { DevActions } from './DevActions.tsx';
import { useNavigate } from 'react-router-dom';

const ProjectManagement = () => {
  const { project } = useContext(ProjectContext)!;
  const navigate = useNavigate();
  const { modalToShow, showModal } = useContext(GlobalContext)!;

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1555px',
        marginTop: '16px',
        marginBottom: '16px',
      }}
    >
      <Card>
        <Card.Body>
          <Card.Title className="d-flex justify-content-between align-items-center">
            <h4 className="mb-3">Advanced Management for {project.name}</h4>
            <Button variant="dark" onClick={() => navigate(`/surveys`)}>
              Back to Surveys
            </Button>
          </Card.Title>
          <Tabs defaultTab={0}>
            <Tab label="Image Sets">
              <ImageSetManagement key={'imsets' + project.id} />
            </Tab>
            {/* <Tab label="Labels">
              <DefineCategories key={'cats' + project.id} />
            </Tab> */}
            {/* <Tab label="Tasks">
              <TaskManagement key={'tasks' + project.id} />
            </Tab> */}
            {/* <Tab label="Annotation Sets">
              <AnnotationSetManagement key={'asets' + project.id} />
            </Tab> */}
            {/* <Tab label="Jobs">
              <QueueManagement key={'queues' + project.id} />
            </Tab> */}
            {process.env.NODE_ENV == 'development' && (
              <Tab label="Dev Actions">
                <DevActions />
              </Tab>
            )}
          </Tabs>
        </Card.Body>
      </Card>
      <DeleteImageSet
        show={modalToShow == 'deleteImageSet'}
        handleClose={() => showModal(null)}
      />
      <FilesUploadComponent
        show={modalToShow == 'addFiles'}
        handleClose={() => showModal(null)}
      />
      <ExportData
        show={modalToShow == 'exportData'}
        //dirHandle={dirHandle}
        handleClose={() => showModal(null)}
      />
    </div>
  );
};

export default ProjectManagement;
