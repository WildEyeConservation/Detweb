import MyTable from './Table';
import { lazy, Suspense } from 'react';
import { client } from './stores/appClient';
import { useDialogRoute } from './routing/useDialogRoute';
import DialogNotice from './routing/DialogNotice';
import { useOptimisticUpdates } from './useOptimisticUpdates';
import type { Schema } from './amplify/client-schema';
import { useUsers } from './apiInterface';
import { Button } from 'react-bootstrap';
const CreateOrganization = lazy(() => import('./organization/CreateOrganization'));

export default function PendingOrganizations() {
  const dialog = useDialogRoute();
  const { users } = useUsers();

  const { data: requests } = useOptimisticUpdates<
    Schema['OrganizationRegistration']['type'],
    'OrganizationRegistration'
  >('OrganizationRegistration', async (nextToken) =>
    client.models.OrganizationRegistration.list({
      nextToken,
    })
  );

  const requestId = dialog.get('request');
  const request = requests.find((row) => row.id === requestId);
  const selectedRequest = request ? { ...request, requestedByEmail: users.find((user) => user.id === request.requestedBy)?.email ?? '' } : undefined;

  const tableData = requests
    .filter((request) => request.status === 'pending')
    .map((request) => {
      const requestedBy = users.find((user) => user.id === request.requestedBy);

      return {
        id: request.id,
        rowData: [
          <div>{request.organizationName.slice(0, 50)}</div>,
          <div>{request.briefDescription.slice(0, 50)}</div>,
          <div>
            {requestedBy?.name} ({requestedBy?.email})
          </div>,
          <div>{new Date(request.createdAt ?? '').toLocaleDateString()}</div>,
          <Button
            variant='primary'
            onClick={() => {
              dialog.open('createOrganization', { request: request.id });
            }}
          >
            Review
          </Button>,
        ],
      };
    });

  const tableHeadings = [
    { content: 'Organisation Name', style: { width: '20%' }, sort: true },
    { content: 'Brief Description', style: { width: '20%' }, sort: true },
    { content: 'Requested By', style: { width: '20%' }, sort: true },
    { content: 'Date', style: { width: '20%' }, sort: true },
    { content: 'Review Request', style: { width: '20%' } },
  ];

  return (
    <div className='m-2'>
      <h5>Pending Organisations</h5>
      <MyTable
        tableData={tableData}
        tableHeadings={tableHeadings}
        pagination={true}
        itemsPerPage={10}
        emptyMessage='No pending organisations'
      />
      <div className='d-flex justify-content-center align-items-center border-top pt-3 border-dark mt-3'>
        <Button
          variant='primary'
          onClick={() => dialog.open('createOrganization')}
        >
          Create Organisation
        </Button>
      </div>
      <Suspense fallback={<DialogNotice message='Loading dialog...' onClose={dialog.close} />}>
        {dialog.name === 'createOrganization' && (requestId && !selectedRequest
          ? <DialogNotice message='Loading the registration, or it is no longer available.' onClose={dialog.close} />
          : <CreateOrganization key={requestId ?? 'new'} show onHide={dialog.close} request={selectedRequest} />)}
      </Suspense>
    </div>
  );
}
