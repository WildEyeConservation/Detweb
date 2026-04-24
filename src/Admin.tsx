import { useContext, useState } from 'react';
import { UserContext } from './Context';
import PendingOrganizations from './PendingOrganizations';
import ClientLogs from './ClientLogs';
import AdminStats from './AdminStats';
import AwsServiceHealth from './AwsServiceHealth';
import AdminSurveys from './AdminSurveys';
import { Page, PageHeader, TabBar, ContentArea } from './ss/PageShell';
// ContentArea is retained for the unauthorized fallback below.

const TABS = [
  { id: 'pending', label: 'New Organisations' },
  { id: 'logs', label: 'Client Logs' },
  { id: 'stats', label: 'Statistics' },
  { id: 'surveys', label: 'Surveys' },
  { id: 'aws', label: 'AWS Health' },
];

export default function Admin() {
  const { cognitoGroups } = useContext(UserContext)!;
  const [activeTab, setActiveTab] = useState<string>('pending');

  if (!cognitoGroups.includes('sysadmin')) {
    return (
      <Page>
        <PageHeader title='Admin' />
        <ContentArea>
          <div>You are not authorized to access this page.</div>
        </ContentArea>
      </Page>
    );
  }

  const renderTab = () => {
    switch (activeTab) {
      case 'pending':
        return <PendingOrganizations />;
      case 'logs':
        return <ClientLogs />;
      case 'stats':
        return <AdminStats />;
      case 'surveys':
        return <AdminSurveys />;
      case 'aws':
        return <AwsServiceHealth />;
      default:
        return null;
    }
  };

  return (
    <Page>
      <PageHeader title='Admin' />
      <TabBar tabs={TABS} active={activeTab} onChange={setActiveTab} />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {renderTab()}
      </div>
    </Page>
  );
}
