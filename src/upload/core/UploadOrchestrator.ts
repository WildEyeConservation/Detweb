import type { ImageData } from '../../types/ImageData';
import { fetchAllPaginatedResults } from '../../utils';
import { logAdminAction } from '../../utils/adminActionLogger';
import { PhashIndex } from '../phashDedup';
import { PhashService } from '../phashService';
import { buildCameraResolver } from './cameras';
import { ElevationService } from './elevation';
import { Finalizer } from './Finalizer';
import { UploadStateStore } from './persistence';
import { sleep } from './pool';
import { getProjectKeyInfo, type ProjectKeyInfo } from './projectKeys';
import { RecordWriter } from './RecordWriter';
import {
  backoffDelayMs,
  classifyError,
  errorMessage,
  FatalUploadError,
} from './retry';
import { listUploadedOriginalPaths } from './s3';
import { TransferEngine, type TransferInput } from './TransferEngine';
import { removeDirectoryHandle } from './dirHandles';
import {
  ACTIVE_PHASES,
  type DuplicateRecord,
  type ItemFailure,
  type PauseReason,
  type SessionPhase,
  type SessionSnapshot,
  type UploadBackend,
  type UploadClient,
} from './types';

const MAX_SESSION_ATTEMPTS = 20;
const THROUGHPUT_WINDOW_MS = 30000;

export interface StartInput {
  client: UploadClient;
  backend: UploadBackend;
  projectId: string;
  userId: string;
  files: File[];
}

interface InternalSession {
  projectId: string;
  client: UploadClient;
  backend: UploadBackend;
  userId: string;
  fileByPath: Map<string, File>;
  store: UploadStateStore;
  elevation: ElevationService;
  phase: SessionPhase;
  pauseReason?: PauseReason;
  errorMessage?: string;
  processed: number;
  total: number;
  bytesUploaded: number;
  bytesTotal: number;
  throughputBps: number | null;
  etaSeconds: number | null;
  byteSamples: { t: number; bytes: number }[];
  failures: ItemFailure[];
  retryDelayMs: number;
  attempt: number;
  controller: AbortController;
  duplicates: DuplicateRecord[];
  startLogged: boolean;
  releaseLock: () => void;
}

interface PreparedPlan {
  keyInfo: ProjectKeyInfo;
  imageSetId: string;
  input: TransferInput;
}

type Listener = (snapshot: SessionSnapshot | null) => void;

