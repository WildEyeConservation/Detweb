/**
 * Parses AdminActionLog records to derive workflow status per annotation set.
 *
 * Workflow detection is based on message text patterns logged by the app:
 * - Model Guided: "Launched Model Guided queue for annotation set "..."
 * - False Negatives: "Launched False Negatives queue for annotation set "..."
 * - QC Review: "Launched QC Review for category "..." in annotation set "..."
 * - Homography: "Launched Homography task for ... in annotation set "..."
 *
 * Completion is inferred by pairing a launch (by a human user) with a subsequent
 * cancellation by "SurveyScope" (the system). A human cancellation means it was
 * manually stopped (incomplete).
 */

export type WorkflowType = 'modelGuided' | 'falseNegatives' | 'qcReview' | 'homography';

export type WorkflowState = 'done' | 'not_done' | 'incomplete';

export interface WorkflowInfo {
  state: WorkflowState;
  /** Extra detail to show (e.g. confidence thresholds, sample %) */
  detail?: string;
  /** Who launched it */
  launchedBy?: string;
  /** Who cancelled it (if cancelled) */
  cancelledBy?: string;
}

export interface AnnotationSetWorkflows {
  modelGuided: WorkflowInfo[];
  falseNegatives: WorkflowInfo;
  qcReview: WorkflowInfo[];
  homography: WorkflowInfo;
}

export const WORKFLOW_LABELS: Record<WorkflowType, string> = {
  modelGuided: 'MG',
  falseNegatives: 'FN',
  qcReview: 'QC',
  homography: 'Homography',
};

interface LogEntry {
  userId: string;
  message: string;
  createdAt?: string | null;
}

/**
 * Extract the annotation set name from a log message.
 * Messages use the pattern: annotation set "SomeName"
 */
function extractAnnotationSetName(message: string): string | null {
  const match = message.match(/annotation set "([^"]+)"/);
  return match ? match[1] : null;
}

/**
 * Extract confidence range from a Model Guided launch message.
 * e.g. "Confidence: 0.65-1" -> "0.65-1"
 */
function extractMGDetail(message: string): string | undefined {
  const match = message.match(/Confidence: ([0-9.]+)-?([0-9.]*)/);
  if (!match) return undefined;
  return match[2] ? `${match[1]}-${match[2]}` : match[1];
}

/**
 * Extract sample percentage from a False Negatives launch message.
 * e.g. "(5% sample)" -> "5%"
 */
function extractFNDetail(message: string): string | undefined {
  const match = message.match(/(\d+)% sample/);
  return match ? `${match[1]}%` : undefined;
}

/**
 * Extract category name and sample percentage from a QC Review launch message.
 * e.g. 'Launched QC Review for category "Kob" in annotation set "..." (20% sample)'
 * -> "Kob · 20%"
 */
function extractQCDetail(message: string): string | undefined {
  const category = message.match(/for category "([^"]+)"/)?.[1];
  const sample = message.match(/(\d+)% sample/)?.[1];
  const parts = [category, sample ? `${sample}%` : null].filter(Boolean);
  return parts.length ? parts.join(' \u00b7 ') : undefined;
}

interface ParsedAction {
  annotationSetName: string;
  workflow: WorkflowType;
  action: 'launch' | 'cancel';
  userId: string;
  detail?: string;
  /** For QC Review: the category name */
  category?: string;
  createdAt: number;
}

function parseLogEntry(log: LogEntry): ParsedAction | null {
  const msg = log.message;
  const ts = new Date(log.createdAt ?? 0).getTime();

  // Model Guided launches
  if (msg.includes('Launched Model Guided queue')) {
    const name = extractAnnotationSetName(msg);
    if (!name) return null;
    return {
      annotationSetName: name,
      workflow: 'modelGuided',
      action: 'launch',
      userId: log.userId,
      detail: extractMGDetail(msg),
      createdAt: ts,
    };
  }

  // False Negatives launches
  if (msg.includes('Launched False Negatives queue') || msg.includes('Launched additional') && msg.includes('False Negatives')) {
    const name = extractAnnotationSetName(msg);
    if (!name) return null;
    return {
      annotationSetName: name,
      workflow: 'falseNegatives',
      action: 'launch',
      userId: log.userId,
      detail: extractFNDetail(msg),
      createdAt: ts,
    };
  }

  // QC Review launches
  if (msg.includes('Launched QC Review')) {
    const name = extractAnnotationSetName(msg);
    if (!name) return null;
    const category = msg.match(/for category "([^"]+)"/)?.[1];
    return {
      annotationSetName: name,
      workflow: 'qcReview',
      action: 'launch',
      userId: log.userId,
      detail: extractQCDetail(msg),
      category,
      createdAt: ts,
    };
  }

  // Homography launches
  if (msg.includes('Launched Homography task')) {
    const name = extractAnnotationSetName(msg);
    if (!name) return null;
    return {
      annotationSetName: name,
      workflow: 'homography',
      action: 'launch',
      userId: log.userId,
      createdAt: ts,
    };
  }

  // Cancellations - these apply to whatever was running on the project
  // "Cancelled queue job "..." for project "...""
  if (msg.includes('Cancelled queue job')) {
    const tag = msg.match(/Cancelled queue job "([^"]+)"/)?.[1] ?? '';
    // Try to determine which workflow was cancelled from the queue tag/name
    // Queue tags typically contain the workflow type
    let workflow: WorkflowType | null = null;
    const tagLower = tag.toLowerCase();
    if (tagLower.includes('model') || tagLower.includes('species') || tagLower.includes('tiled')) {
      workflow = 'modelGuided';
    } else if (tagLower.includes('false') || tagLower.includes('fn')) {
      workflow = 'falseNegatives';
    } else if (tagLower.includes('qc') || tagLower.includes('review')) {
      workflow = 'qcReview';
    } else if (tagLower.includes('homograph')) {
      workflow = 'homography';
    }

    if (workflow) {
      return {
        annotationSetName: '__cancel__',
        workflow,
        action: 'cancel',
        userId: log.userId,
        createdAt: ts,
      };
    }
  }

  return null;
}

