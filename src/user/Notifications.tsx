import { useContext, useMemo, useEffect, useState } from 'react';
import { GlobalContext, UserContext } from '../Context';
import { useOptimisticUpdates } from '../useOptimisticUpdates';
import { Schema } from '../amplify/client-schema';
import Button from 'react-bootstrap/Button';
import { fetchAllPaginatedResults } from '../utils';
import { Bell, Check, X } from 'lucide-react';
import { Card } from 'react-bootstrap';

export default function Notifications() {
  const [show, setShow] = useState(false);
  const [totalNotifications, setTotalNotifications] = useState(0);
  const { user } = useContext(UserContext)!;
  const username = user.username;

  return (
    <div className='position-relative'>
      <button
        className='text-muted px-2 d-flex align-items-center justify-content-center'
        style={{
          position: 'relative',
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        onClick={() => setShow(!show)}
      >
        <div
          className='d-none d-lg-block'
          style={{ position: 'relative', height: '100%' }}
        >
          <div
            className='text-white bg-primary'
            style={{
              position: 'absolute',
              top: -5,
              right: -5,
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
          <Bell className='d-none d-lg-block' />
        </div>
        <span className='d-block d-lg-none'>Notifications</span>
      </button>
      {show && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            zIndex: 1,
          }}
          onClick={() => setShow(false)}
        />
      )}
      {username && (
        <Card
          className='position-fixed w-100 mt-lg-3'
          style={{
            maxWidth: '400px',
            right: 0,
            opacity: show ? 1 : 0,
            pointerEvents: show ? 'auto' : 'none',
            transition: 'opacity 0.15s ease-in-out',
            overflow: 'auto',
            zIndex: 2,
          }}
        >
          <Card.Header className='d-flex justify-content-between align-items-center'>
            <Card.Title className='mb-0'>Notifications</Card.Title>
            <X onClick={() => setShow(false)} style={{ cursor: 'pointer' }} />
          </Card.Header>
          <Card.Body>
            <Inbox
              username={username}
              setTotalNotifications={setTotalNotifications}
            />
          </Card.Body>
        </Card>
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
    async (nextToken) => {
      const result =
        await client.models.OrganizationInvite.organizationInvitesByUsername({
          username,
        });
      return { data: result.data, nextToken: result.nextToken ?? undefined };
    },
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
    <h5 className='text-center mb-0 p-2'>Empty</h5>
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
        group: invite.organizationId,
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
        <p className='mb-2' style={{ fontSize: '1.25rem' }}>
          Organization Invite
        </p>
        <p className='mb-0'>
          <b>
            {organizations.find((o) => o.id === invite.organizationId)?.name}
          </b>{' '}
          invited you to their organisation.
        </p>
      </div>
      <div className='d-flex gap-1'>
        <Button variant='success' onClick={() => acceptInvite(invite)}>
          <Check />
        </Button>
        <Button variant='danger' onClick={() => declineInvite(invite)}>
          <X />
        </Button>
      </div>
    </div>
  );
}
