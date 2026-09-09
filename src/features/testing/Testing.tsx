import { useOrganizationRoute } from '../../shared/routing/useOrganizationRoute';
import { Card } from 'react-bootstrap';
import OrganizationSelector from '../organizations/OrganizationSelector';
import { Tab, Tabs } from '../../shared/components/Tabs';
import { lazy, Suspense } from 'react';
import { useSearchParams } from 'react-router-dom';
import { dialogSearch } from '../../shared/routing/dialogSearch';
const Surveys = lazy(() => import('./Surveys'));
const Users = lazy(() => import('./Users'));
const Results = lazy(() => import('./Results'));

export default function Testing() {
  const [params, setParams] = useSearchParams();
  const tabNames = ['surveys', 'users', 'results'];
  const activeTab = Math.max(
    0,
    tabNames.indexOf(params.get('tab') ?? 'surveys')
  );
  const { organization, setOrganization, allowAutoSelect, notice } =
    useOrganizationRoute();

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1555px',
        marginTop: '16px',
        marginBottom: '16px',
      }}
    >
      <Card>
        <Card.Header className='d-flex justify-content-between mb-0'>
          <Card.Title className='mb-0'>
            <h4 className='mb-0'>User Testing</h4>
          </Card.Title>
          <OrganizationSelector
            organization={organization}
            setOrganization={setOrganization}
            allowAutoSelect={allowAutoSelect}
          />
        </Card.Header>
        <Card.Body>
          {notice && <div role='alert'>{notice}</div>}
          {organization.id && (
            <Suspense fallback={<div>Loading testing...</div>}>
              <Tabs
                key={organization.id}
                activeTab={activeTab}
                onTabChange={(tab) =>
                  setParams((previous) => {
                    const next = dialogSearch(previous, null);
                    next.set('tab', tabNames[tab]);
                    return next;
                  })
                }
              >
                <Tab label='Surveys'>
                  <Surveys organizationId={organization.id} />
                </Tab>
                <Tab label='Users'>
                  <Users organizationId={organization.id} />
                </Tab>
                <Tab label='Results'>
                  <Results organizationId={organization.id} />
                </Tab>
              </Tabs>
            </Suspense>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
