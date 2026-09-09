import { ProjectIdContext } from './projectScope';
import { useEffect } from 'react';
import { useCurrentMembership } from './memberships';
import { useProject } from './project';
import { resetAnnotatorUi } from '../../features/annotation/annotatorUiStore';

export function ProjectScope({
  projectId,
  children,
}: {
  projectId: string | undefined;
  children: React.ReactNode;
}) {
  const { data: currentPM } = useCurrentMembership(projectId);
  const { data: project } = useProject(projectId);

  useEffect(() => {
    if (projectId) resetAnnotatorUi(projectId);
  }, [projectId]);

  if (!projectId || !currentPM || !project) return null;

  return (
    <ProjectIdContext.Provider value={projectId}>
      {children}
    </ProjectIdContext.Provider>
  );
}
