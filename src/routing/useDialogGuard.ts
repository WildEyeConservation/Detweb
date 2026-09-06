import { useCallback, useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';

// Only the mounted form owns a blocker. Successful saves can navigate before
// React has committed the corresponding busy/dirty state updates.
export function useDialogGuard({
  busy = false,
  dirty = false,
}: {
  busy?: boolean;
  dirty?: boolean;
}) {
  const completed = useRef(false);
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !completed.current &&
      (busy || dirty) &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search)
  );
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (busy) {
      window.alert('Please wait for the current operation to finish.');
      blocker.reset();
    } else if (
      window.confirm('Discard your unsaved changes and leave this dialog?')
    ) {
      blocker.proceed();
    } else {
      blocker.reset();
    }
  }, [blocker, busy]);
  useEffect(() => {
    if (!busy && !dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (completed.current) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy, dirty]);
  return useCallback((navigate: () => void) => {
    completed.current = true;
    navigate();
  }, []);
}
