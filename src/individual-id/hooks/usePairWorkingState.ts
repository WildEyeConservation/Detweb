import { useCallback, useMemo, useRef, useState } from 'react';
import type { MatchCandidate } from '../types';

/**
 * pairKey for the harness-wide cache: `${imageAId}__${imageBId}`.
 * Per-candidate keys are the candidate's own `pairKey`.
 *
 * The cache persists across pair switches so that a user who started moving
 * shadows on pair X, navigated to pair Y, and came back, finds their work
 * exactly where they left it.
 */
type PairKey = string;
type CandidateKey = string;

/**
 * Stored override for a single candidate. We only persist what the user has
 * touched — un-overridden candidates fall back to whatever Munkres + the
 * latest annotations produce.
 */
interface CandidateOverride {
  posA?: { x: number; y: number };
  posB?: { x: number; y: number };
  status?: 'pending' | 'locked' | 'accepted';
  /**
   * When true, the user has rejected this candidate entirely on this pair.
   * It will be filtered out at merge time.
   */
  rejected?: boolean;
}

export interface PairWorkingState {
  /**
   * Increments whenever any pair's overrides mutate. Useful as a `useMemo`
   * dependency for callers that need to recompute merged candidates.
   */
  version: number;
  /** Apply the user's pending edits onto the freshly-built candidates. */
  mergeCandidates: (
    pairKey: PairKey,
    fresh: MatchCandidate[]
  ) => MatchCandidate[];
  /** Drag a candidate's marker on side A or B (no DB write). */
  setCandidatePosition: (
    pairKey: PairKey,
    candidateKey: CandidateKey,
    side: 'A' | 'B',
    pos: { x: number; y: number }
  ) => void;
  /** Lock the candidate (first space press) — no DB write yet. */
  lockCandidate: (pairKey: PairKey, candidateKey: CandidateKey) => void;
  /** Mark accepted (second space press) — DB write happens elsewhere. */
  acceptCandidate: (pairKey: PairKey, candidateKey: CandidateKey) => void;
  /** Clear status back to pending (Escape, etc). */
  unlockCandidate: (pairKey: PairKey, candidateKey: CandidateKey) => void;
  /** Reject the candidate — won't be re-emitted by Munkres on this pair. */
  rejectCandidate: (pairKey: PairKey, candidateKey: CandidateKey) => void;
  /** Drop everything we know about a pair (e.g. after harness commits). */
  clearPair: (pairKey: PairKey) => void;
  /** Read-only summary used to detect un-saved work for the navigate-away guard. */
  hasUnsavedWork: (pairKey: PairKey) => boolean;
}

export function makePairKey(imageAId: string, imageBId: string): PairKey {
  return `${imageAId}__${imageBId}`;
}

/**
 * Holds working overrides for every pair the user has ever touched. Lives at
 * the harness level so navigating between pairs preserves drag positions and
 * lock-in state, exactly as the spec requires.
 */
export function usePairWorkingState(): PairWorkingState {
  // We keep both a ref (for synchronous reads inside callbacks) and a state
  // setter (to trigger re-renders for components that read merged candidates).
  const storeRef = useRef<Map<PairKey, Map<CandidateKey, CandidateOverride>>>(
    new Map()
  );
  const [version, bump] = useState(0);
  const rerender = useCallback(() => bump((n) => n + 1), []);

  const getPair = (pk: PairKey) => {
    let m = storeRef.current.get(pk);
    if (!m) {
      m = new Map();
      storeRef.current.set(pk, m);
    }
    return m;
  };

  const updateCandidate = useCallback(
    (
      pk: PairKey,
      ck: CandidateKey,
      mutator: (prev: CandidateOverride) => CandidateOverride
    ) => {
      const pair = getPair(pk);
      const prev = pair.get(ck) ?? {};
      pair.set(ck, mutator(prev));
      rerender();
    },
    [rerender]
  );

  const mergeCandidates = useCallback(
    (pk: PairKey, fresh: MatchCandidate[]): MatchCandidate[] => {
      const pair = storeRef.current.get(pk);
      if (!pair || pair.size === 0) return fresh;
      const out: MatchCandidate[] = [];
      for (const c of fresh) {
        const ov = pair.get(c.pairKey);
        if (ov?.rejected) continue;
        if (!ov) {
          out.push(c);
        } else {
          out.push({
            ...c,
            posA: ov.posA ?? c.posA,
            posB: ov.posB ?? c.posB,
            status: ov.status ?? c.status,
          });
        }
      }
      return out;
    },
    []
  );

  const setCandidatePosition: PairWorkingState['setCandidatePosition'] =
    useCallback(
      (pk, ck, side, pos) => {
        updateCandidate(pk, ck, (prev) => ({
          ...prev,
          ...(side === 'A' ? { posA: pos } : { posB: pos }),
        }));
      },
      [updateCandidate]
    );

  const lockCandidate: PairWorkingState['lockCandidate'] = useCallback(
    (pk, ck) => updateCandidate(pk, ck, (prev) => ({ ...prev, status: 'locked' })),
    [updateCandidate]
  );

  const acceptCandidate: PairWorkingState['acceptCandidate'] = useCallback(
    (pk, ck) => updateCandidate(pk, ck, (prev) => ({ ...prev, status: 'accepted' })),
    [updateCandidate]
  );

  const unlockCandidate: PairWorkingState['unlockCandidate'] = useCallback(
    (pk, ck) => updateCandidate(pk, ck, (prev) => ({ ...prev, status: 'pending' })),
    [updateCandidate]
  );

  const rejectCandidate: PairWorkingState['rejectCandidate'] = useCallback(
    (pk, ck) => updateCandidate(pk, ck, (prev) => ({ ...prev, rejected: true })),
    [updateCandidate]
  );

  const clearPair: PairWorkingState['clearPair'] = useCallback(
    (pk) => {
      storeRef.current.delete(pk);
      rerender();
    },
    [rerender]
  );

  const hasUnsavedWork: PairWorkingState['hasUnsavedWork'] = useCallback((pk) => {
    const pair = storeRef.current.get(pk);
    if (!pair || pair.size === 0) return false;
    for (const ov of pair.values()) {
      if (ov.posA || ov.posB) return true;
      if (ov.status && ov.status !== 'pending' && ov.status !== 'accepted') return true;
    }
    return false;
  }, []);

  return useMemo(
    () => ({
      version,
      mergeCandidates,
      setCandidatePosition,
      lockCandidate,
      acceptCandidate,
      unlockCandidate,
      rejectCandidate,
      clearPair,
      hasUnsavedWork,
    }),
    [
      version,
      mergeCandidates,
      setCandidatePosition,
      lockCandidate,
      acceptCandidate,
      unlockCandidate,
      rejectCandidate,
      clearPair,
      hasUnsavedWork,
    ]
  );
}
