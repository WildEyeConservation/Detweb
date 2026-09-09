import MyTable from '../../shared/components/Table';
import { useTestingMemberships } from '../../shared/data/testing';
import { useUsers } from '../../shared/api/apiInterface';
import LabeledToggleSwitch from '../../shared/components/LabeledToggleSwitch';

export default function Users({ organizationId }: { organizationId: string }) {
  const hook = useTestingMemberships(organizationId);
  const { users } = useUsers();

  const tableData = hook.data.map((membership) => {
    const user = users.find((user) => user.id === membership.userId);
    return {
      id: membership.userId,
      rowData: [
        user?.name,
        <LabeledToggleSwitch
          className='mb-0'
          leftLabel='No'
          rightLabel='Yes'
          checked={membership.isTested ?? false}
          onChange={async (checked) => {
            hook.update({
              userId: membership.userId,
              organizationId,
              isTested: checked,
            });
          }}
        />,
      ],
    };
  });

  return (
    <div className='d-flex flex-column gap-2 mt-3 w-100'>
      <h5 className='mb-0'>Organisation Users</h5>
      <MyTable
        tableHeadings={[
          { content: 'Name', style: { width: '50%' }, sort: true },
          { content: 'Test User' },
        ]}
        tableData={tableData}
        pagination={true}
        itemsPerPage={5}
        emptyMessage='Loading users...'
      />
    </div>
  );
}