const DEFAULT_WORKFLOW: WorkflowInfo = { state: 'not_done' };

/**
 * Given a list of admin action logs for a single project, derive the workflow
 * status for each annotation set.
 */
export function deriveWorkflowStatuses(
  logs: LogEntry[],
  annotationSetNames: string[]
): Record<string, AnnotationSetWorkflows> {
  const result: Record<string, AnnotationSetWorkflows> = {};

  // Initialize all annotation sets with default status
  for (const name of annotationSetNames) {
    result[name] = {
      modelGuided: [],
      falseNegatives: { ...DEFAULT_WORKFLOW },
      qcReview: [],
      homography: { ...DEFAULT_WORKFLOW },
    };
  }

  // Parse all log entries and sort by time
  const actions = logs
    .map(parseLogEntry)
    .filter((a): a is ParsedAction => a !== null)
    .sort((a, b) => a.createdAt - b.createdAt);

  // Track the last launch per workflow type so cancellations can be linked
  type LaunchInfo = { annotationSetName: string; userId: string; detail?: string; category?: string };
  const lastLaunch: Record<WorkflowType, LaunchInfo | null> = {
    modelGuided: null,
    falseNegatives: null,
    qcReview: null,
    homography: null,
  };

  // Accumulate multi-run workflows keyed by annotation set + distinguishing detail
  // MG: keyed by confidence range, QC: keyed by category
  const mgByKey = new Map<string, WorkflowInfo>();
  const qcByKey = new Map<string, WorkflowInfo>();

  for (const action of actions) {
    if (action.action === 'launch') {
      lastLaunch[action.workflow] = {
        annotationSetName: action.annotationSetName,
        userId: action.userId,
        detail: action.detail,
        category: action.category,
      };

      if (result[action.annotationSetName]) {
        if (action.workflow === 'modelGuided') {
          const key = `${action.annotationSetName}::${action.detail ?? ''}`;
          mgByKey.set(key, {
            state: 'incomplete',
            detail: action.detail,
            launchedBy: action.userId,
          });
        } else if (action.workflow === 'qcReview') {
          const key = `${action.annotationSetName}::${action.category ?? ''}`;
          qcByKey.set(key, {
            state: 'incomplete',
            detail: action.detail,
            launchedBy: action.userId,
          });
        } else {
          // Single-entry workflows
          result[action.annotationSetName][action.workflow] = {
            state: 'incomplete',
            detail: action.detail,
            launchedBy: action.userId,
          };
        }
      }
    } else if (action.action === 'cancel') {
      const launch = lastLaunch[action.workflow];
      if (launch && result[launch.annotationSetName]) {
        const isSurveyScope = action.userId === 'SurveyScope';
        const info: WorkflowInfo = {
          state: isSurveyScope ? 'done' : 'incomplete',
          detail: launch.detail,
          launchedBy: launch.userId,
          cancelledBy: action.userId,
        };

        if (action.workflow === 'modelGuided') {
          const key = `${launch.annotationSetName}::${launch.detail ?? ''}`;
          mgByKey.set(key, info);
        } else if (action.workflow === 'qcReview') {
          const key = `${launch.annotationSetName}::${launch.category ?? ''}`;
          qcByKey.set(key, info);
        } else {
          result[launch.annotationSetName][action.workflow] = info;
        }
        lastLaunch[action.workflow] = null;
      }
    }
  }

  // Collapse multi-run entries into the result arrays
  for (const [key, info] of mgByKey) {
    const [asName] = key.split('::');
    if (result[asName]) {
      result[asName].modelGuided.push(info);
    }
  }
  for (const [key, info] of qcByKey) {
    const [asName] = key.split('::');
    if (result[asName]) {
      result[asName].qcReview.push(info);
    }
  }

  return result;
}
