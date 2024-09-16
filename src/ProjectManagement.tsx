import { useContext } from 'react';
import QueueManagement from './QueueManagement.tsx';
import UserManagement from './UserManagement.tsx';
import ImageSetManagement from './ImageSetManagement.tsx';
import DefineCategories from './DefineCategories.tsx';
import { UserContext } from './Context.tsx';
import { Management } from './UserContext.tsx';


const ProjectManagement = () => {
  const { currentPM } = useContext(UserContext)!;
  return (
    currentPM?.projectId ?
      <div className="project-management">
        <Management>
      <QueueManagement />
          <UserManagement />
          <DefineCategories />
          <ImageSetManagement />
          </Management>
    </div>
    : null
  );
};

export default ProjectManagement;
