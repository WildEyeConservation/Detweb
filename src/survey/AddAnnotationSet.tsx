import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Form, Spinner } from 'react-bootstrap';
import { useQueryClient } from '@tanstack/react-query';
import { useRecordHotkeys } from 'react-hotkeys-hook';
import { GlobalContext, UserContext } from '../Context';
import {
  Page,
  PageHeader,
  ContentArea,
  Crumb,
  CrumbSep,
} from '../ss/PageShell';
import { logAdminAction } from '../utils/adminActionLogger';

type Project = {
  id: string;
  name: string;
  group?: string | null;
  organizationId: string;
  status?: string | null;
  queues?: { id: string }[];
  annotationSets?: { id: string; register?: boolean | null }[];
};

type Label = {
  id: string;
  name: string;
  shortcutKey: string;
  color: string;
};

type ImportSet = {
  projectId: string;
  projectName: string;
  setId: string;
  setName: string;
};

const PROJECT_SELECTION_SET = [
  'id',
  'name',
  'group',
  'organizationId',
  'status',
  'queues.id',
  'annotationSets.id',
  'annotationSets.register',
] as const;

const IMPORT_SELECTION_SET = [
  'id',
  'name',
  'organizationId',
  'annotationSets.id',
  'annotationSets.name',
] as const;

