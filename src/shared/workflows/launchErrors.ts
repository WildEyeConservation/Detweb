import { getErrorMessages } from '../../../amplify/shared/errorMessage';

/** A timed-out launch may still be running; do not submit it again. */
export function shouldIgnoreLaunchError(error: unknown): boolean {
  return getErrorMessages(error).some(message =>
    /timed out|timeout|Task timed out|socket hang up/i.test(message)
  );
}
