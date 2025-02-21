import { useContext, useMemo, useEffect, useState } from 'react';
import { GlobalContext, UserContext } from '../Context';
import { useOptimisticUpdates } from '../useOptimisticUpdates';
import { Schema } from '../../amplify/data/resource';
import Button from 'react-bootstrap/Button';
import { useUsers } from '../apiInterface';
import { fetchAllPaginatedResults } from '../utils';
import { Bell, Check, X } from 'lucide-react';

export default function Notifications() {
  const [show, setShow] = useState(false);
  const [totalNotifications, setTotalNotifications] = useState(0);
  const { user } = useContext(UserContext)!;
  const { users } = useUsers();

  const username = users?.find((u) => u.id === user.username)?.name;

  return (
    <div>
      <button
        className="text-muted h-100"
        style={{
          position: 'relative',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
          width: '56px',
        }}
        onClick={() => setShow(!show)}
      >
        <div
          className="d-flex justify-content-center align-items-center"
          style={{ position: 'relative', height: '100%' }}
        >
          <div
            className="text-white bg-info"
            style={{
              position: 'absolute',
              top: 5,
              right: 5,
              borderRadius: '50%',
              minWidth: '16px',
              height: '16px',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: '14px',
            }}
          >
            {totalNotifications}
          </div>
          <Bell fill="currentColor" />
        </div>
      </button>
      {username && (
        <div
          style={{
            position: 'absolute',
            top: 56,
            right: 56,
            width: '400px',
            opacity: show ? 1 : 0,
            pointerEvents: show ? 'auto' : 'none',
            transition: 'opacity 0.15s ease-in-out',
            overflow: 'auto',
          }}
          className="bg-primary border border-secondary shadow-sm rounded-3"
        >
          <div className="d-flex justify-content-end pt-2 pe-2">
            <X onClick={() => setShow(false)} style={{ cursor: 'pointer' }} />
          </div>

          <Inbox
            username={username}
            setTotalNotifications={setTotalNotifications}
          />
        </div>
      )}
    </div>
  );
}

function Inbox({
  username,
  setTotalNotifications,
}: {
  username: string;
  setTotalNotifications: (totalNotifications: number) => void;
}) {
  const { client } = useContext(GlobalContext)!;
  const { user } = useContext(UserContext)!;
  const [organizations, setOrganizations] = useState<
    { id: string; name: string }[]
  >([]);

  const subscriptionFilter = useMemo(
    () => ({
      filter: { username: { eq: username } },
    }),
    [username]
  );

  const organizationInvitesHook = useOptimisticUpdates<
    Schema['OrganizationInvite']['type'],
    'OrganizationInvite'
  >(
    'OrganizationInvite',
    async (nextToken) =>
      client.models.OrganizationInvite.organizationInvitesByUsername({
        username: username,
        nextToken,
      }),
    subscriptionFilter
  );

  useEffect(() => {
    async function fetchOrganizations() {
      const organizations = await fetchAllPaginatedResults(
        client.models.Organization.list,
        { selectionSet: ['id', 'name'] }
      );

      setOrganizations(organizations);
    }
    fetchOrganizations();
  }, []);

  const organizationInvites = organizationInvitesHook.data?.filter(
    (invite) => invite.status === 'pending'
  );

  useEffect(() => {
    setTotalNotifications(organizationInvites?.length ?? 0);
  }, [organizationInvites]);

  return organizationInvites?.length === 0 ? (
    <h5 className="text-center mb-0 p-2">No notifications</h5>
  ) : (
    organizationInvites?.map((invite, i) => (
      <Invite
        key={invite.id}
        invite={invite}
        userId={user.username}
        organizations={organizations}
        index={i}
      />
    ))
  );
}

function Invite({
  invite,
  userId,
  organizations,
  index,
}: {
  invite: Schema['OrganizationInvite']['type'];
  userId: string;
  organizations: { id: string; name: string }[];
  index: number;
}) {
  const { client } = useContext(GlobalContext)!;

  async function acceptInvite(invite: Schema['OrganizationInvite']['type']) {
    if (invite.organizationId) {
      await client.models.OrganizationInvite.update({
        id: invite.id,
        status: 'accepted',
      });

      await client.models.OrganizationMembership.create({
        organizationId: invite.organizationId,
        userId: userId,
        isAdmin: false,
      });
    }
  }

  async function declineInvite(invite: Schema['OrganizationInvite']['type']) {
    if (invite.organizationId) {
      await client.models.OrganizationInvite.update({
        id: invite.id,
        status: 'declined',
      });
    }
  }

  return (
    <div
      className={`d-flex flex-row gap-2 text-primary-subtle text-start p-2 ${
        index % 2 !== 0 ? 'bg-secondary text-dark' : ''
      }`}
    >
      <div>
        <p className="mb-2" style={{ fontSize: '1.25rem' }}>
          Organization Invite
        </p>
        <p className="mb-0">
          <b>
            {organizations.find((o) => o.id === invite.organizationId)?.name}
          </b>{' '}
          invited you to their organization.
        </p>
      </div>
      <div className="d-flex gap-1">
        <Button variant="success" onClick={() => acceptInvite(invite)}>
          <Check />
        </Button>
        <Button variant="danger" onClick={() => declineInvite(invite)}>
          <X />
        </Button>
      </div>
    </div>
  );
}