// Owns upload state outside React so remounts do not kill transfers.
export class UploadOrchestrator {
  private session: InternalSession | null = null;
  private listeners = new Set<Listener>();
  // Cached so getSnapshot is referentially stable for useSyncExternalStore.
  private cachedSnapshot: SessionSnapshot | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('offline', () => {
        if (this.session && ACTIVE_PHASES.includes(this.session.phase)) {
          this.pause('offline');
        }
      });
      window.addEventListener('online', () => {
        if (this.session?.phase === 'paused' &&
            this.session.pauseReason === 'offline') {
          this.resume(this.session.projectId);
        }
      });
    }
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): SessionSnapshot | null {
    return this.cachedSnapshot;
  }

  isActive(projectId?: string): boolean {
    if (!this.session) return false;
    if (projectId && this.session.projectId !== projectId) return false;
    return ACTIVE_PHASES.includes(this.session.phase);
  }

  /** True when a paused/failed session for this project can resume in memory. */
  canResumeInMemory(projectId: string): boolean {
    return (
      this.session !== null &&
      this.session.projectId === projectId &&
      (this.session.phase === 'paused' || this.session.phase === 'failed') &&
      this.session.fileByPath.size > 0
    );
  }

  start(input: StartInput): void {
    if (this.session && ACTIVE_PHASES.includes(this.session.phase)) {
      if (this.session.projectId === input.projectId) return;
      console.warn(
        `Upload for project ${this.session.projectId} is active; ignoring start for ${input.projectId}`
      );
      return;
    }

    // Refresh file handles when the user re-picks a paused/failed upload.
    if (this.session && this.session.projectId === input.projectId) {
      for (const file of input.files) {
        this.session.fileByPath.set(file.webkitRelativePath, file);
      }
      this.resume(input.projectId);
      return;
    }

    this.session?.releaseLock();

    const session: InternalSession = {
      projectId: input.projectId,
      client: input.client,
      backend: input.backend,
      userId: input.userId,
      fileByPath: new Map(
        input.files.map((f) => [f.webkitRelativePath, f])
      ),
      store: new UploadStateStore(input.projectId),
      elevation: new ElevationService({
        bucketName: input.backend.custom.generalBucketName,
      }),
      phase: 'idle',
      processed: 0,
      total: 0,
      bytesUploaded: 0,
      bytesTotal: 0,
      throughputBps: null,
      etaSeconds: null,
      byteSamples: [],
      failures: [],
      retryDelayMs: 0,
      attempt: 1,
      controller: new AbortController(),
      duplicates: [],
      startLogged: false,
      releaseLock: () => {},
    };
    this.session = session;
    void this.beginSession(session);
  }

  /** Hold the per-project Web Lock for the full upload session. */
  private async beginSession(session: InternalSession): Promise<void> {
    const acquired = await acquireProjectLock(session);
    if (!acquired) {
      session.errorMessage =
        'This survey is already being uploaded in another tab or window.';
      session.pauseReason = 'fatal-error';
      this.setPhase(session, 'failed');
      return;
    }
    await this.runLoop(session);
  }

  pause(reason: PauseReason = 'user'): void {
    const session = this.session;
    if (!session || !ACTIVE_PHASES.includes(session.phase)) return;
    session.pauseReason = reason;
    session.controller.abort();
  }

  /** Resumes a paused/failed in-memory session. Returns false if none. */
  resume(projectId: string): boolean {
    const session = this.session;
    if (
      !session ||
      session.projectId !== projectId ||
      (session.phase !== 'paused' && session.phase !== 'failed')
    ) {
      return false;
    }
    session.pauseReason = undefined;
    session.errorMessage = undefined;
    session.attempt = 1;
    session.retryDelayMs = 0;
    session.controller = new AbortController();
    void this.runLoop(session);
    return true;
  }

  /** Aborts and discards the session (delete flow). Stores are untouched. */
  cancel(): void {
    const session = this.session;
    if (!session) return;
    session.pauseReason = undefined;
    session.controller.abort();
    this.setPhase(session, 'cancelled');
    session.releaseLock();
    this.clearSession();
  }

  /** Drops a paused/failed session (e.g. user dismisses the error pill). */
  discard(): void {
    const session = this.session;
    if (!session || ACTIVE_PHASES.includes(session.phase)) return;
    session.releaseLock();
    this.clearSession();
  }

  private clearSession(): void {
    this.session = null;
    this.cachedSnapshot = null;
    for (const listener of this.listeners) {
      try {
        listener(null);
      } catch (err) {
        console.error('Upload listener failed:', err);
      }
    }
  }

  private async runLoop(session: InternalSession): Promise<void> {
    for (;;) {
      let phashService: PhashService | null = null;
      try {
        this.setPhase(session, 'preparing');
        const plan = await this.prepare(session);
        if (await this.handleInterrupt(session)) return;

        this.setPhase(session, 'uploading');
        phashService = new PhashService(4);
        const engine = new TransferEngine(
          new RecordWriter({
            client: session.client,
            projectId: session.projectId,
            organizationId: plan.keyInfo.organizationId,
            imageSetId: plan.imageSetId,
            makeKey: plan.keyInfo.makeKey,
            elevation: session.elevation,
            cameras: await buildCameraResolver(
              session.client,
              session.projectId,
              (await session.store.getMetadata())?.folderCameraMapping ?? {}
            ),
            signal: session.controller.signal,
          }),
          phashService,
          session.store,
          {
            onItemProcessed: () => {
              session.processed += 1;
              this.emit(session);
            },
            onDuplicate: (dup) => {
              if (
                !session.duplicates.some(
                  (d) => d.originalPath === dup.originalPath
                )
              ) {
                session.duplicates.push(dup);
              }
            },
            onBytesUploaded: (bytes) => {
              session.bytesUploaded = bytes;
              updateThroughput(session);
              this.emit(session);
            },
          },
          session.controller.signal
        );
        const { failures } = await engine.run(plan.input);
        session.failures = failures;
        phashService.destroy();
        phashService = null;
        await session.store.flush();
        if (await this.handleInterrupt(session)) return;

        // Prune hash duplicates skipped by the transfer engine.
        await this.pruneDuplicates(session);

        // Verify every manifest item is on S3 before finalizing.
        const { remainingCount, uploadedPaths } =
          await this.verify(session, plan.keyInfo);
        if (remainingCount > 0 || failures.length > 0) {
          const failureNote =
            failures.length > 0
              ? `; ${failures.length} failed (first: ${failures[0].message})`
              : '';
          throw new Error(
            `${Math.max(remainingCount, failures.length)} file(s) not uploaded yet${failureNote}`
          );
        }

        this.setPhase(session, 'finalizing');
        const finalizer = new Finalizer({
          client: session.client,
          backend: session.backend,
          projectId: session.projectId,
          imageSetId: plan.imageSetId,
          keyInfo: plan.keyInfo,
          store: session.store,
          userId: session.userId,
        });
        await finalizer.run(uploadedPaths, session.duplicates);

        await session.store.clearProject();
        await removeDirectoryHandle(session.projectId).catch(() => {});
        this.setPhase(session, 'completed');
        session.releaseLock();
        this.clearSession();
        return;
      } catch (err) {
        phashService?.destroy();
        await session.store.flush().catch(() => {});
        if (await this.handleInterrupt(session)) return;

        const isFatal = classifyError(err) === 'fatal';
        const attemptsExhausted = session.attempt >= MAX_SESSION_ATTEMPTS;
        if (isFatal || attemptsExhausted) {
          console.error('Upload session failed:', err);
          session.errorMessage = attemptsExhausted && !isFatal
            ? `Upload kept failing after ${MAX_SESSION_ATTEMPTS} attempts. Last error: ${errorMessage(err)}`
            : errorMessage(err);
          session.pauseReason = 'fatal-error';
          this.setPhase(session, 'failed');
          return;
        }

        session.attempt += 1;
        session.retryDelayMs = backoffDelayMs(session.attempt);
        console.warn(
          `Upload attempt ${session.attempt - 1} failed (${errorMessage(err)}); retrying in ${Math.round(session.retryDelayMs / 1000)}s`
        );
        this.setPhase(session, 'waiting-retry');
        await sleep(session.retryDelayMs, session.controller.signal);
        session.retryDelayMs = 0;
        if (await this.handleInterrupt(session)) return;
      }
    }
  }

  /** Build the work plan from S3, DB state, and the persisted manifest. */
  private async prepare(session: InternalSession): Promise<PreparedPlan> {
    const { client, projectId, store } = session;

    // Best-effort start ping; the UI heartbeat keeps it fresh after this.
    try {
      await client.models.Project.update({ id: projectId, status: 'uploading' });
      try {
        await client.mutations.updateProjectMemberships({ projectId });
      } catch {
        /* noop: membership ping best-effort */
      }
    } catch {
      /* noop */
    }

    const keyInfo = await getProjectKeyInfo(client, projectId);

    const {
      data: [imageSet],
    } = await client.models.ImageSet.imageSetsByProjectId({ projectId });
    if (!imageSet?.id) {
      throw new FatalUploadError(
        `No image set found for project ${projectId}`
      );
    }

    const storedImages = await store.getImages();

    // Drop manifest entries without valid GPS (they can't produce usable
    // Image records) and persist the pruned manifest.
    const { validImages, invalidPaths } = storedImages.reduce(
      (acc: { validImages: ImageData[]; invalidPaths: string[] }, image) => {
        if (hasValidLatLng(image.latitude, image.longitude)) {
          acc.validImages.push(image);
        } else {
          acc.invalidPaths.push(image.originalPath);
        }
        return acc;
      },
      { validImages: [], invalidPaths: [] }
    );
    if (invalidPaths.length > 0) {
      console.warn(
        `Skipping ${invalidPaths.length} image${
          invalidPaths.length === 1 ? '' : 's'
        } with missing GPS coordinates:`,
        invalidPaths
      );
      await store.setImages(validImages);
    }

    const localPaths = new Set(validImages.map((img) => img.originalPath));
    const s3Files = await listUploadedOriginalPaths({
      projectId,
      keyInfo,
      localPaths,
    });

    const dbRawImages = (await fetchAllPaginatedResults(
      client.models.Image.imagesByProjectId,
      {
        projectId,
        selectionSet: ['id', 'originalPath', 'timestamp', 'cameraId', 'phash'],
        limit: 10000,
      }
    )) as {
      id: string;
      originalPath: string;
      timestamp: number;
      cameraId?: string | null;
      phash?: string | null;
    }[];

    // Seed the in-memory phash index from existing DB records. The index is
    // shared by both seed and upload workers.
    const phashIndex = new PhashIndex<{ originalPath: string }>(4);
    const dbSeededPaths = new Set<string>();
    for (const img of dbRawImages) {
      if (img.phash) {
        phashIndex.add(img.phash, { originalPath: img.originalPath });
        dbSeededPaths.add(img.originalPath);
      }
    }

    // Track which files are already on S3 / already have DB records.
    const uploadedFiles = Array.from(s3Files);
    await store.setUploadedPaths(uploadedFiles);

    const knownDbPaths = new Set(dbRawImages.map((img) => img.originalPath));
    await store.setCreatedImages(
      dbRawImages.map((img) => ({
        id: img.id,
        originalPath: img.originalPath,
        timestamp: img.timestamp,
        cameraId: img.cameraId ?? undefined,
      }))
    );

    // DB-seed tasks: files on S3 without DB records. Upload tasks: files
    // not yet on S3.
    const seedPaths = uploadedFiles.filter((path) => !knownDbPaths.has(path));
    const uploadImages = validImages.filter(
      (image) => !s3Files.has(image.originalPath)
    );

    session.total = seedPaths.length + uploadImages.length;
    session.processed = 0;
    session.failures = [];
    session.bytesUploaded = 0;
    session.bytesTotal = uploadImages.reduce(
      (acc, img) => acc + (session.fileByPath.get(img.originalPath)?.size ?? 0),
      0
    );
    session.byteSamples = [];
    session.throughputBps = null;
    session.etaSeconds = null;
    this.emit(session);

    if (
      keyInfo.organizationId &&
      session.total > 0 &&
      !session.startLogged
    ) {
      session.startLogged = true;
      const uploadBytes = uploadImages.reduce(
        (acc, img) => acc + (session.fileByPath.get(img.originalPath)?.size ?? 0),
        0
      );
      const seedNote =
        seedPaths.length > 0
          ? `, ${seedPaths.length} already on S3 awaiting DB sync`
          : '';
      await logAdminAction(
        client,
        session.userId,
        `Started upload: ${uploadImages.length} file${
          uploadImages.length === 1 ? '' : 's'
        } queued (${formatBytes(uploadBytes)})${seedNote}`,
        projectId,
        keyInfo.organizationId
      );
    }

    const imageByPath = new Map(
      validImages.map((img) => [img.originalPath, img])
    );

    return {
      keyInfo,
      imageSetId: imageSet.id,
      input: {
        seedPaths,
        uploadImages,
        fileByPath: session.fileByPath,
        imageByPath,
        knownDbPaths,
        makeKey: keyInfo.makeKey,
        phashIndex,
        dbSeededPaths,
      },
    };
  }

  private async pruneDuplicates(session: InternalSession): Promise<void> {
    if (session.duplicates.length === 0) return;
    const dupePaths = new Set(session.duplicates.map((d) => d.originalPath));
    const stored = await session.store.getImages();
    const remaining = stored.filter((img) => !dupePaths.has(img.originalPath));
    if (remaining.length !== stored.length) {
      await session.store.setImages(remaining);
    }
  }

  private async verify(
    session: InternalSession,
    keyInfo: ProjectKeyInfo
  ): Promise<{ remainingCount: number; uploadedPaths: Set<string> }> {
    const manifest = await session.store.getImages();
    const localPaths = new Set(manifest.map((img) => img.originalPath));
    const onS3 = await listUploadedOriginalPaths({
      projectId: session.projectId,
      keyInfo,
      localPaths,
    });
    const uploadedPaths = new Set(
      manifest
        .map((img) => img.originalPath)
        .filter((path) => onS3.has(path))
    );
    await session.store.setUploadedPaths(Array.from(uploadedPaths));
    return {
      remainingCount: manifest.length - uploadedPaths.size,
      uploadedPaths,
    };
  }

  /** Returns true when pause/cancel interrupted the run loop. */
  private async handleInterrupt(session: InternalSession): Promise<boolean> {
    if (!session.controller.signal.aborted) return false;
    await session.store.flush().catch(() => {});
    if (session.phase === 'cancelled') {
      // cancel() already transitioned and dropped the session.
      return true;
    }
    this.setPhase(session, 'paused');
    return true;
  }

  private setPhase(session: InternalSession, phase: SessionPhase): void {
    session.phase = phase;
    this.emit(session);
  }

  private emit(session: InternalSession): void {
    const snapshot = snapshotOf(session);
    this.cachedSnapshot = snapshot;
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err) {
        console.error('Upload listener failed:', err);
      }
    }
  }
}

