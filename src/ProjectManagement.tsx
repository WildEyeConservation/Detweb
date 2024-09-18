import { useContext } from 'react';
import QueueManagement from './QueueManagement.tsx';
import UserManagement from './UserManagement.tsx';
import ImageSetManagement from './ImageSetManagement.tsx';
import DefineCategories from './DefineCategories.tsx';
import { GlobalContext } from './Context.tsx';
import { Management } from './UserContext.tsx';
import LaunchTask from './LaunchTask.tsx';
import ProcessImages from './ProcessImages.tsx';
import DeleteImageSet from './DeleteImageSet.tsx';
import FilesUploadComponent from './FilesUploadComponent.tsx';
import ExportData from './ExportData.tsx';



const ProjectManagement = () => {

  const {modalToShow, showModal} = useContext(GlobalContext)!;
  return (
      <div className="project-management">
        <Management>
        <ImageSetManagement />
        <DefineCategories />
        <QueueManagement />
          <UserManagement />
        <LaunchTask
          show={modalToShow == "launchTask"}
          handleClose={() => showModal(null)}
        />
        {/* <Rescan show={modalToShow=="rescan"} handleClose={()=>setModalToShow(null)}/> */}
        <ProcessImages
          show={modalToShow == "processImages"}
          handleClose={() => showModal(null)}
        />
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
          </Management>
    </div>
  );
};

export default ProjectManagement;
