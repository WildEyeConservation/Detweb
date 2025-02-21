import { Card } from 'react-bootstrap';
import Tabs from 'react-bootstrap/Tabs';
import Tab from 'react-bootstrap/Tab';
import Users from './organization/Users';
import OrganizationSelector from './OrganizationSelector';
import { useState, useContext } from 'react';
import Info from './organization/Info';
import { UserContext } from './Context';

export default function Permissions() {
  const { isOrganizationAdmin } = useContext(UserContext)!;
  const [organization, setOrganization] = useState<{
    id: string;
    name: string;
  }>({ id: '', name: '' });

  if (!isOrganizationAdmin) {
    return <div>You are not authorized to access this page.</div>;
  }

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
          <div className="d-flex justify-content-between align-items-center mb-2">
            <Card.Title className="mb-0">
              <h4 className="mb-0">Permissions</h4>
            </Card.Title>
            <OrganizationSelector
              organization={organization}
              setOrganization={setOrganization}
            />
          </div>
          {organization.id ? (
            <Tabs>
              <Tab eventKey="users" title="Users">
                <Users key={organization.id} organization={organization} />
              </Tab>
              <Tab eventKey="info" title="Organization Info">
                <Info organizationId={organization.id} />
              </Tab>
            </Tabs>
          ) : (
            <div className="d-flex justify-content-center align-items-center">
              <p className="mb-2 border-top w-100 border-top border-secondary pt-3">
                Please select an organization to manage permissions.
              </p>
            </div>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
