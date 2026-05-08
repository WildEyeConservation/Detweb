import type { MatchCandidate, PairCompletionState } from '../types';

/**
 * A pair is complete when every linkable candidate has been accepted
 * (objectIds linked on both sides) and there are no shadow positions still
 * un-confirmed.
 *
 * `empty` means the harness should still treat the pair as "done" — there
 * are no annotations in the overlap region to match.
 *
 * Informational candidates (annotations that project outside the partner
 * image and thus have no link to make) are excluded from the totals.
 */
export function evaluatePairCompletion(
  candidates: MatchCandidate[]
): PairCompletionState {
  const linkable = candidates.filter((c) => !c.informational);
  if (linkable.length === 0) {
    return { status: 'empty', remaining: 0, total: 0 };
  }
  const remaining = linkable.filter((c) => c.status !== 'accepted').length;
  return {
    status: remaining === 0 ? 'complete' : 'incomplete',
    remaining,
    total: linkable.length,
  };
}

/**
 * Color used by the harness progress bar.
 *  - green: complete or empty (nothing to do)
 *  - yellow: incomplete (work pending)
 */
export function completionColor(state: PairCompletionState): string {
  return state.status === 'incomplete' ? '#f1c40f' : '#2ecc71';
}
