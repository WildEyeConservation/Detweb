import { Card } from 'react-bootstrap';
import OrganizationSelector from '../OrganizationSelector';
import { useState, useContext } from 'react';
import { Tab, Tabs } from '../Tabs';
import LocationPools from './LocationPools';
import Surveys from './Surveys';
import { TestingContext, GlobalContext } from '../Context';
import { Schema } from '../../amplify/data/resource';
import { useOptimisticUpdates } from '../useOptimisticUpdates';
import Users from './Users';
import Results from './Results';

export default function Testing() {
  const { client } = useContext(GlobalContext)!;

  const [organization, setOrganization] = useState<{
    id: string;
    name: string;
  }>({ id: '', name: '' });

  const { data: projects } = useOptimisticUpdates<
    Schema['Project']['type'],
    'Project'
  >(
    'Project',
    async (nextToken) =>
      client.models.Project.list({
        nextToken,
        filter: { organizationId: { eq: organization.id } },
      }),
    {
      filter: { organizationId: { eq: organization.id } },
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
        filter: { organizationId: { eq: organization.id } },
      }),
    {
      filter: { organizationId: { eq: organization.id } },
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
        filter: { organizationId: { eq: organization.id } },
      }),
    {
      filter: { organizationId: { eq: organization.id } },
    },
    {
      compositeKey: (membership) =>
        `${membership.organizationId}:${membership.userId}`,
    }
  );
  return (
    <TestingContext.Provider
      value={{
        organizationId: organization.id,
        organizationProjects: projects,
        organizationTestPresets: testPresets,
        organizationMembershipsHook: membershipsHook,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1555px',
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
              <Tabs defaultTab={0}>
                <Tab label="Pools">
                  <LocationPools />
                </Tab>
                <Tab label="Surveys">
                  <Surveys />
                </Tab>
                <Tab label="Users">
                  <Users />
                </Tab>
                <Tab label="Results">
                  <Results />
                </Tab>
              </Tabs>
            )}
          </Card.Body>
        </Card>
      </div>
    </TestingContext.Provider>
  );
}
