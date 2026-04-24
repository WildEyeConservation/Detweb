import { useContext, useState } from 'react';
import Surveys from './Surveys';
import Users from './Users';
import Results from './Results';
import { TestingContext, GlobalContext } from '../Context';
import { Schema } from '../amplify/client-schema';
import { useOptimisticUpdates } from '../useOptimisticUpdates';
import { useOrg } from '../OrgContext';
import { Page, PageHeader, TabBar, ContentArea } from '../ss/PageShell';

const TABS = [
  { id: 'surveys', label: 'Surveys' },
  { id: 'users', label: 'Users' },
  { id: 'results', label: 'Results' },
];

export default function Testing() {
  const { client } = useContext(GlobalContext)!;
  const { currentOrg, isCurrentOrgAdmin } = useOrg();
  const [activeTab, setActiveTab] = useState<string>('surveys');

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
        <PageHeader title='User Testing' />
        <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
        <ContentArea style={{ paddingTop: 16 }}>
          {activeTab === 'surveys' && <Surveys />}
          {activeTab === 'users' && <Users />}
          {activeTab === 'results' && <Results />}
        </ContentArea>
      </Page>
    </TestingContext.Provider>
  );
}
