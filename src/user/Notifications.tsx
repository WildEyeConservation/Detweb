import { useState } from 'react';
import { Bell, Check, X, RefreshCw } from 'lucide-react';
import {
  OrgInvite,
  useOrgInvitations,
  useRespondToInvite,
} from './useOrgInvitations';

export default function Notifications() {
  const [show, setShow] = useState(false);
  const { pendingInvites, isFetching, refetch, queryKey, username } =
    useOrgInvitations();

  const totalNotifications = pendingInvites.length;
  const hasActivity = totalNotifications > 0;

  return (
    <div className='position-relative'>
      <button
        onClick={() => setShow((s) => !s)}
        title={hasActivity ? 'Pending notifications' : 'Notifications'}
        style={{
          position: 'relative',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 6,
          color: hasActivity ? '#fff' : 'rgba(255,255,255,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Bell size={18} />
        {totalNotifications > 0 && (
          <span
            className='bg-primary text-white'
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 8,
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {totalNotifications}
          </span>
        )}
      </button>

      {show && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1049,
          }}
          onClick={() => setShow(false)}
        />
      )}

      {show && username && (
        <NotificationsPopover
          invites={pendingInvites}
          totalNotifications={totalNotifications}
          isFetching={isFetching}
          onRefresh={() => refetch()}
          onClose={() => setShow(false)}
          queryKey={queryKey}
        />
      )}
    </div>
  );
}

function NotificationsPopover({
  invites,
  totalNotifications,
  isFetching,
  onRefresh,
  onClose,
  queryKey,
}: {
  invites: OrgInvite[];
  totalNotifications: number;
  isFetching: boolean;
  onRefresh: () => void;
  onClose: () => void;
  queryKey: readonly unknown[];
}) {
  return (
    <div className='ss-sidebar-popover'>
      <div
        style={{
          padding: '14px 16px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Bell size={16} color='rgba(255,255,255,0.85)' />
          <div
            style={{
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '-0.01em',
            }}
          >
            Notifications
          </div>
          {totalNotifications > 0 && (
            <div
              style={{
                background: 'rgba(77,143,110,0.25)',
                color: '#a6e0c2',
                border: '1px solid rgba(77,143,110,0.45)',
                fontSize: 11,
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: 999,
                lineHeight: 1.4,
              }}
            >
              {totalNotifications}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={onRefresh}
            disabled={isFetching}
            title='Refresh'
            style={{
              background: 'transparent',
              border: 'none',
              cursor: isFetching ? 'default' : 'pointer',
              color: 'rgba(255,255,255,0.55)',
              display: 'flex',
              alignItems: 'center',
              padding: 0,
              opacity: isFetching ? 0.5 : 1,
            }}
          >
            <RefreshCw size={14} className={isFetching ? 'spinning' : undefined} />
          </button>
          <X
            size={16}
            color='rgba(255,255,255,0.55)'
            style={{ cursor: 'pointer' }}
            onClick={onClose}
          />
        </div>
      </div>

      <div
        style={{
          padding: 14,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {invites.length === 0 ? (
          <div
            style={{
              padding: '28px 12px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.45)',
              fontSize: 13,
            }}
          >
            <Bell
              size={28}
              color='rgba(255,255,255,0.2)'
              style={{ marginBottom: 8 }}
            />
            <div>No notifications</div>
            <div style={{ fontSize: 11, marginTop: 4, color: 'rgba(255,255,255,0.3)' }}>
              Pending invites and other alerts will appear here.
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)',
                padding: '0 2px',
              }}
            >
              Pending
            </div>
            {invites.map((invite) => (
              <Invite
                key={invite.id}
                invite={invite}
                queryKey={queryKey}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function Invite({
  invite,
  queryKey,
}: {
  invite: OrgInvite;
  queryKey: readonly unknown[];
}) {
  const { accept, decline, responding } = useRespondToInvite(invite, queryKey);

  const organizationName =
    (invite as { organizationName?: string }).organizationName ??
    'Unknown organisation';

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)',
            marginBottom: 4,
          }}
        >
          Organisation invite
        </div>
        <div
          style={{
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={organizationName}
        >
          {organizationName}
        </div>
        <div
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: 12,
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          invited you to join their organisation.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <ActionButton
          onClick={decline}
          disabled={responding}
          variant='decline'
          icon={<X size={14} />}
          label='Decline'
        />
        <ActionButton
          onClick={accept}
          disabled={responding}
          variant='accept'
          icon={<Check size={14} />}
          label='Accept'
        />
      </div>
    </div>
  );
}

function ActionButton({
  onClick,
  disabled,
  variant,
  icon,
  label,
}: {
  onClick: () => void;
  disabled: boolean;
  variant: 'accept' | 'decline';
  icon: React.ReactNode;
  label: string;
}) {
  const isAccept = variant === 'accept';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '5px 11px',
        borderRadius: 7,
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.6 : 1,
        background: isAccept
          ? 'rgba(77,143,110,0.25)'
          : 'rgba(224,122,106,0.18)',
        border: `1px solid ${
          isAccept ? 'rgba(77,143,110,0.5)' : 'rgba(224,122,106,0.45)'
        }`,
        color: isAccept ? '#a6e0c2' : '#f1b3a8',
        transition: 'background 0.15s',
      }}
    >
      {icon}
      {label}
    </button>
  );
}
