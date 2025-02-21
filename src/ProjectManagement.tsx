import { useContext, useRef } from 'react';
import { Nav, Container, Row, Col, Button } from 'react-bootstrap';
import QueueManagement from './QueueManagement.tsx';
import UserManagement from './UserManagement.tsx';
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

  // Add refs for each section
  const imageSetsRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);
  const tasksRef = useRef<HTMLDivElement>(null);
  const annotationSetsRef = useRef<HTMLDivElement>(null);
  const usersRef = useRef<HTMLDivElement>(null);
  const queuesRef = useRef<HTMLDivElement>(null);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <Container fluid>
      <Row className="p-2 border-bottom border-secondary">
        <Col className="d-flex justify-content-between align-items-center p-0">
          <h1 className="mb-0">{project.name}</h1>
          <Button
            variant="outline-primary"
            onClick={() => navigate(`/surveys`)}
          >
            Back to Surveys
          </Button>
        </Col>
      </Row>
      <Row>
        <Col
          md={2}
          className="position-sticky"
          style={{ top: 0, height: '100vh' }}
        >
          <Nav className="flex-column mt-2">
            <Nav.Link onClick={() => scrollToSection(imageSetsRef)}>
              Image Sets
            </Nav.Link>
            <Nav.Link onClick={() => scrollToSection(categoriesRef)}>
              Categories
            </Nav.Link>
            <Nav.Link onClick={() => scrollToSection(tasksRef)}>Tasks</Nav.Link>
            <Nav.Link onClick={() => scrollToSection(annotationSetsRef)}>
              Annotation Sets
            </Nav.Link>
            <Nav.Link onClick={() => scrollToSection(queuesRef)}>
              Queues
            </Nav.Link>
            <Nav.Link onClick={() => scrollToSection(usersRef)}>Users</Nav.Link>
          </Nav>
        </Col>

        <Col md={10} className="border-start border-secondary ps-4">
          <div ref={imageSetsRef}>
            <ImageSetManagement key={'imsets' + project.id} />
          </div>
          <div ref={categoriesRef}>
            <DefineCategories key={'cats' + project.id} />
          </div>
          <div ref={tasksRef}>
            <TaskManagement key={'tasks' + project.id} />
          </div>
          <div ref={annotationSetsRef}>
            <AnnotationSetManagement key={'asets' + project.id} />
          </div>
          <div ref={queuesRef}>
            <QueueManagement key={'queues' + project.id} />
          </div>
          <div ref={usersRef}>
            <UserManagement key={'users' + project.id} />
          </div>

          {/* <Rescan show={modalToShow=="rescan"} handleClose={()=>setModalToShow(null)}/> */}
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
          {/* Devactions are only available in dev mode */}
          {process.env.NODE_ENV == 'development' && <DevActions />}
        </Col>
      </Row>
    </Container>
  );
};

export default ProjectManagement;
