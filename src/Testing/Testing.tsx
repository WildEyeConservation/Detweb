import { Card } from 'react-bootstrap';
import OrganizationSelector from '../OrganizationSelector';
import { useState } from 'react';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';
import LocationPools from './LocationPools';

export default function Testing() {
  const [organization, setOrganization] = useState<{
    id: string;
    name: string;
  }>({ id: '', name: '' });

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
              <h4 className="mb-3">User Testing</h4>
            </Card.Title>
            <OrganizationSelector
              organization={organization}
              setOrganization={setOrganization}
            />
          </div>
          {organization.id && (
            <Tabs>
              <Tab eventKey="pools" title="Pools">
                <LocationPools organizationId={organization.id} />
              </Tab>
              <Tab eventKey="surveys" title="Surveys">
                {/* <Surveys /> */}
              </Tab>
              <Tab eventKey="users" title="Users">
                {/* <Users /> */}
              </Tab>
              <Tab eventKey="results" title="Results">
                {/* <Results /> */}
              </Tab>
            </Tabs>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
