import { useCallback, useLayoutEffect, useRef } from 'react';

/** Read current values from events without resubscribing or resetting a workspace. */
export function useLatestRef<T>(value: T) {
  const ref = useRef(value);
  useLayoutEffect(() => { ref.current = value; }, [value]);
  return ref;
}

export function useEventCallback<Args extends unknown[], Result>(callback: (...args: Args) => Result) {
  const ref = useLatestRef(callback);
  return useCallback((...args: Args) => ref.current(...args), [ref]);
}