export default function AddAnnotationSet() {
  const { surveyId } = useParams<{ surveyId: string }>();
  const { client } = useContext(GlobalContext)!;
  const { user, myMembershipHook } = useContext(UserContext)!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [project, setProject] = useState<Project | null>(null);
  const [name, setName] = useState<string>('');
  const [labels, setLabels] = useState<Label[]>(() => [
    {
      id: crypto.randomUUID(),
      name: 'Unknown',
      shortcutKey: 'u',
      color: '#ff2643',
    },
  ]);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [keys, { start, stop, isRecording }] = useRecordHotkeys();
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const [importSets, setImportSets] = useState<ImportSet[]>([]);
  const [importLoading, setImportLoading] = useState<boolean>(false);
  const [importSearch, setImportSearch] = useState<string>('');
  const [importingSetId, setImportingSetId] = useState<string | null>(null);
  const [importedFrom, setImportedFrom] = useState<ImportSet | null>(null);
  const importSearchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!surveyId) return;
    let cancelled = false;
    (async () => {
      const { data } = await client.models.Project.get(
        { id: surveyId },
        { selectionSet: PROJECT_SELECTION_SET as unknown as string[] }
      );
      if (!cancelled) setProject(data as Project | null);
    })();
    return () => {
      cancelled = true;
    };
  }, [surveyId, client]);

  const adminProjectIds = useMemo(
    () =>
      (myMembershipHook.data ?? [])
        .filter((m: { isAdmin?: boolean | null }) => m.isAdmin)
        .map((m: { projectId: string }) => m.projectId),
    [myMembershipHook.data]
  );

  useEffect(() => {
    if (!project) return;
    if (adminProjectIds.length === 0) {
      setImportSets([]);
      return;
    }
    let cancelled = false;
    setImportLoading(true);
    (async () => {
      try {
        const results = await Promise.all(
          adminProjectIds.map((id) =>
            client.models.Project.get(
              { id },
              { selectionSet: IMPORT_SELECTION_SET as unknown as string[] }
            )
          )
        );
        if (cancelled) return;
        const flat: ImportSet[] = [];
        for (const res of results) {
          const p = res.data as
            | {
                id: string;
                name: string;
                organizationId: string;
                annotationSets?: { id: string; name: string }[];
              }
            | null;
          if (!p) continue;
          if (p.organizationId !== project.organizationId) continue;
          for (const s of p.annotationSets ?? []) {
            flat.push({
              projectId: p.id,
              projectName: p.name,
              setId: s.id,
              setName: s.name,
            });
          }
        }
        flat.sort(
          (a, b) =>
            a.projectName.localeCompare(b.projectName) ||
            a.setName.localeCompare(b.setName)
        );
        setImportSets(flat);
      } finally {
        if (!cancelled) setImportLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [project, adminProjectIds, client]);

  const filteredImportSets = useMemo(() => {
    const q = importSearch.trim().toLowerCase();
    if (!q) return importSets;
    return importSets.filter(
      (s) =>
        s.projectName.toLowerCase().includes(q) ||
        s.setName.toLowerCase().includes(q)
    );
  }, [importSets, importSearch]);

  async function handleImport(source: ImportSet) {
    setImportingSetId(source.setId);
    try {
      const { data: categories } =
        await client.models.Category.categoriesByAnnotationSetId({
          annotationSetId: source.setId,
        });
      const imported: Label[] = (categories ?? []).map((c) => ({
        id: crypto.randomUUID(),
        name: c.name,
        shortcutKey: c.shortcutKey ?? '',
        color: c.color ?? '#000000',
      }));
      if (imported.length === 0) {
        alert('That annotation set has no labels to import.');
        return;
      }
      setLabels(imported);
      setImportedFrom(source);
    } finally {
      setImportingSetId(null);
    }
  }

  const updateLabel = (id: string, patch: Partial<Label>) => {
    setLabels((prev) =>
      prev.map((l) => (l.id === id ? { ...l, ...patch } : l))
    );
  };

  const removeLabel = (id: string) => {
    setLabels((prev) => prev.filter((l) => l.id !== id));
  };

  const addLabel = () => {
    if (labels.some((l) => l.name === '' || l.shortcutKey === '')) {
      alert('Please complete the current label before adding another');
      return;
    }
    setLabels((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        name: '',
        shortcutKey: '',
        color: '#000000',
      },
    ]);
  };

  const handleShortcutBlur = (id: string) => {
    stop();
    const newShortcutKey = Array.from(keys).join('+');
    if (newShortcutKey === '') return;
    if (newShortcutKey === ' ' || newShortcutKey.toLowerCase() === 'space') {
      alert('Spacebar is reserved and cannot be used as a label shortcut.');
      return;
    }
    if (
      newShortcutKey === 'equal' ||
      newShortcutKey === 'shift+equal' ||
      newShortcutKey === 'add'
    ) {
      alert(
        '"+" and "=" are reserved for False Positive and cannot be used as a label shortcut.'
      );
      return;
    }
    if (labels.some((l) => l.id !== id && l.shortcutKey === newShortcutKey)) {
      alert('This shortcut key is already in use by another label.');
      return;
    }
    updateLabel(id, { shortcutKey: newShortcutKey });
  };

  async function handleSave() {
    if (!project || !surveyId) return;
    if (name.trim() === '') {
      setError('Name cannot be empty');
      return;
    }
    setError('');
    setIsSaving(true);
    try {
      setStatus('Creating annotation set...');
      await client.models.Project.update({
        id: project.id,
        status: 'updating',
      });
      await client.mutations.updateProjectMemberships({
        projectId: project.id,
      });

      const { data: annotationSet } = await client.models.AnnotationSet.create({
        name: name.trim(),
        projectId: project.id,
        group: project.organizationId,
      });

      if (!annotationSet) {
        throw new Error('Failed to create annotation set');
      }

      const filteredLabels = labels.filter(
        (l) => l.name !== '' && l.shortcutKey !== ''
      );

      if (filteredLabels.length > 0) {
        setStatus('Creating labels...');
        await Promise.all(
          filteredLabels.map((l) =>
            client.models.Category.create({
              projectId: project.id,
              name: l.name,
              shortcutKey: l.shortcutKey,
              color: l.color,
              annotationSetId: annotationSet.id,
              group: project.group || project.organizationId,
            })
          )
        );
      }

      setStatus('Refreshing project...');
      await Promise.all([
        client.models.Project.update({ id: project.id, status: 'active' }),
        client.mutations.updateProjectMemberships({ projectId: project.id }),
      ]);

      logAdminAction(
        client,
        user.userId,
        `Added annotation set "${annotationSet.name}" to project "${project.name}"`,
        project.id,
        project.organizationId
      );

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['Category'] }),
        queryClient.invalidateQueries({
          queryKey: ['annotation-set-categories', annotationSet.id],
        }),
      ]);

      navigate(`/surveys/${surveyId}/detail`);
    } catch (err) {
      console.error('Failed to create annotation set', err);
      setError(err instanceof Error ? err.message : 'Failed to create set');
    } finally {
      setIsSaving(false);
      setStatus('');
    }
  }

  const breadcrumb = (
    <>
      <Crumb onClick={() => navigate('/surveys')}>Surveys</Crumb>
      <CrumbSep />
      <Crumb onClick={() => navigate(`/surveys/${surveyId}/detail`)}>
        {project?.name || surveyId}
      </Crumb>
      <CrumbSep />
      <span>Add Annotation Set</span>
    </>
  );

  if (!project) {
    return (
      <Page>
        <PageHeader title='Add Annotation Set' breadcrumb={breadcrumb} />
        <ContentArea>
          <div style={{ color: 'var(--ss-text-dim)' }}>Loading…</div>
        </ContentArea>
      </Page>
    );
  }

  // "Active" requires status === 'active' AND no active jobs. The Surveys
  // page shows "Launched" as a derived status when queues/register are
  // present — that counts as not-active here.
  const projectHasActiveJob =
    (project.queues?.length ?? 0) > 0 ||
    (project.annotationSets ?? []).some((s) => s.register === true);
  const projectRawStatus = (project.status || '').toLowerCase();
  const projectIsActive =
    projectRawStatus === 'active' && !projectHasActiveJob;
  if (!projectIsActive) {
    const statusLabel =
      projectHasActiveJob && projectRawStatus === 'active'
        ? 'launched'
        : projectRawStatus || 'inactive';
    return (
      <Page>
        <PageHeader title='Add Annotation Set' breadcrumb={breadcrumb} />
        <ContentArea style={{ paddingTop: 16 }}>
          <Card>
            <Card.Body>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                Survey is {statusLabel}
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--ss-text-muted)',
                  marginBottom: 16,
                }}
              >
                Annotation sets can only be added while the survey is active.
              </div>
              <Button
                variant='primary'
                onClick={() => navigate(`/surveys/${surveyId}/detail`)}
              >
                Back to Survey
              </Button>
            </Card.Body>
          </Card>
        </ContentArea>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title='Add Annotation Set' breadcrumb={breadcrumb} />
      <ContentArea style={{ paddingTop: 16 }}>
        <div className='d-flex flex-column gap-3'>
          <Card>
            <Card.Header>
              <h5 className='mb-0'>Name</h5>
            </Card.Header>
            <Card.Body>
              <span
                className='text-muted d-block mb-2'
                style={{ fontSize: 12 }}
              >
                A descriptive name for your annotation set to help you identify
                it.
              </span>
              <Form.Control
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Enter a name'
              />
            </Card.Body>
          </Card>

          <Card>
            <Card.Header className='d-flex justify-content-between align-items-center flex-wrap gap-2'>
              <div>
                <h5 className='mb-0'>Import Labels</h5>
                <span
                  className='text-muted d-block'
                  style={{ fontSize: 12, marginTop: 2 }}
                >
                  Optional — reuse labels from another survey as a starting
                  point.
                </span>
              </div>
              {importedFrom && (
                <span
                  className='ss-status ss-status--active'
                  style={{ maxWidth: 320 }}
                  title={`${importedFrom.projectName} · ${importedFrom.setName}`}
                >
                  Imported from {importedFrom.projectName} ·{' '}
                  {importedFrom.setName}
                </span>
              )}
            </Card.Header>
            <Card.Body>
              <Form.Control
                ref={importSearchRef}
                type='search'
                size='sm'
                placeholder='Search surveys or annotation sets…'
                value={importSearch}
                onChange={(e) => setImportSearch(e.target.value)}
                disabled={importLoading}
              />
              <div
                style={{
                  marginTop: 8,
                  maxHeight: 140,
                  overflowY: 'auto',
                  border: '1px solid var(--ss-border)',
                  borderRadius: 4,
                  background: 'var(--ss-surface)',
                }}
              >
                {importLoading ? (
                  <div
                    className='d-flex align-items-center gap-2'
                    style={{
                      padding: 12,
                      fontSize: 12,
                      color: 'var(--ss-text-dim)',
                    }}
                  >
                    <Spinner size='sm' />
                    Loading available sets…
                  </div>
                ) : importSets.length === 0 ? (
                  <div
                    style={{
                      padding: 12,
                      fontSize: 12,
                      color: 'var(--ss-text-dim)',
                      fontStyle: 'italic',
                    }}
                  >
                    No annotation sets found in your other surveys.
                  </div>
                ) : filteredImportSets.length === 0 ? (
                  <div
                    style={{
                      padding: 12,
                      fontSize: 12,
                      color: 'var(--ss-text-dim)',
                      fontStyle: 'italic',
                    }}
                  >
                    No matches. Try a different search.
                  </div>
                ) : (
                  filteredImportSets.map((s, i) => {
                    const isImporting = importingSetId === s.setId;
                    const isCurrent =
                      importedFrom?.setId === s.setId &&
                      importedFrom?.projectId === s.projectId;
                    return (
                      <div
                        key={`${s.projectId}-${s.setId}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          padding: '8px 12px',
                          borderBottom:
                            i === filteredImportSets.length - 1
                              ? 'none'
                              : '1px solid var(--ss-border-soft)',
                          background: isCurrent
                            ? 'var(--ss-surface-alt)'
                            : 'transparent',
                        }}
                      >
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              fontSize: 13,
                              fontWeight: 600,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={s.setName}
                          >
                            {s.setName}
                          </div>
                          <div
                            style={{
                              fontSize: 11,
                              color: 'var(--ss-text-dim)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={s.projectName}
                          >
                            {s.projectName}
                          </div>
                        </div>
                        <Button
                          size='sm'
                          variant={isCurrent ? 'secondary' : 'primary'}
                          disabled={isImporting || importingSetId !== null}
                          onClick={() => handleImport(s)}
                        >
                          {isImporting
                            ? 'Importing…'
                            : isCurrent
                            ? 'Re-import'
                            : 'Import'}
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
              {importedFrom && (
                <div
                  className='d-flex align-items-center gap-2 mt-2'
                  style={{ fontSize: 12, color: 'var(--ss-text-dim)' }}
                >
                  <span>
                    Imported labels replace the current list. You can still
                    edit them below.
                  </span>
                  <Button
                    variant='link'
                    size='sm'
                    className='p-0'
                    onClick={() => {
                      setLabels([
                        {
                          id: crypto.randomUUID(),
                          name: 'Unknown',
                          shortcutKey: 'u',
                          color: '#ff2643',
                        },
                      ]);
                      setImportedFrom(null);
                    }}
                  >
                    Reset to default
                  </Button>
                </div>
              )}
            </Card.Body>
          </Card>

          <Card>
            <Card.Header className='d-flex justify-content-between align-items-center'>
              <h5 className='mb-0'>Labels</h5>
              <Button variant='primary' size='sm' onClick={addLabel}>
                + Add Label
              </Button>
            </Card.Header>
            <Card.Body className='p-0'>
              <div
                style={{
                  color: 'var(--ss-text-muted)',
                  fontSize: 12,
                  lineHeight: 1.4,
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--ss-border-soft)',
                }}
              >
                Set up the labels based on the species you expect to encounter.
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className='ss-data-table'>
                  <thead>
                    <tr>
                      <th style={{ width: '30%' }}>Name</th>
                      <th style={{ width: '25%' }}>Shortcut Key</th>
                      <th style={{ width: '20%' }}>Color</th>
                      <th style={{ width: '25%', textAlign: 'right' }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {labels.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          style={{
                            textAlign: 'center',
                            color: 'var(--ss-text-dim)',
                            padding: '24px',
                          }}
                        >
                          No labels yet.
                        </td>
                      </tr>
                    ) : (
                      labels.map((label) => (
                        <tr key={label.id}>
                          <td>
                            <Form.Control
                              type='text'
                              placeholder='Enter label name'
                              value={label.name}
                              onChange={(e) =>
                                updateLabel(label.id, { name: e.target.value })
                              }
                            />
                          </td>
                          <td>
                            <Form.Control
                              type='text'
                              placeholder='Record shortcut key'
                              value={
                                isRecording && activeRowId === label.id
                                  ? Array.from(keys).join('+')
                                  : label.shortcutKey
                              }
                              onFocus={start}
                              onBlur={() => handleShortcutBlur(label.id)}
                              onFocusCapture={() => setActiveRowId(label.id)}
                              onBlurCapture={() => {
                                if (activeRowId === label.id) {
                                  setActiveRowId(null);
                                }
                              }}
                              onChange={() => {}}
                            />
                          </td>
                          <td>
                            <Form.Control
                              type='color'
                              size='sm'
                              value={label.color}
                              title='Label color'
                              onChange={(e) =>
                                updateLabel(label.id, { color: e.target.value })
                              }
                            />
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <Button
                              variant='danger'
                              size='sm'
                              onClick={() => removeLabel(label.id)}
                            >
                              Remove
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card.Body>
          </Card>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Button variant='primary' disabled={isSaving} onClick={handleSave}>
              {isSaving ? (
                <span className='d-inline-flex align-items-center gap-2'>
                  <Spinner size='sm' />
                  Creating...
                </span>
              ) : (
                'Create'
              )}
            </Button>
            <Button
              variant='secondary'
              disabled={isSaving}
              onClick={() => navigate(`/surveys/${surveyId}/detail`)}
            >
              Cancel
            </Button>
            {error ? (
              <span className='text-danger' style={{ fontSize: 12 }}>
                {error}
              </span>
            ) : status ? (
              <span
                className='text-muted d-inline-flex align-items-center gap-2'
                style={{ fontSize: 12 }}
              >
                <Spinner size='sm' />
                {status}
              </span>
            ) : null}
          </div>
        </div>
      </ContentArea>
    </Page>
  );
}
