import { Button, Card, Form } from 'react-bootstrap';
import { useContext, useEffect, useMemo, useState } from 'react';
import { GlobalContext, TestingContext } from '../Context';
import { fetchAllPaginatedResults } from '../utils';
import { BarChart } from '@mui/x-charts/BarChart';
import exportFromJSON from 'export-from-json';
import { useUpdateProgress } from '../useUpdateProgress';
import { Schema } from '../amplify/client-schema';
import { useUsers } from '../apiInterface';
import Select from 'react-select';

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];
const ROWS_PER_PAGE_STORAGE_KEY = 'testingResultsRowsPerPage';

type SortColumn = 'date' | 'pool' | 'testAnimals' | 'missed' | 'overcounted' | 'pass';
type SortDir = 'asc' | 'desc';

export default function Results() {
  const { client } = useContext(GlobalContext)!;
  const { organizationMembershipsHook, organizationProjects } =
    useContext(TestingContext)!;
  const { users: allUsers } = useUsers();
  const [results, setResults] = useState<Schema['TestResult']['type'][]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPurging, setIsPurging] = useState(false);
  const [rules, setRules] = useState<{
    accuracyPercent: number;
    ignoreOvercounts: boolean;
  }>({ accuracyPercent: 90, ignoreOvercounts: false });
  const [selectedProject, setSelectedProject] = useState<{
    label: string;
    value: string;
  } | null>(null);
  const [selectedUser, setSelectedUser] = useState<{
    label: string;
    value: string;
  } | null>(null);

  const [sortCol, setSortCol] = useState<SortColumn>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [currentPage, setCurrentPage] = useState(1);

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

  const [setCompilingFiles, setTotalFilesCompiled] = useUpdateProgress({
    taskId: `Compiling files`,
    indeterminateTaskName: `Compiling files`,
    determinateTaskName: 'Compiling files',
    stepFormatter: (count) => `${count} files`,
  });

  useEffect(() => {
    async function setup() {
      setIsLoading(true);

      const fetched = await fetchAllPaginatedResults(
        client.models.TestResult.testResultsByUserId,
        {
          userId: selectedUser!.value,
          selectionSet: [
            'id',
            'testPreset.name',
            'testAnimals',
            'projectId',
            'totalMissedAnimals',
            'createdAt',
            'categoryCounts.categoryName',
            'categoryCounts.userCount',
            'categoryCounts.testCount',
            'annotationSetId',
            'locationId',
          ],
        }
      );

      setResults(
        fetched
          .filter((result) => result.projectId === selectedProject?.value)
          .sort(
            (a, b) =>
              new Date(b.createdAt!).getTime() -
              new Date(a.createdAt!).getTime()
          )
      );

      setIsLoading(false);
    }
    if (!isPurging && selectedUser) setup();
  }, [isPurging, selectedUser, selectedProject?.value, client]);

  function passedForResult(result: Schema['TestResult']['type']) {
    const total = result.testAnimals;
    const missed = result.totalMissedAnimals;
    let userCount = total - missed;
    if (rules.ignoreOvercounts && userCount > total) {
      userCount = total;
    }
    const accuracy = rules.accuracyPercent / 100;
    return userCount >= total * accuracy && userCount <= total * (2 - accuracy);
  }

  const tableRows = useMemo(() => {
    return results.map((result) => {
      const createdAt = result.createdAt ?? new Date().toISOString();
      const date = new Date(createdAt);
      const pool = result.testPreset.name;
      let surveyId = selectedProject?.value;

      if (pool !== selectedProject?.label) {
        const project = organizationProjects.find((p) => p.name === pool);
        if (project) surveyId = project.id;
      }

      const missedAnimals =
        result.totalMissedAnimals > 0 ? result.totalMissedAnimals : 0;
      const overcountedAnimals =
        result.totalMissedAnimals < 0
          ? Math.abs(result.totalMissedAnimals)
          : 0;

      return {
        id: result.id,
        date,
        dateLabel: `${date
          .toISOString()
          .split('T')[0]
          .replace(/-/g, '/')} - ${date.toLocaleTimeString()}`,
        pool,
        testAnimals: result.testAnimals,
        missedAnimals,
        overcountedAnimals,
        passed: passedForResult(result),
        linkHref: `/surveys/${surveyId}/location/${result.locationId}/${result.annotationSetId}`,
      };
    });
  }, [results, selectedProject, organizationProjects, rules]);

  const sortedRows = useMemo(() => {
    const copy = [...tableRows];
    const mult = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      switch (sortCol) {
        case 'date':
          return (a.date.getTime() - b.date.getTime()) * mult;
        case 'pool':
          return a.pool.localeCompare(b.pool) * mult;
        case 'testAnimals':
          return (a.testAnimals - b.testAnimals) * mult;
        case 'missed':
          return (a.missedAnimals - b.missedAnimals) * mult;
        case 'overcounted':
          return (a.overcountedAnimals - b.overcountedAnimals) * mult;
        case 'pass':
          return ((a.passed ? 1 : 0) - (b.passed ? 1 : 0)) * mult;
        default:
          return 0;
      }
    });
    return copy;
  }, [tableRows, sortCol, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / itemsPerPage));
  const pageClamped = Math.min(Math.max(1, currentPage), totalPages);
  const pagedRows = sortedRows.slice(
    (pageClamped - 1) * itemsPerPage,
    pageClamped * itemsPerPage
  );

  function toggleSort(col: SortColumn) {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir(col === 'date' ? 'desc' : 'asc');
    }
    setCurrentPage(1);
  }

  const passed = results.filter((result) => passedForResult(result)).length;
  const failed = results.length - passed;
  const totalAnimals = results.reduce(
    (acc, result) => acc + result.testAnimals,
    0
  );
  const undercountedAnimals = results.reduce(
    (acc, result) =>
      acc + (result.totalMissedAnimals > 0 ? result.totalMissedAnimals : 0),
    0
  );
  const overcountedAnimals = results.reduce(
    (acc, result) =>
      acc +
      (result.totalMissedAnimals < 0 ? Math.abs(result.totalMissedAnimals) : 0),
    0
  );

  const countsByCategory = results
    .flatMap((result) => result.categoryCounts)
    .reduce(
      (
        acc: Record<
          string,
          { userCount: number; testCount: number; name: string }
        >,
        category
      ) => {
        const key = category.categoryName.toLowerCase();
        if (!acc[key]) {
          acc[key] = { userCount: 0, testCount: 0, name: key };
        }
        acc[key].userCount += category.userCount;
        acc[key].testCount += category.testCount;
        return acc;
      },
      {} as Record<
        string,
        { userCount: number; testCount: number; name: string }
      >
    );

  const accuracyByCategory = Object.entries(countsByCategory)
    .map(([categoryId, counts]) => {
      if (counts.testCount === 0) return null;
      const accuracy = counts.userCount / counts.testCount;
      let countPercentage =
        accuracy > 1
          ? parseFloat(((accuracy - 1) * 100).toFixed(2))
          : parseFloat(((1 - accuracy) * 100).toFixed(2)) * -1;
      if (Object.is(countPercentage, -0)) countPercentage = 0;
      return {
        categoryId,
        name: counts.name,
        countPercentage: countPercentage / 100,
      };
    })
    .filter(
      (entry): entry is { categoryId: string; name: string; countPercentage: number } =>
        entry !== null
    )
    .sort((a, b) => a.name.localeCompare(b.name));

  function exportResults() {
    setCompilingFiles(0);
    setTotalFilesCompiled(2);

    exportFromJSON({
      data: results.map((result) => ({
        date: result.createdAt,
        preset: result.testPreset.name,
        testAnimals: result.testAnimals,
        missedAnimals: result.totalMissedAnimals,
        passed: passedForResult(result),
      })),
      fileName: `${selectedUser?.label}-test-results`,
      exportType: 'csv',
    });

    setCompilingFiles(1);

    exportFromJSON({
      data: accuracyByCategory.map((category) => ({
        label: category.name,
        overUnderPercentage: category.countPercentage.toFixed(4),
      })),
      fileName: `${selectedUser?.label}-label-accuracy`,
      exportType: 'csv',
    });

    setCompilingFiles(2);
  }

  async function purgeResults() {
    if (!confirm('Are you sure you want to purge all results for this user?')) {
      return;
    }

    setIsPurging(true);

    const fetched = await fetchAllPaginatedResults(
      client.models.TestResult.testResultsByUserId,
      {
        userId: selectedUser!.value,
        selectionSet: ['id', 'projectId', 'categoryCounts.categoryName'],
      }
    );

    const filteredResults = fetched.filter(
      (result) => result.projectId === selectedProject?.value
    );

    const deletePromises = filteredResults.flatMap((result) => [
      client.models.TestResult.delete({ id: result.id }),
      ...result.categoryCounts.map(
        (category: Schema['TestResultCategoryCount']['type']) =>
          client.models.TestResultCategoryCount.delete({
            testResultId: result.id,
            categoryName: category.categoryName,
          })
      ),
    ]);

    await Promise.all(deletePromises);

    setIsPurging(false);
  }

  const hasData = results.length > 0;
  const canShowResults = selectedProject && selectedUser;

  return (
    <div className='d-flex flex-column gap-3'>
      <Card>
        <Card.Header>
          <h5 className='mb-0'>Filters</h5>
        </Card.Header>
        <Card.Body className='d-flex flex-column gap-3'>
          <div>
            <Form.Label className='mb-2'>Select Survey</Form.Label>
            <Select
              className='text-black'
              value={selectedProject}
              options={organizationProjects
                .filter((p) => !p.hidden)
                .map((p) => ({ label: p.name, value: p.id }))}
              onChange={(e) => {
                setSelectedProject(e);
                setSelectedUser(null);
                setResults([]);
                setCurrentPage(1);
              }}
              menuPortalTarget={
                typeof document !== 'undefined' ? document.body : undefined
              }
              menuPosition='fixed'
              styles={{
                valueContainer: (base) => ({ ...base, overflowY: 'auto' }),
                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
              }}
            />
          </div>
          <div>
            <Form.Label className='mb-2'>Select User</Form.Label>
            <Select
              className='text-black'
              value={selectedUser}
              isDisabled={!selectedProject}
              options={organizationMembershipsHook.data?.map((m) => ({
                label: allUsers.find((user) => user.id === m.userId)?.name || '',
                value: m.userId,
              }))}
              onChange={(e) => {
                setSelectedUser(e);
                setCurrentPage(1);
              }}
              menuPortalTarget={
                typeof document !== 'undefined' ? document.body : undefined
              }
              menuPosition='fixed'
              styles={{
                valueContainer: (base) => ({ ...base, overflowY: 'auto' }),
                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
              }}
            />
          </div>
        </Card.Body>
      </Card>

      {canShowResults && (
        <Card>
          <Card.Header>
            <h5 className='mb-0'>Pass Rules</h5>
          </Card.Header>
          <Card.Body className='d-flex flex-column gap-2'>
            <div>
              <Form.Label className='mb-1'>Pass rate (%)</Form.Label>
              <Form.Control
                type='number'
                min={1}
                max={100}
                className='text-black'
                value={rules.accuracyPercent}
                onChange={(e) =>
                  setRules({
                    ...rules,
                    accuracyPercent: parseInt(e.target.value || '0'),
                  })
                }
                style={{ width: 160 }}
              />
            </div>
            <Form.Check
              type='checkbox'
              id='ignore-overcounts'
              label='Ignore overcounts'
              checked={rules.ignoreOvercounts}
              onChange={(e) =>
                setRules({ ...rules, ignoreOvercounts: e.target.checked })
              }
            />
          </Card.Body>
        </Card>
      )}

      {canShowResults && hasData && (
        <Card>
          <Card.Header>
            <h5 className='mb-0'>Summary</h5>
          </Card.Header>
          <Card.Body>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                gap: 12,
              }}
            >
              <StatTile
                label='Counts'
                rows={[
                  `Undercounted animals: ${undercountedAnimals}`,
                  `Overcounted animals: ${overcountedAnimals}`,
                ]}
              />
              <StatTile
                label='Rates'
                rows={[
                  `Undercounted rate: ${(
                    (undercountedAnimals / totalAnimals) *
                    100
                  ).toFixed(2)}%`,
                  `Overcounted rate: ${(
                    (overcountedAnimals / totalAnimals) *
                    100
                  ).toFixed(2)}%`,
                ]}
              />
              <StatTile
                label='Tests'
                rows={[
                  `Test success rate: ${(
                    (passed / results.length) *
                    100
                  ).toFixed(2)}%`,
                  `Passed / Failed: ${passed} - ${failed}`,
                ]}
              />
            </div>
          </Card.Body>
        </Card>
      )}

      {canShowResults && (
        <div className='d-flex flex-column gap-3'>
          <h5 className='mb-0'>All Results</h5>
            {!hasData ? (
              <div
                style={{
                  padding: '24px',
                  textAlign: 'center',
                  color: 'var(--ss-text-dim)',
                }}
              >
                {isLoading ? 'Loading…' : 'No test results'}
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 8,
                    alignItems: 'center',
                  }}
                >
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
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={pageClamped === totalPages}
                      style={{ padding: '2px 10px' }}
                    >
                      ›
                    </Button>
                  </div>
                </div>
                <div className='ss-card' style={{ padding: 0, overflow: 'hidden' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table className='ss-data-table'>
                    <thead>
                      <tr>
                        <SortableTh
                          label='Date'
                          col='date'
                          sortCol={sortCol}
                          sortDir={sortDir}
                          onClick={toggleSort}
                        />
                        <SortableTh
                          label='Pool'
                          col='pool'
                          sortCol={sortCol}
                          sortDir={sortDir}
                          onClick={toggleSort}
                        />
                        <SortableTh
                          label='Test Animals'
                          col='testAnimals'
                          sortCol={sortCol}
                          sortDir={sortDir}
                          onClick={toggleSort}
                        />
                        <SortableTh
                          label='Missed Animals'
                          col='missed'
                          sortCol={sortCol}
                          sortDir={sortDir}
                          onClick={toggleSort}
                        />
                        <SortableTh
                          label='Overcounted Animals'
                          col='overcounted'
                          sortCol={sortCol}
                          sortDir={sortDir}
                          onClick={toggleSort}
                        />
                        <SortableTh
                          label='Pass (current rules)'
                          col='pass'
                          sortCol={sortCol}
                          sortDir={sortDir}
                          onClick={toggleSort}
                        />
                        <th>Permalink</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.map((row) => (
                        <tr key={row.id}>
                          <td>{row.dateLabel}</td>
                          <td>{row.pool}</td>
                          <td>{row.testAnimals}</td>
                          <td>{row.missedAnimals}</td>
                          <td>{row.overcountedAnimals}</td>
                          <td>{row.passed ? 'Yes' : 'No'}</td>
                          <td>
                            <a
                              className='ss-row-link'
                              href={row.linkHref}
                              target='_blank'
                              rel='noreferrer'
                            >
                              Link
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              </>
            )}
          {hasData && (
            <div className='d-flex gap-2 justify-content-end'>
              <Button
                variant='danger'
                onClick={purgeResults}
                disabled={isPurging}
              >
                Purge Results
              </Button>
              <Button variant='primary' onClick={exportResults}>
                Export Results
              </Button>
            </div>
          )}
        </div>
      )}

      {canShowResults && hasData && accuracyByCategory.length > 0 && (
        <Card>
          <Card.Header>
            <h5 className='mb-0'>Label Accuracy</h5>
          </Card.Header>
          <Card.Body>
            <p
              className='text-center mb-2'
              style={{ fontSize: '1rem', color: 'var(--ss-text-muted)' }}
            >
              Over/Under Count Percentage By Label
            </p>
            <details
              className='mb-3'
              style={{
                background: 'var(--ss-surface-alt)',
                border: '1px solid var(--ss-border-soft)',
                borderRadius: 6,
                padding: '8px 12px',
                fontSize: 13,
                color: 'var(--ss-text)',
              }}
            >
              <summary
                style={{
                  cursor: 'pointer',
                  fontWeight: 600,
                  color: 'var(--ss-text-muted)',
                }}
              >
                How to read this chart
              </summary>
              <div className='mt-2' style={{ lineHeight: 1.5 }}>
                <p className='mb-2'>
                  Each bar compares the user&apos;s count for a label against
                  the expected test count, summed across all of this user&apos;s
                  tests in the selected survey.
                </p>
                <ul className='mb-0' style={{ paddingLeft: 18 }}>
                  <li>
                    <strong>0%</strong> &mdash; the user&apos;s count matched
                    the test exactly.
                  </li>
                  <li>
                    <strong style={{ color: '#DF691A' }}>Negative</strong>{' '}
                    (orange) &mdash; undercount. <em>&minus;50%</em> means they
                    counted only half of the expected; <em>&minus;100%</em>{' '}
                    means they missed every one of that label.
                  </li>
                  <li>
                    <strong style={{ color: '#5bc0de' }}>Positive</strong>{' '}
                    (blue) &mdash; overcount. <em>+50%</em> means they counted
                    1.5&times; the expected; <em>+100%</em> means twice as many.
                  </li>
                </ul>
              </div>
            </details>
            <BarChart
              dataset={accuracyByCategory}
              layout='horizontal'
              margin={{ top: 20, right: 40, bottom: 50, left: 120 }}
              sx={{
                '& .MuiChartsAxis-line, & .MuiChartsAxis-tick': {
                  stroke: 'var(--ss-border-strong)',
                },
                '& .MuiChartsAxis-tickLabel': {
                  fill: 'var(--ss-text)',
                  fontSize: 12,
                },
                '& .MuiBarLabel-root': {
                  fill: 'var(--ss-text)',
                  fontSize: 11,
                  fontWeight: 600,
                },
                '& .MuiChartsGrid-line': {
                  stroke: 'var(--ss-border-soft)',
                },
              }}
              xAxis={[
                {
                  valueFormatter: (value: number) =>
                    `${(value * 100).toFixed(0)}%`,
                  colorMap: {
                    type: 'piecewise',
                    thresholds: [0],
                    colors: ['#DF691A', '#5bc0de'],
                  },
                },
              ]}
              yAxis={[
                {
                  scaleType: 'band',
                  dataKey: 'name',
                },
              ]}
              series={[
                {
                  dataKey: 'countPercentage',
                  valueFormatter: (value) =>
                    value === null ? '' : `${(value * 100).toFixed(2)}%`,
                },
              ]}
              barLabel={(item) => {
                const v = item.value as number | null;
                if (v === null || v === undefined) return '';
                return `${(v * 100).toFixed(1)}%`;
              }}
              grid={{ vertical: true }}
              height={Math.max(
                260,
                accuracyByCategory.length * 56 + 80
              )}
              borderRadius={4}
            />
          </Card.Body>
        </Card>
      )}
    </div>
  );
}

function StatTile({ label, rows }: { label: string; rows: string[] }) {
  return (
    <div
      style={{
        background: 'var(--ss-surface-alt)',
        border: '1px solid var(--ss-border-soft)',
        borderRadius: 8,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--ss-text-dim)',
        }}
      >
        {label}
      </div>
      {rows.map((row, i) => (
        <div key={i} style={{ fontSize: 13 }}>
          {row}
        </div>
      ))}
    </div>
  );
}

function SortableTh({
  label,
  col,
  sortCol,
  sortDir,
  onClick,
}: {
  label: string;
  col: SortColumn;
  sortCol: SortColumn;
  sortDir: SortDir;
  onClick: (col: SortColumn) => void;
}) {
  const active = sortCol === col;
  return (
    <th
      onClick={() => onClick(col)}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      {label}
      {active && (
        <span style={{ marginLeft: 4 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>
      )}
    </th>
  );
}
