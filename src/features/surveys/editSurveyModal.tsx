import { lazy, Suspense } from 'react';
import { surveyEditorTabs } from './surveyEditorTabs';
import { Modal, Header, Title, Body } from '../../shared/components/Modal';
import { Schema } from '../../shared/api/client-schema';
import { Tabs, Tab } from '../../shared/components/Tabs';

const ProcessImages = lazy(() => import('./ProcessImages'));
const EditShapeFile = lazy(() => import('./EditShapeFile'));
const DefineTransects = lazy(() => import('./DefineTransects'));
const EditInformation = lazy(() => import('./EditInformation'));
const EditCameras = lazy(() => import('./EditCameras'));
const AdvancedOptions = lazy(() => import('./AdvancedOptions'));
const DeleteImages = lazy(() => import('./DeleteImages'));
const Logs = lazy(() => import('./Logs'));
const ManageTiles = lazy(() => import('./ManageTiles'));
const ManageUsers = lazy(() => import('./ManageUsers'));

export default function EditSurveyModal({
  show,
  onClose,
  project,
  openTab,
  onTabChange,
}: {
  show: boolean;
  onClose: () => void;
  project: Schema['Project']['type'];
  openTab?: number;
  onTabChange?: (index: number) => void;
}) {
  return (
    <Modal show={show} onHide={onClose} strict={true}>
      <Header>
        <Title>Edit Survey: {project.name}</Title>
      </Header>
      <Body>
        <Suspense fallback={<p className='p-3' role='status'>Loading editor...</p>}>
          <Tabs defaultTab={openTab ?? 0} activeTab={onTabChange ? openTab : undefined} onTabChange={onTabChange}>
            <Tab label={surveyEditorTabs[0].label}>
              <EditInformation onClose={onClose} key={project.id} projectId={project.id} />
            </Tab>
            <Tab label={surveyEditorTabs[1].label}>
              <EditCameras onClose={onClose} key={project.id} projectId={project.id} organizationId={project.organizationId} />
            </Tab>
            <Tab label={surveyEditorTabs[2].label}>
              <EditShapeFile onClose={onClose} key={project.id} projectId={project.id} organizationId={project.organizationId} />
            </Tab>
            <Tab label={surveyEditorTabs[3].label}>
              <DefineTransects onClose={onClose} key={project.id} projectId={project.id} organizationId={project.organizationId} />
            </Tab>
            <Tab label={surveyEditorTabs[4].label}>
              <ManageTiles onClose={onClose} key={project.id} project={project} />
            </Tab>
            <Tab label={surveyEditorTabs[5].label}>
              <ProcessImages onClose={onClose} key={project.id} projectId={project.id} organizationId={project.organizationId} />
            </Tab>
            <Tab label={surveyEditorTabs[6].label}>
              <ManageUsers onClose={onClose} key={project.id} projectId={project.id} organizationId={project.organizationId} />
            </Tab>
            <Tab label={surveyEditorTabs[7].label}>
              <DeleteImages onClose={onClose} key={project.id} projectId={project.id} />
            </Tab>
            <Tab label={surveyEditorTabs[8].label}>
              <AdvancedOptions onClose={onClose} key={project.id} projectId={project.id} />
            </Tab>
            <Tab label={surveyEditorTabs[9].label}>
              <Logs onClose={onClose} key={project.id} projectId={project.id} />
            </Tab>
          </Tabs>
        </Suspense>
      </Body>
    </Modal>
  );
}
