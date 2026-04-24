import { useContext, useState } from 'react';
import { GlobalContext } from './Context';
import { useOptimisticUpdates } from './useOptimisticUpdates';
import type { Schema } from './amplify/client-schema';
import { useUsers } from './apiInterface';
import { Button } from 'react-bootstrap';
import CreateOrganization from './organization/CreateOrganization';
import { Page, PageHeader, ContentArea } from './ss/PageShell';

export default function PendingOrganizations() {
  const { client, showModal, modalToShow } = useContext(GlobalContext);
  const { users } = useUsers();

  const [selectedRequest, setSelectedRequest] = useState<
    (Schema['OrganizationRegistration']['type'] & { requestedByEmail: string }) | null
  >(null);

  const { data: requests } = useOptimisticUpdates<
    Schema['OrganizationRegistration']['type'],
    'OrganizationRegistration'
  >('OrganizationRegistration', async (nextToken) =>
    client.models.OrganizationRegistration.list({
      nextToken,
    })
  );

  const pendingRequests = requests.filter((r) => r.status === 'pending');

  return (
    <>
      <Page>
        <PageHeader
          title='New Organisations'
          actions={
            <Button
              variant='primary'
              onClick={() => showModal('createOrganization')}
            >
              + Create Organisation
            </Button>
          }
        />
        <ContentArea style={{ paddingTop: 12 }}>
          <div className='ss-card' style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className='ss-data-table'>
                <thead>
                  <tr>
                    <th style={{ width: '22%' }}>Organisation Name</th>
                    <th style={{ width: '30%' }}>Brief Description</th>
                    <th style={{ width: '25%' }}>Requested By</th>
                    <th style={{ width: '13%' }}>Date</th>
                    <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRequests.map((request) => {
                    const requestedBy = users.find(
                      (u) => u.id === request.requestedBy
                    );
                    return (
                      <tr key={request.id}>
                        <td>{request.organizationName.slice(0, 80)}</td>
                        <td style={{ color: 'var(--ss-text-dim)' }}>
                          {request.briefDescription.slice(0, 120)}
                        </td>
                        <td>
                          <div>{requestedBy?.name ?? '—'}</div>
                          <div
                            style={{
                              fontSize: 12,
                              color: 'var(--ss-text-dim)',
                            }}
                          >
                            {requestedBy?.email ?? ''}
                          </div>
                        </td>
                        <td>
                          {new Date(request.createdAt ?? '').toLocaleDateString()}
                        </td>
                        <td>
                          <div className='ss-row-actions'>
                            <Button
                              size='sm'
                              variant='primary'
                              style={{ width: 90 }}
                              onClick={() => {
                                setSelectedRequest({
                                  ...request,
                                  requestedByEmail: requestedBy?.email || '',
                                });
                                showModal('createOrganization');
                              }}
                            >
                              Review
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {pendingRequests.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        style={{
                          textAlign: 'center',
                          color: 'var(--ss-text-dim)',
                          padding: '24px',
                        }}
                      >
                        No pending organisations
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </ContentArea>
      </Page>
      <CreateOrganization
        show={modalToShow === 'createOrganization'}
        onHide={() => {
          showModal(null);
          setSelectedRequest(null);
        }}
        request={selectedRequest ?? undefined}
      />
    </>
  );
}
