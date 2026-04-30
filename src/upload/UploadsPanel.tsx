import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  UploadCloud,
  X,
  WifiOff,
  AlertTriangle,
  CheckCircle2,
  Pause,
  type LucideIcon,
} from 'lucide-react';
import { UploadContext, GlobalContext } from '../Context';

const MAX_SPEED_SAMPLES = 30;

type UploadStatus =
  | 'uploading'
  | 'retrying'
  | 'completed'
  | 'error'
  | 'paused';

export interface UploadSummary {
  projectId: string;
  projectName: string;
  processed: number;
  total: number;
  percent: number;
  status: UploadStatus;
  error: string | null;
  retryDelay: number;
  averageSpeed: number;
  estimatedSecondsRemaining: number | null;
  speedSamples: number[];
}

interface SpeedTracker {
  startedAt: number;
  lastProcessed: number;
  samples: number[];
}

function formatRemaining(seconds: number | null): string | null {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return null;
  if (seconds < 60) return `${Math.round(seconds)}s remaining`;
  if (seconds < 3600) return `${Math.round(seconds / 60)} min remaining`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return `${hours}h ${minutes}m remaining`;
}

function formatSpeed(itemsPerSec: number): string {
  if (!Number.isFinite(itemsPerSec) || itemsPerSec <= 0) return '0 imgs/s';
  if (itemsPerSec < 1) return `${itemsPerSec.toFixed(2)} imgs/s`;
  if (itemsPerSec < 10) return `${itemsPerSec.toFixed(1)} imgs/s`;
  return `${Math.round(itemsPerSec)} imgs/s`;
}

function useProjectName(projectId: string): string {
  const { client } = useContext(GlobalContext)!;
  const { data } = useQuery({
    queryKey: ['Project', projectId, 'name'],
    queryFn: async () => {
      if (!projectId) return null;
      const { data } = await client.models.Project.get(
        { id: projectId },
        { selectionSet: ['id', 'name'] as const }
      );
      return data?.name ?? null;
    },
    enabled: !!projectId,
    staleTime: 60_000,
  });
  return data ?? '';
}

/**
 * Returns the list of active uploads. Currently length 0 or 1 because the
 * upload manager handles one survey at a time. Component code should treat it
 * as a list — when the manager is refactored to multi-survey, only this hook
 * needs to swap its data source.
 */
function useUploadSummaries(): UploadSummary[] {
  const {
    task: { projectId, retryDelay },
    progress: { processed, total, isComplete, error },
  } = useContext(UploadContext)!;

  const projectName = useProjectName(projectId);
  const trackers = useRef<Map<string, SpeedTracker>>(new Map());
  const [, forceTick] = useState(0);
  const processedRef = useRef(processed);
  processedRef.current = processed;

  // Reset tracker when the upload's project changes or it finishes/errors.
  useEffect(() => {
    if (!projectId || isComplete || error) {
      trackers.current.clear();
      return;
    }
    if (!trackers.current.has(projectId)) {
      trackers.current.set(projectId, {
        startedAt: Date.now(),
        lastProcessed: processed,
        samples: [],
      });
    }
  }, [projectId, isComplete, error, processed]);

  // 1Hz speed sampler — captures items/sec for the sparkline.
  useEffect(() => {
    if (!projectId || isComplete || error) return;
    const id = setInterval(() => {
      const tracker = trackers.current.get(projectId);
      if (!tracker) return;
      const current = processedRef.current;
      const delta = Math.max(0, current - tracker.lastProcessed);
      tracker.lastProcessed = current;
      tracker.samples.push(delta);
      if (tracker.samples.length > MAX_SPEED_SAMPLES) {
        tracker.samples.shift();
      }
      forceTick((t) => (t + 1) % 1_000_000);
    }, 1000);
    return () => clearInterval(id);
  }, [projectId, isComplete, error]);

  return useMemo(() => {
    if (!projectId) return [];

    const tracker = trackers.current.get(projectId);
    const elapsedSec = tracker
      ? Math.max(1, (Date.now() - tracker.startedAt) / 1000)
      : 1;
    const averageSpeed =
      processed > 0 && elapsedSec > 0 ? processed / elapsedSec : 0;
    const remaining = total - processed;
    const eta =
      averageSpeed > 0 && remaining > 0
        ? remaining / averageSpeed
        : isComplete
        ? 0
        : null;

    const status: UploadStatus = error
      ? 'error'
      : isComplete
      ? 'completed'
      : retryDelay > 0
      ? 'retrying'
      : 'uploading';

    return [
      {
        projectId,
        projectName: projectName || 'Loading…',
        processed,
        total,
        percent: total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0,
        status,
        error,
        retryDelay,
        averageSpeed,
        estimatedSecondsRemaining: eta,
        speedSamples: tracker?.samples ?? [],
      },
    ];
  }, [projectId, projectName, processed, total, isComplete, error, retryDelay]);
}

