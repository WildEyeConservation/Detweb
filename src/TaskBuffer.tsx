import React, { useState, useEffect, useContext } from 'react';
import { UserContext } from './Context';

export type TaskPayload = object;

export type Identifiable = TaskPayload & {
  id: string;
};

export type FetcherType<T extends TaskPayload = TaskPayload> = () => Promise<T>;

/** Props TaskBuffer injects into each buffered task when rendering it. */
export type BufferedTaskProps<T extends TaskPayload = TaskPayload> = T & {
  id: string;
  visible: boolean;
  next?: () => void;
  prev?: () => void;
};

interface TaskBufferProps<T extends TaskPayload> {
  fetcher: FetcherType<T>;
  index: number;
  setIndex: (index: number | ((prevState: number) => number)) => void;
  historyN?: number;
  preloadN?: number;
  visible?: boolean;
  prefetch?: number;
  /** Renders one buffered task. Receives the fetched task fields plus navigation props. */
  renderTask: (task: BufferedTaskProps<T>) => React.ReactNode;
}

/*
TaskBuffer keeps a window of tasks around the current index: it fetches
ahead (preloadN) so the next task is ready before the user pages to it, and
keeps recent tasks mounted (historyN) so paging back is instant. All buffered
tasks stay mounted but only the current one is visible.
*/
export function TaskBuffer<T extends TaskPayload>({
  historyN = 2,
  preloadN = 3,
  fetcher,
  visible = true,
  index,
  setIndex,
  prefetch = 0,
  renderTask,
}: TaskBufferProps<T>) {
  const [buffer, setBuffer] = useState<Array<T & { id: string }>>([]);
  const [waitingCount, setWaitingCount] = useState<number>(0);
  const { setJobsCompleted } = useContext(UserContext)!;

  useEffect(() => {
    if (
      index >
      buffer.length + Math.max(waitingCount, 0) - preloadN - 1 - prefetch
    ) {
      setWaitingCount((wc) => wc + 1);
      fetcher()
        .then((props) => {
          if (props) {
            setBuffer((b) => [...b, { ...props, id: crypto.randomUUID() }]);
          }
        })
        .catch((error) => {
          console.error('Task fetch failed', error);
        })
        .finally(() => {
          setWaitingCount((wc) => wc - 1);
        });
    }
    // Refill only when navigation or a completed fetch changes the buffer.
    // A new render-time fetcher identity must not enqueue duplicate work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buffer.length, index]);

  const subsetStart = Math.max(index - historyN, 0);
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
