import React, { useState, useEffect, useContext } from 'react';
import { UserContext } from './Context';

export interface Identifiable {
  id: string;
  [key: string]: any;
}

export type FetcherType = () => Promise<Identifiable>;

/** Props the Preloader injects into each buffered task when rendering it. */
export interface PreloadedTaskProps extends Identifiable {
  visible: boolean;
  next?: () => void;
  prev?: () => void;
  setIsReady: () => void;
}

interface PreloaderProps {
  fetcher: FetcherType;
  index: number;
  setIndex: (index: number | ((prevState: number) => number)) => void;
  historyN?: number;
  preloadN?: number;
  visible?: boolean;
  prefetch?: number;
  /** Renders one buffered task. Receives the fetched task fields plus navigation props. */
  renderTask: (task: PreloadedTaskProps) => React.ReactNode;
}

/*
The Preloader keeps a buffer of tasks around the current index: it fetches
ahead (preloadN) so the next task is ready before the user pages to it, and
keeps recent tasks mounted (historyN) so paging back is instant. All buffered
tasks stay mounted but only the current one is visible.
*/
export function Preloader({
  historyN = 2,
  preloadN = 3,
  fetcher,
  visible = true,
  index,
  setIndex,
  prefetch = 0,
  renderTask,
}: PreloaderProps) {
  const [buffer, setBuffer] = useState<Identifiable[]>([]);
  const [waitingCount, setWaitingCount] = useState<number>(0);
  const { setJobsCompleted } = useContext(UserContext)!;

  useEffect(() => {
    if (
      index >
      buffer.length + Math.max(waitingCount, 0) - preloadN - 1 - prefetch
    ) {
      setWaitingCount((wc) => wc + 1);
      fetcher().then((props) => {
        setWaitingCount((wc) => wc - 1);
        if (props) {
          setBuffer((b) => [...b, { ...props, id: crypto.randomUUID() }]);
        }
      });
    }
  }, [buffer.length, index]);

  const subsetStart = Math.max(index - historyN, 0); // Keep at the least the last historyN entries in memory
  const subset = buffer.slice(subsetStart, index + preloadN);
  if (!subset.length) {
    return null;
  }
  return (
    <div className='w-100 h-100' style={{ position: 'relative' }}>
      {subset.map((entry, i) => (
        <div
          key={entry.id}
          className={'d-flex justify-content-center w-100 h-100'}
          style={{
            visibility: i === index - subsetStart ? 'visible' : 'hidden',
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
        >
          {renderTask({
            ...entry,
            setIsReady: () => {},
            visible: visible && i === index - subsetStart,
            next:
              i < subset.length - 1
                ? () => {
                    setJobsCompleted((x) => x + 1);
                    setIndex((index) => index + 1);
                  }
                : undefined,
            prev:
              i > 0
                ? () => {
                    setJobsCompleted((x) => x - 1);
                    setIndex((index) => index - 1);
                  }
                : undefined,
          })}
        </div>
      ))}
    </div>
  );
}