function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  return isOnline;
}

function SpeedSparkline({ samples }: { samples: number[] }) {
  const width = 220;
  const height = 36;
  const padding = 2;

  if (samples.length < 2) {
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <line
          x1={0}
          y1={height - padding}
          x2={width}
          y2={height - padding}
          stroke='#37495A'
          strokeWidth={1}
        />
      </svg>
    );
  }

  const max = Math.max(...samples, 1);
  const stepX = (width - padding * 2) / (MAX_SPEED_SAMPLES - 1);
  // Right-align so latest sample is at the right edge.
  const offsetX = width - padding - (samples.length - 1) * stepX;

  const points = samples.map((v, i) => {
    const x = offsetX + i * stepX;
    const y = padding + (height - padding * 2) * (1 - v / max);
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `M ${offsetX.toFixed(2)},${(height - padding).toFixed(
    2
  )} L ${points.join(' L ')} L ${(
    offsetX +
    (samples.length - 1) * stepX
  ).toFixed(2)},${(height - padding).toFixed(2)} Z`;

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <defs>
        <linearGradient id='ss-upload-spark' x1='0' y1='0' x2='0' y2='1'>
          <stop offset='0%' stopColor='#DF6919' stopOpacity='0.5' />
          <stop offset='100%' stopColor='#DF6919' stopOpacity='0.02' />
        </linearGradient>
      </defs>
      <path d={areaPath} fill='url(#ss-upload-spark)' />
      <path
        d={linePath}
        fill='none'
        stroke='#DF6919'
        strokeWidth={1.5}
        strokeLinecap='round'
        strokeLinejoin='round'
      />
    </svg>
  );
}

function UploadCard({
  upload,
  isOnline,
}: {
  upload: UploadSummary;
  isOnline: boolean;
}) {
  const { processed, total, percent, status, projectName, averageSpeed, speedSamples } =
    upload;

  const eta = formatRemaining(upload.estimatedSecondsRemaining);

  let statusLine: React.ReactNode;
  let StatusIcon: LucideIcon | null = null;
  let statusColor = 'rgba(255,255,255,0.5)';

  if (!isOnline) {
    StatusIcon = WifiOff;
    statusColor = '#e0b34a';
    statusLine = 'Waiting for connection…';
  } else if (status === 'error') {
    StatusIcon = AlertTriangle;
    statusColor = '#e07a6a';
    statusLine = 'Error — retrying soon';
  } else if (status === 'retrying') {
    StatusIcon = AlertTriangle;
    statusColor = '#e0b34a';
    statusLine = 'Retrying failed images…';
  } else if (status === 'completed') {
    StatusIcon = CheckCircle2;
    statusColor = '#6dcba0';
    statusLine = 'Finished';
  } else if (status === 'paused') {
    StatusIcon = Pause;
    statusLine = 'Paused';
  } else {
    statusLine = (
      <>
        <span style={{ color: '#fff', fontWeight: 500 }}>Uploading</span>
        {eta && (
          <span style={{ color: 'rgba(255,255,255,0.5)', marginLeft: 6 }}>
            {eta}
          </span>
        )}
      </>
    );
  }

  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={projectName}
          >
            {projectName}
          </div>
          <div
            style={{
              fontSize: 12,
              marginTop: 2,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              color: statusColor,
            }}
          >
            {StatusIcon && <StatusIcon size={12} />}
            <span>{statusLine}</span>
          </div>
        </div>
        <div
          style={{
            color: 'rgba(255,255,255,0.55)',
            fontSize: 12,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {processed.toLocaleString()} / {total.toLocaleString()}
        </div>
      </div>

      <div
        style={{
          height: 4,
          borderRadius: 2,
          background: 'rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${percent}%`,
            background:
              status === 'error'
                ? '#e07a6a'
                : status === 'retrying'
                ? '#e0b34a'
                : status === 'completed'
                ? '#6dcba0'
                : 'var(--ss-accent)',
            transition: 'width 0.4s ease',
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.35)',
            }}
          >
            Speed
          </div>
          <div style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
            {formatSpeed(averageSpeed)}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <SpeedSparkline samples={speedSamples} />
        </div>
      </div>
    </div>
  );
}