function snapshotOf(session: InternalSession): SessionSnapshot {
  return {
    projectId: session.projectId,
    phase: session.phase,
    pauseReason: session.pauseReason,
    errorMessage: session.errorMessage,
    processed: session.processed,
    total: session.total,
    bytesUploaded: session.bytesUploaded,
    bytesTotal: session.bytesTotal,
    throughputBps: session.throughputBps,
    etaSeconds: session.etaSeconds,
    failures: session.failures,
    retryDelayMs: session.retryDelayMs,
    attempt: session.attempt,
  };
}

/** Moving-window (30s) byte throughput and ETA. */
function updateThroughput(session: InternalSession): void {
  const now = Date.now();
  session.byteSamples.push({ t: now, bytes: session.bytesUploaded });
  while (
    session.byteSamples.length > 2 &&
    session.byteSamples[0].t < now - THROUGHPUT_WINDOW_MS
  ) {
    session.byteSamples.shift();
  }
  const first = session.byteSamples[0];
  const last = session.byteSamples[session.byteSamples.length - 1];
  const dtSeconds = (last.t - first.t) / 1000;
  if (dtSeconds >= 2 && last.bytes > first.bytes) {
    session.throughputBps = (last.bytes - first.bytes) / dtSeconds;
    session.etaSeconds =
      session.throughputBps > 0
        ? Math.max(0, session.bytesTotal - session.bytesUploaded) /
          session.throughputBps
        : null;
  }
}

