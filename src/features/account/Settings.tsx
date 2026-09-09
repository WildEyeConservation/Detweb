import { lazy, Suspense, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserIcon } from 'lucide-react';
import DialogNotice from '../../shared/routing/DialogNotice';
const SettingsDialog = lazy(() => import('./SettingsDialog'));

export default function Settings({ signOut }: { signOut: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const tab = params.get('settings');
  const isOpen = tab === 'account' || tab === 'organizations';
  const origin = useRef<typeof location | null>(null);
  useEffect(() => {
    if (!isOpen) origin.current = null;
  }, [isOpen]);

  const openTab = (nextTab: string) => {
    if (!isOpen) origin.current = location;
    const nextParams = new URLSearchParams(location.search);
    nextParams.set('settings', nextTab);
    navigate(
      { pathname: location.pathname, search: `?${nextParams}`, hash: location.hash },
      { state: location.state, replace: isOpen }
    );
  };
  const close = () => {
    // Opening pushes one entry; tab changes replace it, so Back restores the
    // exact original URL (including its query encoding), state, and hash.
    if (origin.current?.pathname === location.pathname) {
      navigate(-1);
      return;
    }
    // A directly loaded settings URL has no local opening entry to go back to.
    const nextParams = new URLSearchParams(location.search);
    nextParams.delete('settings');
    navigate(
      { pathname: location.pathname, search: nextParams.toString(), hash: location.hash },
      { state: location.state, replace: true }
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
        onClick={() => openTab('account')}
      >
        <UserIcon className='d-none d-lg-block' />
        <span className='d-block d-lg-none'>User</span>
      </button>
      {isOpen && (
        <Suspense
          fallback={
            <DialogNotice message='Loading settings...' onClose={close} />
          }
        >
          <SettingsDialog
            key={tab}
            signOut={signOut}
            onClose={close}
            tab={tab}
            onTabChange={(index) =>
              openTab(index === 1 ? 'organizations' : 'account')
            }
          />
        </Suspense>
      )}
    </>
  );
}
