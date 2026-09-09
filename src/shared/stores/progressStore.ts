import type { ReactElement, SetStateAction } from 'react';
import { Store } from '@tanstack/store';
import { useSelector } from '@tanstack/react-store';

export type ProgressState = Record<string, { value?: number; detail: ReactElement }>;

const progressStore = new Store<ProgressState>({});

// Writers do not observe other tasks' progress.
export function setProgress(value: SetStateAction<ProgressState>) {
  progressStore.setState((previous) =>
    typeof value === 'function' ? value(previous) : value
  );
}

export function useProgress() {
  return useSelector(progressStore, (state) => state);
}