/** Exclusive per-project Web Lock; falls open if the API is unavailable. */
function acquireProjectLock(session: InternalSession): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('locks' in navigator)) {
    return Promise.resolve(true);
  }
  return new Promise<boolean>((resolve) => {
    let settled = false;
    let release: () => void = () => {};
    const held = new Promise<void>((r) => (release = r));
    navigator.locks
      .request(
        `detweb-upload:${session.projectId}`,
        { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            settled = true;
            resolve(false);
            return;
          }
          session.releaseLock = release;
          settled = true;
          resolve(true);
          await held;
        }
      )
      .catch((err) => {
        if (!settled) {
          console.warn('Web Lock acquisition failed; continuing without:', err);
          settled = true;
          resolve(true);
        }
      });
  });
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const hasValidLatLng = (lat: unknown, lng: unknown): boolean =>
  isFiniteNumber(lat) &&
  lat >= -90 &&
  lat <= 90 &&
  isFiniteNumber(lng) &&
  lng >= -180 &&
  lng <= 180;

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = bytes;
  let i = 0;
  while (size >= 1024 && i < units.length - 1) {
    size /= 1024;
    i++;
  }
  return `${size.toFixed(2)} ${units[i]}`;
}

// Module-level singleton: the session must outlive any React component.
export const uploadOrchestrator = new UploadOrchestrator();
