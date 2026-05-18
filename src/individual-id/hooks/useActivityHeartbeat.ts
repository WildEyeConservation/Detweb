import { useContext, useEffect, useRef } from 'react';
import { GlobalContext } from '../../Context';

// Heartbeat at most this often, regardless of how busy the user is.
const PING_MIN_INTERVAL_MS = 60_000;
// Client-side idle ceiling. Matches the server-side release window so the
// user is sent back before/just as the release cron frees their transect.
const IDLE_LIMIT_MS = 30 * 60_000;
const IDLE_CHECK_MS = 60_000;

/**
 * While the Individual ID harness is mounted, stamp the assigned transect's
 * lastActiveAt on user activity (throttled), and bounce the user back to /jobs
 * if they go idle for 30 minutes OR the transect is no longer theirs (the
 * conditional ping write fails because the release cron already freed it).
 */
export function useActivityHeartbeat(params: {
  transectRowId: string | null | undefined;
  onLost: () => void;
}) {
  const { transectRowId, onLost } = params;
  const { client } = useContext(GlobalContext)!;
  const lastActivityRef = useRef<number>(Date.now());
  const lastPingRef = useRef<number>(0);
  const onLostRef = useRef(onLost);
  useEffect(() => {
    onLostRef.current = onLost;
  }, [onLost]);

  useEffect(() => {
    if (!transectRowId) return;
    let cancelled = false;

    const ping = async () => {
      try {
        const res: any = await (
          client as any
        ).mutations.pingIndividualIdTransect(
          { id: transectRowId },
          { retry: false }
        );
        if (res?.errors && res.errors.length > 0 && !cancelled) {
          onLostRef.current();
        }
      } catch {
        // Conditional write failed => transect no longer assigned to us
        // (released by the cron). Send the user back to pick up new work.
        if (!cancelled) onLostRef.current();
      }
    };

    const onActivity = () => {
      const now = Date.now();
      lastActivityRef.current = now;
      if (now - lastPingRef.current >= PING_MIN_INTERVAL_MS) {
        lastPingRef.current = now;
        void ping();
      }
    };

    // Fresh heartbeat on entry so the release window restarts from "now".
    lastActivityRef.current = Date.now();
    lastPingRef.current = Date.now();
    void ping();

    window.addEventListener('pointerdown', onActivity, true);
    window.addEventListener('keydown', onActivity, true);

    const idleTimer = setInterval(() => {
      if (Date.now() - lastActivityRef.current > IDLE_LIMIT_MS && !cancelled) {
        onLostRef.current();
      }
    }, IDLE_CHECK_MS);

    return () => {
      cancelled = true;
      window.removeEventListener('pointerdown', onActivity, true);
      window.removeEventListener('keydown', onActivity, true);
      clearInterval(idleTimer);
    };
  }, [client, transectRowId]);
}
