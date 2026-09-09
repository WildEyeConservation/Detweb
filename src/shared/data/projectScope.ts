import { createContext, useContext } from 'react';
import { useCurrentMembership } from './memberships';
import { useProject } from './project';

export const ProjectIdContext = createContext<string | undefined>(undefined);

export function useProjectId(): string {
  const projectId = useContext(ProjectIdContext);
  if (!projectId) {
    throw new Error('useProjectId must be used inside ProjectScope');
  }
  return projectId;
}

export function useCurrentProject() {
  const { data: project } = useProject(useProjectId());
  if (!project) {
    throw new Error('ProjectScope rendered without a loaded project');
  }
  return project;
}

export function useCurrentMembershipRow() {
  const { data: currentPM } = useCurrentMembership(useProjectId());
  if (!currentPM) {
    throw new Error('ProjectScope rendered without a loaded membership');
  }
  return currentPM;
}
