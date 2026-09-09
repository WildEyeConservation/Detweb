// Long-lived perceptual-hash worker pool used by the upload pipeline.
// Each upload worker awaits hash() per file before deciding whether to
// upload; the pool keeps workers warm so we don't pay Worker startup cost
// for every file.

interface PendingJob {
  resolve: (phash: string | null) => void;
}

interface QueueEntry {
  id: number;
  file: File;
}

type WorkerMessage =
  | { id: number; phash: string }
  | { id: number; error: string };

export class PhashService {
  private workers: Worker[] = [];
  private idle: Worker[] = [];
  private pending = new Map<number, PendingJob>();
  private queue: QueueEntry[] = [];
  private nextId = 0;
  private destroyed = false;

  constructor(workerCount = 4) {
    const count = Math.max(1, workerCount);
    for (let i = 0; i < count; i++) {
      const worker = new Worker(
        new URL('./phashWorker.ts', import.meta.url),
        { type: 'module' }
      );
      worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
        const data = event.data;
        const cb = this.pending.get(data.id);
        this.pending.delete(data.id);
        if (cb) {
          cb.resolve('phash' in data ? data.phash : null);
        }
        this.idle.push(worker);
        this.dispatch();
      };
      worker.onerror = () => {
        // Resolve any in-flight job for this worker as null and recycle it.
        // The next dispatch will route work to remaining idle workers.
        this.idle.push(worker);
        this.dispatch();
      };
      this.workers.push(worker);
      this.idle.push(worker);
    }
  }

  hash(file: File): Promise<string | null> {
    if (this.destroyed) return Promise.resolve(null);
    return new Promise((resolve) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve });
      this.queue.push({ id, file });
      this.dispatch();
    });
  }

  destroy(): void {
    this.destroyed = true;
    for (const w of this.workers) w.terminate();
    this.workers = [];
    this.idle = [];
    for (const job of this.pending.values()) job.resolve(null);
    this.pending.clear();
    this.queue.length = 0;
  }

  private dispatch(): void {
    while (this.idle.length > 0 && this.queue.length > 0) {
      const worker = this.idle.pop()!;
      const job = this.queue.shift()!;
      worker.postMessage({ id: job.id, file: job.file });
    }
  }
}
