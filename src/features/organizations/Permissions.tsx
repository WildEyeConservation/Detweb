import { useSearchParams } from 'react-router-dom';
import { dialogSearch } from '../../shared/routing/dialogSearch';
import { useOrganizationRoute } from '../../shared/routing/useOrganizationRoute';
import { Card, Button } from 'react-bootstrap';
import { Tabs, Tab } from '../../shared/components/Tabs';
import Users from './Users';
import OrganizationSelector from './OrganizationSelector';
import { useState } from 'react';
import Info from './Info';
import { useIsOrganizationAdmin } from '../../shared/data/memberships';

export default function Permissions() {
  const isOrganizationAdmin = useIsOrganizationAdmin();
  const { organization, setOrganization, allowAutoSelect, notice } =
    useOrganizationRoute();
  const [onClick, setOnClick] = useState<{
    name: string;
    function: () => void;
  } | null>(null);

  if (!isOrganizationAdmin) {
    return <div>You are not authorized to access this page.</div>;
  }

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
            <h4 className='mb-0'>Permissions</h4>
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
            <PermissionsBody
              key={organization.id}
              organization={organization}
              setOnClick={setOnClick}
            />
          )}
        </Card.Body>
        {onClick && (
          <Card.Footer className='d-flex justify-content-center'>
            <Button variant='primary' onClick={onClick.function}>
              {onClick.name}
            </Button>
          </Card.Footer>
        )}
      </Card>
    </div>
  );
}

function PermissionsBody({
  organization,
  setOnClick,
}: {
  organization: { id: string; name: string };
  setOnClick: (onClick: { name: string; function: () => void } | null) => void;
}) {
  const [params, setParams] = useSearchParams();
  return (
    <Tabs
      activeTab={params.get('tab') === 'info' ? 1 : 0}
      onTabChange={(tab) =>
        setParams((previous) => {
          const next = dialogSearch(previous, null);
          next.set('tab', tab === 1 ? 'info' : 'users');
          return next;
        })
      }
    >
      <Tab label='Users'>
        <Users
          key={organization.id}
          organization={organization}
          setOnClick={setOnClick}
        />
      </Tab>
      <Tab label='Organisation Info'>
        <Info organizationId={organization.id} />
      </Tab>
    </Tabs>
  );
}
