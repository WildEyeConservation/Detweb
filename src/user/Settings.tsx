import { lazy, Suspense } from 'react';
import { useLocation, useMatch, useNavigate } from 'react-router-dom';
import { UserIcon } from 'lucide-react';
import DialogNotice from '../routing/DialogNotice';
const SettingsDialog = lazy(() => import('./SettingsDialog'));

export default function Settings({ signOut }: { signOut: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const match = useMatch('/settings/:tab?');
  const close = () => {
    const origin = (location.state as { settingsOrigin?: string } | null)
      ?.settingsOrigin;
    navigate(
      origin?.startsWith('/') &&
        !origin.startsWith('//') &&
        !origin.startsWith('/settings')
        ? origin
        : '/jobs'
    );
  };
  return (
    <>
      <button
        className='text-muted px-2 d-flex align-items-center justify-content-center'
        style={{
          backgroundColor: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        onClick={() =>
          navigate('/settings/account', {
            state: { settingsOrigin: location.pathname + location.search },
          })
        }
      >
        <UserIcon className='d-none d-lg-block' />
        <span className='d-block d-lg-none'>User</span>
      </button>
      {match && (
        <Suspense
          fallback={
            <DialogNotice message='Loading settings...' onClose={close} />
          }
        >
          <SettingsDialog
            key={match.params.tab ?? 'account'}
            signOut={signOut}
            onClose={close}
            tab={match.params.tab}
            onTabChange={(index) =>
              navigate(
                `/settings/${index === 1 ? 'organizations' : 'account'}`,
                {
                  state: location.state,
                }
              )
            }
          />
        </Suspense>
      )}
    </>
  );
}
