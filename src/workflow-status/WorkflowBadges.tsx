import { useContext, useEffect, useState, useRef } from 'react';
import { Badge } from 'react-bootstrap';
import { GlobalContext } from '../Context';
import { fetchAllPaginatedResults } from '../utils';
import { getShowWorkflowStatus } from '../user/Settings';
import {
  deriveWorkflowStatuses,
  WORKFLOW_LABELS,
  type AnnotationSetWorkflows,
  type WorkflowInfo,
  type WorkflowType,
} from './workflowStatus';

const BADGE_CONFIG: Record<string, { bg: string; text?: string }> = {
  done: { bg: 'success' },
  not_done: { bg: 'danger' },
  incomplete: { bg: 'warning', text: 'dark' },
};

function StatusBadge({ label, info }: {
  label: string;
  info: { state: string; detail?: string; launchedBy?: string; cancelledBy?: string };
}) {
  const cfg = BADGE_CONFIG[info.state];
  const detail = info.detail ? ` \u00b7 ${info.detail}` : '';
  return (
    <Badge
      bg={cfg.bg}
      text={cfg.text as any}
      style={{ fontSize: '11px' }}
      title={
        info.state === 'done'
          ? `${label}: Done${info.launchedBy ? ` (launched by ${info.launchedBy})` : ''}`
          : info.state === 'incomplete'
            ? `${label}: Incomplete${info.cancelledBy ? ` (cancelled by ${info.cancelledBy})` : ' (in progress or cancelled)'}`
            : `${label}: Not done`
      }
    >
      {label}{detail}
    </Badge>
  );
}

function AnnotationSetBadges({ workflows }: { workflows: AnnotationSetWorkflows }) {
  const singleWorkflows: WorkflowType[] = ['falseNegatives', 'homography'];

  return (
    <div className='d-flex gap-1 flex-wrap'>
      {workflows.modelGuided.length > 0
        ? workflows.modelGuided.map((info, i) => (
          <StatusBadge key={`mg-${i}`} label='MG' info={info} />
        ))
        : <StatusBadge key='mg-none' label='MG' info={{ state: 'not_done' }} />}
      {singleWorkflows.map((wf) => {
        const info = workflows[wf] as WorkflowInfo;
        return <StatusBadge key={wf} label={WORKFLOW_LABELS[wf]} info={info} />;
      })}
      {workflows.qcReview.length > 0
        ? workflows.qcReview.map((info, i) => (
          <StatusBadge key={`qc-${i}`} label='QC' info={info} />
        ))
        : <StatusBadge key='qc-none' label='QC' info={{ state: 'not_done' }} />}
    </div>
  );
}

// Module-level cache so multiple annotation sets in the same project share one fetch
const fetchCache = new Map<string, Promise<Record<string, AnnotationSetWorkflows>>>();

/**
 * Self-contained component that fetches admin action logs for a project
 * and displays workflow status badges for a specific annotation set.
 *
 * Renders nothing if the experimental setting is disabled.
 */
export default function WorkflowBadges({
  projectId,
  annotationSetNames,
  annotationSetName,
}: {
  projectId: string;
  annotationSetNames: string[];
  annotationSetName: string;
}) {
  const [enabled] = useState(getShowWorkflowStatus);
  const { client } = useContext(GlobalContext)!;
  const [workflows, setWorkflows] = useState<AnnotationSetWorkflows | null>(null);
  const namesKey = annotationSetNames.join(',');
  const prevKey = useRef('');

  useEffect(() => {
    if (!enabled) return;

    const cacheKey = `${projectId}::${namesKey}`;

    // Invalidate cache if annotation set names changed for this project
    if (prevKey.current !== cacheKey) {
      fetchCache.delete(prevKey.current);
      prevKey.current = cacheKey;
    }

    if (!fetchCache.has(cacheKey)) {
      fetchCache.set(
        cacheKey,
        fetchAllPaginatedResults(
          client.models.AdminActionLog.adminActionLogsByProjectId,
          {
            projectId,
            limit: 1000,
            selectionSet: ['userId', 'message', 'createdAt'],
          }
        ).then((logs) =>
          deriveWorkflowStatuses(logs as any, annotationSetNames)
        ).catch((err) => {
          console.error(`Failed to fetch workflow logs for project ${projectId}:`, err);
          fetchCache.delete(cacheKey);
          return {};
        })
      );
    }

    let cancelled = false;
    fetchCache.get(cacheKey)!.then((statuses) => {
      if (!cancelled) {
        setWorkflows(statuses[annotationSetName] ?? null);
      }
    });

    return () => { cancelled = true; };
  }, [enabled, projectId, namesKey, annotationSetName]);

  if (!enabled || !workflows) return null;

  return <AnnotationSetBadges workflows={workflows} />;
}
