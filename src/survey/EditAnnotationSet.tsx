import { useContext, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, Card, Form, Spinner } from 'react-bootstrap';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRecordHotkeys } from 'react-hotkeys-hook';
import { GlobalContext } from '../Context';
import {
  Page,
  PageHeader,
  ContentArea,
  Crumb,
  CrumbSep,
} from '../ss/PageShell';

type Project = {
  id: string;
  name: string;
  group?: string | null;
  organizationId: string;
};

type Label = {
  id: string;
  name: string;
  shortcutKey: string;
  color: string;
};

const PROJECT_SELECTION_SET = [
  'id',
  'name',
  'group',
  'organizationId',
] as const;

export default function EditAnnotationSet() {
  const { surveyId, annotationSetId } = useParams<{
    surveyId: string;
    annotationSetId: string;
  }>();
  const { client } = useContext(GlobalContext)!;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [project, setProject] = useState<Project | null>(null);
  const [originalName, setOriginalName] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [labels, setLabels] = useState<Label[]>([]);
  const [originalLabels, setOriginalLabels] = useState<Label[]>([]);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [keys, { start, stop, isRecording }] = useRecordHotkeys();
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  useEffect(() => {
    if (!surveyId || !annotationSetId) return;
    let cancelled = false;
    (async () => {
      const [projRes, setRes] = await Promise.all([
        client.models.Project.get(
          { id: surveyId },
          { selectionSet: PROJECT_SELECTION_SET as unknown as string[] }
        ),
        client.models.AnnotationSet.get({ id: annotationSetId }),
      ]);
      if (cancelled) return;
      setProject(projRes.data as Project | null);
      const set = setRes.data;
      if (set) {
        setOriginalName(set.name);
        setName(set.name);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [surveyId, annotationSetId, client]);

  const { data: fetchedCategories, isFetching: categoriesLoading } = useQuery({
    queryKey: ['annotation-set-categories', annotationSetId],
    enabled: !!annotationSetId,
    staleTime: 0,
    queryFn: async () => {
      const { data } = await client.models.Category.categoriesByAnnotationSetId(
        { annotationSetId: annotationSetId! }
      );
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!fetchedCategories) return;
    const mapped: Label[] = fetchedCategories.map((c) => ({
      id: c.id,
      name: c.name,
      shortcutKey: c.shortcutKey ?? '',
      color: c.color ?? '#000000',
    }));
    setLabels(mapped);
    setOriginalLabels(mapped);
  }, [fetchedCategories]);

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
    if (
      labels.some((l) => l.id !== id && l.shortcutKey === newShortcutKey)
    ) {
      alert('This shortcut key is already in use by another label.');
      return;
    }
    updateLabel(id, { shortcutKey: newShortcutKey });
  };

  async function handleSave() {
    if (!project || !annotationSetId) return;
    if (name.trim() === '') {
      setError('Name cannot be empty');
      return;
    }
    setError('');
    setIsSaving(true);
    try {
      if (name !== originalName) {
        setStatus('Updating annotation set...');
        await client.models.AnnotationSet.update({
          id: annotationSetId,
          name,
        });
      }

      const filteredLabels = labels.filter(
        (l) => l.name !== '' && l.shortcutKey !== ''
      );
      const filteredIds = new Set(filteredLabels.map((l) => l.id));
      const originalIds = new Set(originalLabels.map((l) => l.id));

      setStatus('Updating labels...');
      await Promise.all([
        ...originalLabels
          .filter((l) => !filteredIds.has(l.id))
          .map((l) => client.models.Category.delete({ id: l.id })),
        ...filteredLabels
          .filter((l) => !originalIds.has(l.id))
          .map((l) =>
            client.models.Category.create({
              projectId: project.id,
              name: l.name,
              shortcutKey: l.shortcutKey,
              color: l.color,
              annotationSetId,
              group: project.group || project.organizationId,
            })
          ),
        ...filteredLabels
          .filter((l) => originalIds.has(l.id))
          .map((l) =>
            client.models.Category.update({
              id: l.id,
              name: l.name,
              shortcutKey: l.shortcutKey,
              color: l.color,
            })
          ),
      ]);

      setStatus('Refreshing project...');
      await Promise.all([
        client.models.Project.update({ id: project.id, status: 'active' }),
        client.mutations.updateProjectMemberships({ projectId: project.id }),
      ]);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['Category'] }),
        queryClient.invalidateQueries({
          queryKey: ['annotation-set-categories', annotationSetId],
        }),
      ]);

      navigate(`/surveys/${surveyId}/detail`);
    } catch (err) {
      console.error('Failed to save annotation set edits', err);
      setError(err instanceof Error ? err.message : 'Failed to save changes');
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
      <span>{originalName || annotationSetId}</span>
      <CrumbSep />
      <span>Edit</span>
    </>
  );

  if (!project) {
    return (
      <Page>
        <PageHeader title='Edit Annotation Set' breadcrumb={breadcrumb} />
        <ContentArea>
          <div style={{ color: 'var(--ss-text-dim)' }}>Loading…</div>
        </ContentArea>
      </Page>
    );
  }

  return (
    <Page>
      <PageHeader title='Edit Annotation Set' breadcrumb={breadcrumb} />
      <ContentArea style={{ paddingTop: 16 }}>
        <div className='d-flex flex-column gap-3'>
          <Card>
            <Card.Header>
              <h5 className='mb-0'>Name</h5>
            </Card.Header>
            <Card.Body>
              <Form.Control
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='Enter new name'
              />
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
                    {categoriesLoading && labels.length === 0 ? (
                      <tr>
                        <td
                          colSpan={4}
                          style={{
                            textAlign: 'center',
                            color: 'var(--ss-text-dim)',
                            padding: '24px',
                          }}
                        >
                          <span className='d-inline-flex align-items-center gap-2'>
                            <Spinner size='sm' />
                            Loading labels...
                          </span>
                        </td>
                      </tr>
                    ) : labels.length === 0 ? (
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
                  Saving...
                </span>
              ) : (
                'Save Changes'
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
