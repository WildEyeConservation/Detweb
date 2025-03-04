import { Card } from 'react-bootstrap';
import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Users from './organization/Users';
import OrganizationSelector from './OrganizationSelector';
import { useState, useContext } from 'react';
import Info from './organization/Info';
import { UserContext, GlobalContext } from './Context';
import { useOptimisticUpdates } from './useOptimisticUpdates';
import type { Schema } from '../amplify/data/resource';

export default function Permissions() {
  const { isOrganizationAdmin } = useContext(UserContext)!;
  const { client } = useContext(GlobalContext)!;
  const [organization, setOrganization] = useState<{
    id: string;
    name: string;
  }>({ id: '', name: '' });

  if (!isOrganizationAdmin) {
    return <div>You are not authorized to access this page.</div>;
  }

  const membershipHook = useOptimisticUpdates<
    Schema['OrganizationMembership']['type'],
    'OrganizationMembership'
  >(
    'OrganizationMembership',
    async (nextToken) =>
      client.models.OrganizationMembership.membershipsByOrganizationId({
        organizationId: organization.id,
        nextToken,
      }),
    undefined, // subscriptionFilter (if needed) can go here
    {
      compositeKey: (membership) =>
        `${membership.organizationId}:${membership.userId}`,
    }
  );

  return (
    <div
      style={{
        width: '100%',
        maxWidth: '1280px',
        marginTop: '16px',
        marginBottom: '16px',
      }}
    >
      <Card>
        <Card.Body>
          <div className="d-flex justify-content-between mb-0">
            <Card.Title className="mb-0">
              <h4 className="mb-3">Permissions</h4>
            </Card.Title>
            <OrganizationSelector
              organization={organization}
              setOrganization={setOrganization}
            />
          </div>
          {organization.id && (
            <Tabs>
              <Tab eventKey="users" title="Users">
                <Users
                  key={organization.id}
                  organization={organization}
                  hook={membershipHook}
                />
              </Tab>
              <Tab eventKey="info" title="Organization Info">
                <Info organizationId={organization.id} />
              </Tab>
            </Tabs>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