function UploadsPopover({
  uploads,
  isOnline,
  onClose,
}: {
  uploads: UploadSummary[];
  isOnline: boolean;
  onClose: () => void;
}) {
  const activeCount = uploads.filter(
    (u) => u.status === 'uploading' || u.status === 'retrying'
  ).length;

  return (
    <div className='ss-sidebar-popover'>
      <div
        style={{
          padding: '14px 16px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <UploadCloud size={16} color='rgba(255,255,255,0.85)' />
          <div
            style={{
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: '-0.01em',
            }}
          >
            Uploads
          </div>
          {activeCount > 0 && (
            <div
              style={{
                background: '#37495A',
                color: '#ffffff',
                border: '1px solid #475867',
                fontSize: 11,
                fontWeight: 700,
                padding: '1px 7px',
                borderRadius: 999,
                lineHeight: 1.4,
              }}
            >
              {activeCount}
            </div>
          )}
        </div>
        <X
          size={16}
          color='rgba(255,255,255,0.55)'
          style={{ cursor: 'pointer' }}
          onClick={onClose}
        />
      </div>

      <div
        style={{
          padding: 14,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {uploads.length === 0 ? (
          <div
            style={{
              padding: '28px 12px',
              textAlign: 'center',
              color: 'rgba(255,255,255,0.45)',
              fontSize: 13,
            }}
          >
            <UploadCloud
              size={28}
              color='rgba(255,255,255,0.2)'
              style={{ marginBottom: 8 }}
            />
            <div>No active uploads</div>
            <div style={{ fontSize: 11, marginTop: 4, color: 'rgba(255,255,255,0.3)' }}>
              Survey uploads will appear here while in progress.
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.35)',
                padding: '0 2px',
              }}
            >
              Active
            </div>
            {uploads.map((upload) => (
              <UploadCard
                key={upload.projectId}
                upload={upload}
                isOnline={isOnline}
              />
            ))}
            <div
              style={{
                fontSize: 11,
                color: 'rgba(255,255,255,0.35)',
                lineHeight: 1.4,
                padding: '4px 2px 0',
              }}
            >
              Speed shows images processed per second — not raw network
              throughput. Each image goes through file upload, database writes,
              and metadata reconciliation.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function UploadStatusButton() {
  const [show, setShow] = useState(false);
  const uploads = useUploadSummaries();
  const isOnline = useOnlineStatus();

  const activeCount = uploads.filter(
    (u) =>
      u.status === 'uploading' ||
      u.status === 'retrying' ||
      u.status === 'error'
  ).length;
  const hasActivity = uploads.length > 0;

  return (
    <div className='position-relative'>
      <button
        onClick={() => setShow((s) => !s)}
        title={hasActivity ? 'Uploads in progress' : 'Uploads'}
        style={{
          position: 'relative',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 6,
          color: hasActivity ? '#fff' : 'rgba(255,255,255,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <UploadCloud size={18} />
        {activeCount > 0 && (
          <span
            className='bg-primary text-white'
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              minWidth: 16,
              height: 16,
              padding: '0 4px',
              borderRadius: 8,
              fontSize: 10,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              lineHeight: 1,
            }}
          >
            {activeCount}
          </span>
        )}
        {hasActivity && activeCount === 0 && (
          <span
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#6dcba0',
              border: '1.5px solid #2B3E50',
            }}
          />
        )}
      </button>

      {show && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1049,
          }}
          onClick={() => setShow(false)}
        />
      )}

      {show && (
        <UploadsPopover
          uploads={uploads}
          isOnline={isOnline}
          onClose={() => setShow(false)}
        />
      )}
    </div>
  );
}
