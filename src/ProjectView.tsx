import { Project, Management } from './UserContext';
import { Outlet, useOutletContext } from 'react-router-dom';
import { Schema } from '../amplify/data/resource';

export default function ProjectView() {
  const { currentPM } = useOutletContext<{
    currentPM: Schema['UserProjectMembership']['type'];
  }>();

  return currentPM ? (
    <Project currentPM={currentPM}>
      <Management>
        <Outlet />
      </Management>
    </Project>
  ) : null;
}
