import { Button } from 'react-bootstrap';
import Users from './organization/Users';
import { useState } from 'react';
import Info from './organization/Info';
import { useOrg } from './OrgContext';
import { Page, PageHeader, TabBar, ContentArea } from './ss/PageShell';

const TABS = [
  { id: 'users', label: 'Users' },
  { id: 'info', label: 'Organisation Info' },
];

export default function Permissions() {
  const { currentOrg, isCurrentOrgAdmin } = useOrg();
  const [activeTab, setActiveTab] = useState<string>('users');
  const [onClick, setOnClick] = useState<{
    name: string;
    function: () => void;
  } | null>(null);

  if (!isCurrentOrgAdmin || !currentOrg) {
    return (
      <Page>
        <PageHeader title='Permissions' />
        <ContentArea>
          <div>You are not authorized to access this page.</div>
        </ContentArea>
      </Page>
    );
  }

  const organization = { id: currentOrg.id, name: currentOrg.name };

  const handleTabChange = (id: string) => {
    setActiveTab(id);
    setOnClick(null);
  };

  return (
    <Page>
      <PageHeader
        title='Permissions'
        actions={
          <>
            {onClick && (
              <Button variant='primary' onClick={onClick.function}>
                {onClick.name}
              </Button>
            )}
          </>
        }
      />
      <TabBar tabs={TABS} active={activeTab} onChange={handleTabChange} />
      <ContentArea style={{ paddingTop: 16 }}>
        {activeTab === 'users' && (
          <Users
            key={organization.id}
            organization={organization}
            setOnClick={setOnClick}
          />
        )}
        {activeTab === 'info' && <Info organizationId={organization.id} />}
      </ContentArea>
    </Page>
  );
}
