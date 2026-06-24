import { useCallback, useEffect, useMemo, useState } from 'react';
import { Badge, Button, Card, Form, Spinner } from 'react-bootstrap';
import { ExternalLink } from 'lucide-react';
import Select, { type MultiValue, type SingleValue } from 'react-select';
import { useUsers } from '../../apiInterface';
import { useSharedChainData } from '../shared/useSharedChainData';
import { useActiveShares, ownerToUserId } from './useActiveShares';
import {
  foldFeedbackRows,
  useAllChainReviewFeedback,
} from './useAllChainReviewFeedback';
import { divergesCategory, divergesObscured } from './shareStats';
import { AnnotationCrop } from './AnnotationCrop';

type Option = { label: string; value: string };

const MAX_ROWS = 500;

interface Divergence {
  owner: string;
  ownerLabel: string;
  relabel?: { from: string; to: string };
  obscured?: { from: boolean; to: boolean };
  comment?: string;
}

/**
 * Disagreement Explorer: lists snapshot annotations where one or more selected
 * reviewers diverge from the baseline (relabel / obscured) or left a comment.
 * Each row shows a crop, the baseline label, the per-reviewer change, and a
 * deep-link into the shared chain viewer focused on that chain.
 */
export default function DisagreementExplorer() {
  const { users } = useUsers();
  const { data: shares, isLoading: sharesLoading } = useActiveShares();

  const [shareId, setShareId] = useState<string | undefined>(undefined);
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [kinds, setKinds] = useState({ relabel: true, obscured: true, comment: true });
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const { data: chainData, isLoading: chainLoading } = useSharedChainData(shareId);
  const { data: feedbackRows, isLoading: feedbackLoading } =
    useAllChainReviewFeedback(shareId);
  const feedback = useMemo(
    () => foldFeedbackRows(feedbackRows ?? []),
    [feedbackRows]
  );

  const userNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of users) m.set(u.id, u.name ?? u.email ?? u.id);
    return m;
  }, [users]);
  const ownerLabel = useCallback(
    (owner: string) =>
      userNameById.get(ownerToUserId(owner)) ?? ownerToUserId(owner),
    [userNameById]
  );

  const shareOptions: Option[] = (shares ?? []).map((s) => ({
    value: s.shareId,
    label: `${s.surveyName ?? '—'} — ${s.annotationSetName ?? s.annotationSetId}`,
  }));
  const ownerOptions: Option[] = (feedback?.owners ?? []).map((o) => ({
    value: o,
    label: ownerLabel(o),
  }));

  useEffect(() => {
    setSelectedOwners(feedback?.owners ?? []);
  }, [feedback?.owners]);

  const annotations = useMemo(() => chainData?.annotations ?? [], [chainData]);
  const categories = useMemo(() => chainData?.categories ?? [], [chainData]);
  const catNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of categories) m.set(c.id, c.name);
    return m;
  }, [categories]);
  const catColorById = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const c of categories) m.set(c.id, c.color);
    return m;
  }, [categories]);
  const categoryOptions: Option[] = [
    { value: 'all', label: 'All labels' },
    ...categories.map((c) => ({ value: c.id, label: c.name })),
  ];

  // (owner, annotationId) -> comment text
  const commentByOwnerAnn = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of feedbackRows ?? []) {
      if (r.kind === 'comment' && r.comment) {
        m.set(`${r.owner}#${r.sharedAnnotationId}`, r.comment);
      }
    }
    return m;
  }, [feedbackRows]);

  const rows = useMemo(() => {
    if (!chainData) return [];
    const out: Array<{
      annId: string;
      x: number;
      y: number;
      oov: boolean;
      baselineCategoryId: string;
      baselineObscured: boolean;
      chainId: string;
      divergences: Divergence[];
    }> = [];

    for (const ann of annotations) {
      if (categoryFilter !== 'all' && ann.categoryId !== categoryFilter) continue;
      const divergences: Divergence[] = [];
      for (const owner of selectedOwners) {
        const overlay = feedback.overlayByOwner.get(owner);
        if (!overlay) continue;
        const div: Divergence = { owner, ownerLabel: ownerLabel(owner) };
        if (kinds.relabel && divergesCategory(ann, overlay)) {
          const to = overlay.category.get(ann.id)!;
          div.relabel = {
            from: catNameById.get(ann.categoryId) ?? ann.categoryId,
            to: catNameById.get(to) ?? to,
          };
        }
        if (kinds.obscured && divergesObscured(ann, overlay)) {
          div.obscured = {
            from: ann.obscured,
            to: overlay.obscured.get(ann.id)!,
          };
        }
        if (kinds.comment) {
          const c = commentByOwnerAnn.get(`${owner}#${ann.id}`);
          if (c) div.comment = c;
        }
        if (div.relabel || div.obscured || div.comment) divergences.push(div);
      }
      if (divergences.length > 0) {
        out.push({
          annId: ann.id,
          x: ann.x,
          y: ann.y,
          oov: ann.oov,
          baselineCategoryId: ann.categoryId,
          baselineObscured: ann.obscured,
          chainId:
            feedback.chainIdByAnnotation.get(ann.id) ?? ann.objectId ?? ann.id,
          divergences,
        });
      }
    }
    return out;
  }, [
    chainData,
    feedback,
    annotations,
    selectedOwners,
    kinds,
    categoryFilter,
    catNameById,
    commentByOwnerAnn,
    ownerLabel,
  ]);

  const busy = chainLoading || feedbackLoading;
  const shown = rows.slice(0, MAX_ROWS);

  return (
    <div style={{ width: '100%' }}>
      <Card className='mb-3'>
        <Card.Header>
          <h4 className='mb-0'>Disagreement Explorer</h4>
        </Card.Header>
        <Card.Body>
          <div className='d-flex flex-row flex-wrap gap-3 align-items-end'>
            <Form.Group style={{ minWidth: 280, flex: 1 }}>
              <Form.Label>Share</Form.Label>
              <Select
                value={shareOptions.find((o) => o.value === shareId) ?? null}
                onChange={(v: SingleValue<Option>) => setShareId(v?.value)}
                options={shareOptions}
                className='text-black'
                placeholder={sharesLoading ? 'Loading shares…' : 'Select a share…'}
                isLoading={sharesLoading}
                isClearable
              />
            </Form.Group>
            <Form.Group style={{ minWidth: 280, flex: 1 }}>
              <Form.Label>Reviewers</Form.Label>
              <Select
                isMulti
                value={ownerOptions.filter((o) => selectedOwners.includes(o.value))}
                onChange={(v: MultiValue<Option>) =>
                  setSelectedOwners(v.map((o) => o.value))
                }
                options={ownerOptions}
                className='text-black'
                placeholder='All reviewers'
                isDisabled={!shareId || ownerOptions.length === 0}
              />
            </Form.Group>
            <Form.Group style={{ minWidth: 180 }}>
              <Form.Label>Label</Form.Label>
              <Select
                value={categoryOptions.find((o) => o.value === categoryFilter) ?? null}
                onChange={(v: SingleValue<Option>) =>
                  setCategoryFilter(v?.value ?? 'all')
                }
                options={categoryOptions}
                className='text-black'
                isDisabled={!shareId}
              />
            </Form.Group>
          </div>
          <div className='d-flex flex-row gap-3 mt-2'>
            {(['relabel', 'obscured', 'comment'] as const).map((k) => (
              <Form.Check
                key={k}
                type='checkbox'
                id={`kind-${k}`}
                label={k}
                checked={kinds[k]}
                onChange={(e) =>
                  setKinds((prev) => ({ ...prev, [k]: e.target.checked }))
                }
              />
            ))}
          </div>
        </Card.Body>
      </Card>

      {!shareId ? (
        <p className='text-muted'>Select a share to explore disagreements.</p>
      ) : busy ? (
        <Spinner animation='border' />
      ) : rows.length === 0 ? (
        <p className='text-muted'>
          No disagreements match the current filters.
        </p>
      ) : (
        <>
          <p className='text-muted'>
            {rows.length} annotation{rows.length === 1 ? '' : 's'} with divergences
            {rows.length > MAX_ROWS && ` (showing first ${MAX_ROWS})`}.
          </p>
          <div className='d-flex flex-column gap-2'>
            {shown.map((row) => (
              <Card key={row.annId}>
                <Card.Body className='d-flex flex-row gap-3'>
                  <AnnotationCrop
                    meta={chainData?.metaByAnnotationId[row.annId]}
                    x={row.x}
                    y={row.y}
                    oov={row.oov}
                    markerColor={catColorById.get(row.baselineCategoryId) ?? '#facc15'}
                  />
                  <div className='flex-grow-1'>
                    <div className='d-flex flex-row align-items-center gap-2 mb-2'>
                      <span>
                        Baseline:{' '}
                        <Badge
                          style={{
                            background:
                              catColorById.get(row.baselineCategoryId) ?? '#888',
                          }}
                        >
                          {catNameById.get(row.baselineCategoryId) ??
                            row.baselineCategoryId}
                        </Badge>
                      </span>
                      {row.oov ? (
                        <Badge bg='secondary'>OOV</Badge>
                      ) : row.baselineObscured ? (
                        <Badge bg='dark'>Obscured</Badge>
                      ) : (
                        <Badge bg='light' text='dark'>
                          Visible
                        </Badge>
                      )}
                      <a
                        href={`/shared-chains/${shareId}?chain=${row.chainId}`}
                        target='_blank'
                        rel='noopener noreferrer'
                        className='ms-auto'
                      >
                        <Button size='sm' variant='outline-light'>
                          <ExternalLink size={14} className='me-1' />
                          Open in viewer
                        </Button>
                      </a>
                    </div>
                    <div className='d-flex flex-column gap-1'>
                      {row.divergences.map((d) => (
                        <div key={d.owner} className='small'>
                          <strong>{d.ownerLabel}</strong>
                          {d.relabel && (
                            <span className='ms-2'>
                              relabel: {d.relabel.from} →{' '}
                              <span className='text-warning'>{d.relabel.to}</span>
                            </span>
                          )}
                          {d.obscured && (
                            <span className='ms-2'>
                              obscured: {d.obscured.from ? 'yes' : 'no'} →{' '}
                              <span className='text-warning'>
                                {d.obscured.to ? 'yes' : 'no'}
                              </span>
                            </span>
                          )}
                          {d.comment && (
                            <span className='ms-2 fst-italic'>“{d.comment}”</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </Card.Body>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
