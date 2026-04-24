import { useContext, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Spinner } from 'react-bootstrap';
import { TestingContext, GlobalContext } from '../Context';
import { Schema } from '../amplify/client-schema';
import { useOptimisticUpdates } from '../useOptimisticUpdates';
import { useOrg } from '../OrgContext';
import {
  Page,
  PageHeader,
  TabBar,
  ContentArea,
  Crumb,
  CrumbSep,
} from '../ss/PageShell';
import SurveySettingsPanel from './SurveySettingsPanel';
import AddLocationsPanel from './AddLocationsPanel';
import EditLocationsPanel from './EditLocationsPanel';

const TABS = [
  { id: 'settings', label: 'Settings & Sharing' },
  { id: 'add', label: 'Add Locations' },
  { id: 'edit', label: 'Edit Locations' },
];

export default function SurveyDetailPage() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const navigate = useNavigate();
  const { client } = useContext(GlobalContext)!;
  const { currentOrg, isCurrentOrgAdmin } = useOrg();
  const [activeTab, setActiveTab] = useState<string>('settings');

  const organizationId = currentOrg?.id ?? '';

  const { data: projects } = useOptimisticUpdates<
    Schema['Project']['type'],
    'Project'
  >(
    'Project',
    async (nextToken) =>
      client.models.Project.list({
        nextToken,
        filter: { organizationId: { eq: organizationId } },
      }),
    {
      filter: { organizationId: { eq: organizationId } },
    }
  );

  const { data: testPresets } = useOptimisticUpdates<
    Schema['TestPreset']['type'],
    'TestPreset'
  >(
    'TestPreset',
    async (nextToken) =>
      client.models.TestPreset.list({
        nextToken,
        filter: { organizationId: { eq: organizationId } },
      }),
    {
      filter: { organizationId: { eq: organizationId } },
    }
  );

  const membershipsHook = useOptimisticUpdates<
    Schema['OrganizationMembership']['type'],
    'OrganizationMembership'
  >(
    'OrganizationMembership',
    async (nextToken) =>
      client.models.OrganizationMembership.list({
        nextToken,
        filter: { organizationId: { eq: organizationId } },
      }),
    {
      filter: { organizationId: { eq: organizationId } },
    },
    {
      compositeKey: (membership) =>
        `${membership.organizationId}:${membership.userId}`,
    }
  );

  const survey = useMemo(
    () => projects.find((p) => p.id === surveyId),
    [projects, surveyId]
  );

  // Convention: a survey's own pool has the same name as the survey
  const pool = useMemo(() => {
    if (!survey) return undefined;
    return testPresets.find((p) => p.name === survey.name);
  }, [survey, testPresets]);

  if (!isCurrentOrgAdmin || !currentOrg) {
    return (
      <Page>
        <PageHeader title='User Testing' />
        <ContentArea>
          <div>You are not authorized to access this page.</div>
        </ContentArea>
      </Page>
    );
  }

  const stillLoading =
    projects.length === 0 || testPresets.length === 0;

  const breadcrumb = (
    <>
      <Crumb onClick={() => navigate('/testing')}>User Testing</Crumb>
      <CrumbSep />
      <span>{survey?.name ?? 'Survey'}</span>
    </>
  );

  if (stillLoading) {
    return (
      <Page>
        <PageHeader title='Loading…' breadcrumb={breadcrumb} />
        <ContentArea>
          <div className='d-flex align-items-center gap-2'>
            <Spinner animation='border' size='sm' /> Loading survey…
          </div>
        </ContentArea>
      </Page>
    );
  }

  if (!survey) {
    return (
      <Page>
        <PageHeader title='Survey not found' breadcrumb={breadcrumb} />
        <ContentArea>
          <div>Survey not found in this organisation.</div>
        </ContentArea>
      </Page>
    );
  }

  if (!pool) {
    return (
      <Page>
        <PageHeader title={survey.name} breadcrumb={breadcrumb} />
        <ContentArea>
          <div>
            No test pool exists for this survey. A pool named "{survey.name}"
            should have been created when the survey was created.
          </div>
        </ContentArea>
      </Page>
    );
  }

  return (
    <TestingContext.Provider
      value={{
        organizationId,
        organizationProjects: projects,
        organizationTestPresets: testPresets,
        organizationMembershipsHook: membershipsHook,
      }}
    >
      <Page>
        <PageHeader title={survey.name} breadcrumb={breadcrumb} />
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
        <ContentArea style={{ paddingTop: 16 }}>
          {activeTab === 'settings' && (
            <SurveySettingsPanel
              survey={{ id: survey.id, name: survey.name }}
              preset={{ id: pool.id, name: pool.name }}
            />
          )}
          {activeTab === 'add' && (
            <AddLocationsPanel
              preset={{ id: pool.id, name: pool.name }}
              surveyId={survey.id}
            />
          )}
          {activeTab === 'edit' && (
            <EditLocationsPanel
              preset={{ id: pool.id, name: pool.name }}
              surveyId={survey.id}
            />
          )}
        </ContentArea>
      </Page>
    </TestingContext.Provider>
  );
}
