import { useState, useContext, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form } from 'react-bootstrap';
import { ChevronRight } from 'lucide-react';
import { TestingContext, GlobalContext } from '../Context';

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];
const ROWS_PER_PAGE_STORAGE_KEY = 'testingSurveysRowsPerPage';

type SortOption = 'name' | 'name-reverse';

export default function Surveys() {
  const {
    organizationProjects: surveys,
    organizationTestPresets: locationPools,
  } = useContext(TestingContext)!;
  const { client } = useContext(GlobalContext)!;
  const navigate = useNavigate();

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
  const [currentPage, setCurrentPage] = useState(1);

  const [sharedPoolCounts, setSharedPoolCounts] = useState<
    Record<string, number>
  >({});

  const getInitialRowsPerPage = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(ROWS_PER_PAGE_STORAGE_KEY);
      const parsed = stored ? parseInt(stored, 10) : NaN;
      if (ROWS_PER_PAGE_OPTIONS.includes(parsed)) return parsed;
    }
    return 10;
  };

  const [itemsPerPage, setItemsPerPage] = useState(getInitialRowsPerPage);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ROWS_PER_PAGE_STORAGE_KEY, String(itemsPerPage));
    }
  }, [itemsPerPage]);

  // Count how many pools are currently in play for each survey (its own + incoming shared)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (surveys.length === 0) return;
      const entries = await Promise.all(
        surveys
          .filter((s) => !s.hidden)
          .map(async (survey) => {
            const { data } =
              await client.models.TestPresetProject.testPresetsByProjectId({
                projectId: survey.id,
              });
            return [survey.id, (data ?? []).length] as const;
          })
      );
      if (!cancelled) {
        setSharedPoolCounts(Object.fromEntries(entries));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [surveys, client]);

  const visibleSurveys = useMemo(
    () => surveys.filter((s) => !s.hidden),
    [surveys]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return visibleSurveys;
    return visibleSurveys.filter((s) => s.name.toLowerCase().includes(q));
  }, [visibleSurveys, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    switch (sortBy) {
      case 'name':
        return copy.sort((a, b) => a.name.localeCompare(b.name));
      case 'name-reverse':
        return copy.sort((a, b) => b.name.localeCompare(a.name));
      default:
        return copy;
    }
  }, [filtered, sortBy]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / itemsPerPage));
  const pageClamped = Math.min(Math.max(1, currentPage), totalPages);
  const paged = sorted.slice(
    (pageClamped - 1) * itemsPerPage,
    pageClamped * itemsPerPage
  );

  function poolNameForSurvey(surveyName: string): string | undefined {
    return locationPools.find((p) => p.name === surveyName)?.name;
  }

  return (
    <Card>
      <Card.Header>
        <h5 className='mb-0'>Surveys</h5>
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
          Open a survey to manage its location pool, add or remove testing
          locations, configure test rules, and share its pool with other
          surveys.
        </div>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
            padding: '12px 16px',
            borderBottom: '1px solid var(--ss-border-soft)',
          }}
        >
          <Form.Control
            type='text'
            placeholder='Search surveys…'
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
            style={{ minWidth: 0, maxWidth: '260px', flex: '0 1 auto' }}
          />
          <Form.Select
            value={sortBy}
            onChange={(e) => {
              setSortBy(e.target.value as SortOption);
              setCurrentPage(1);
            }}
            style={{ minWidth: 0, maxWidth: '200px', flex: '0 1 auto' }}
          >
            <option value='name'>Name (A-Z)</option>
            <option value='name-reverse'>Name (Z-A)</option>
          </Form.Select>
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: 'var(--ss-text-dim)',
            }}
          >
            <span>Rows</span>
            <Form.Select
              size='sm'
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(parseInt(e.target.value, 10));
                setCurrentPage(1);
              }}
              style={{ width: 'auto', padding: '2px 24px 2px 8px' }}
            >
              {ROWS_PER_PAGE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Form.Select>
            <span>
              Page {pageClamped} of {totalPages}
            </span>
            <Button
              size='sm'
              variant='secondary'
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={pageClamped === 1}
              style={{ padding: '2px 10px' }}
            >
              ‹
            </Button>
            <Button
              size='sm'
              variant='secondary'
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={pageClamped === totalPages}
              style={{ padding: '2px 10px' }}
            >
              ›
            </Button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className='ss-data-table'>
            <thead>
              <tr>
                <th style={{ width: '40%' }}>Name</th>
                <th>Pool</th>
                <th style={{ width: 140, textAlign: 'right' }}>
                  Pools in use
                </th>
                <th style={{ width: 140 }}></th>
              </tr>
            </thead>
            <tbody>
              {paged.map((survey) => {
                const poolName = poolNameForSurvey(survey.name);
                const count = sharedPoolCounts[survey.id];
                return (
                  <tr key={survey.id}>
                    <td>{survey.name}</td>
                    <td style={{ color: 'var(--ss-text-muted)' }}>
                      {poolName ?? '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {count == null ? '…' : count}
                    </td>
                    <td>
                      <Button
                        variant='primary'
                        size='sm'
                        className='d-flex align-items-center gap-1'
                        onClick={() =>
                          navigate(`/testing/surveys/${survey.id}`)
                        }
                      >
                        Manage <ChevronRight size={14} />
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {paged.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      textAlign: 'center',
                      color: 'var(--ss-text-dim)',
                      padding: '24px',
                    }}
                  >
                    No surveys found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card.Body>
    </Card>
  );
}
