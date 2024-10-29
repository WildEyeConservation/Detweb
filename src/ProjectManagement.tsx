import { useContext } from 'react';
import QueueManagement from './QueueManagement.tsx';
import UserManagement from './UserManagement.tsx';
import ImageSetManagement from './ImageSetManagement.tsx';
import DefineCategories from './DefineCategories.tsx';
import { GlobalContext,ProjectContext } from './Context.tsx';
import { Management } from './UserContext.tsx';
import DeleteImageSet from './DeleteImageSet.tsx';
import FilesUploadComponent from './FilesUploadComponent.tsx';
import ExportData from './ExportData.tsx';
import TaskManagement from './TaskManagement.tsx';
import AnnotationSetManagement from './AnnotationSetManagement.tsx';
import { DevActions } from './DevActions.tsx';

const ProjectManagement = () => {
  const { project } = useContext(ProjectContext)!;

  const {modalToShow, showModal} = useContext(GlobalContext)!;
  return (
      <div className="project-management">
        <Management>
        {/* We use this key to force a component reload when the project changes */}
        <ImageSetManagement key={"imsets"+  project.id} />
        <DefineCategories key={"cats"+project.id}/>
        <QueueManagement key={"queue"+project.id}/>
        <TaskManagement key={"tasks"+project.id}/>
        <AnnotationSetManagement key={"asets"+project.id}/>
        <UserManagement key={"users"+project.id}/>
        {/* <Rescan show={modalToShow=="rescan"} handleClose={()=>setModalToShow(null)}/> */}
        <DeleteImageSet
          show={modalToShow == "deleteImageSet"}
          handleClose={() => showModal(null)}
        />
        <FilesUploadComponent
          show={modalToShow == "addFiles"}
          handleClose={() => showModal(null)}
        />
        <ExportData
          show={modalToShow == "exportData"}
          //dirHandle={dirHandle}
          handleClose={() => showModal(null)}
        />
        {/* Devactions are only available in dev mode */}
        {process.env.NODE_ENV == "development" && <DevActions />}
          </Management>
    </div>
  );
};

export default ProjectManagement;
