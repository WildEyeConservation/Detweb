import { Outlet } from 'react-router-dom';
import { useParams } from 'react-router-dom';
import { ProjectScope } from '../../shared/data/ProjectScopeProvider';

export default function ProjectView() {
  const { surveyId } = useParams();

  return (
    <ProjectScope projectId={surveyId}>
      <Outlet />
    </ProjectScope>
  );
}
