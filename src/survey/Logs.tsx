import { useContext, useEffect, useState, useMemo } from 'react';
import { Button, Form, Card, Spinner } from 'react-bootstrap';
import { GlobalContext } from '../Context';
import { Schema } from '../amplify/client-schema';
import { fetchAllPaginatedResults } from '../utils';
import { Download } from 'lucide-react';
import exportFromJSON from 'export-from-json';
import { useUsers } from '../apiInterface';

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];
const ROWS_PER_PAGE_STORAGE_KEY = 'logsRowsPerPage';

type SortOption =
  | 'createdAt'
  | 'createdAt-reverse'
  | 'userName'
  | 'userName-reverse';

export default function Logs({ projectId }: { projectId: string }) {
  const { client } = useContext(GlobalContext)!;
  const { users } = useUsers();
  const [logs, setLogs] = useState<Schema['AdminActionLog']['type'][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userMap = useMemo(() => {
    return users.reduce((acc, user) => {
      acc[user.id] = user.name ?? '';
      return acc;
    }, {} as Record<string, string>);
  }, [users]);
  
  // Date range filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('00:00');
  const [endTime, setEndTime] = useState<string>('23:59');

  const [sortBy, setSortBy] = useState<SortOption>('createdAt');
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const getInitialRowsPerPage = () => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(ROWS_PER_PAGE_STORAGE_KEY);
      const parsed = stored ? parseInt(stored, 10) : NaN;
      if (ROWS_PER_PAGE_OPTIONS.includes(parsed)) {
        return parsed;
      }
    }
    return 25;
  };

  const [itemsPerPage, setItemsPerPage] = useState(getInitialRowsPerPage);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(ROWS_PER_PAGE_STORAGE_KEY, String(itemsPerPage));
    }
  }, [itemsPerPage]);

  // Set default date range to today
  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
  }, []);

  const fetchLogs = async () => {
    if (!startDate || !endDate) {
      setError('Please select both start and end dates');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Build date-time strings for filtering
      const startDateTime = `${startDate}T${startTime}:00.000Z`;
      const endDateTime = `${endDate}T${endTime}:59.999Z`;

      // Query logs by projectId with createdAt filter
      // Note: We query all logs for the project, then filter by date range
      // since the index has createdAt as sort key
      const allLogs = await fetchAllPaginatedResults(
        client.models.AdminActionLog.adminActionLogsByProjectId,
        {
          projectId,
          filter: {
            createdAt: {
              ge: startDateTime,
              le: endDateTime,
            },
          },
          selectionSet: ['id', 'userId', 'message', 'createdAt', 'projectId'],
        }
      ).catch(async () => {
        // Fallback: if query fails, try listing all and filtering client-side
        const allProjectLogs = await fetchAllPaginatedResults(
          client.models.AdminActionLog.list,
          {
            filter: {
              projectId: { eq: projectId },
            },
            selectionSet: ['id', 'userId', 'message', 'createdAt', 'projectId'],
          }
        );
        return allProjectLogs.filter((log) => {
          const logDate = new Date(log.createdAt ?? '');
          const start = new Date(startDateTime);
          const end = new Date(endDateTime);
          return logDate >= start && logDate <= end;
        });
      });

      // Sort by createdAt descending (newest first)
      const sortedLogs = allLogs.sort((a, b) => {
        const dateA = new Date(a.createdAt ?? '').getTime();
        const dateB = new Date(b.createdAt ?? '').getTime();
        return dateB - dateA;
      });

      setLogs(sortedLogs);
    } catch (err) {
      console.error('Error fetching logs:', err);
      setError('Failed to fetch logs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (startDate && endDate) {
      fetchLogs();
    }
  }, [projectId]); // Only fetch on mount or when projectId changes

  const handleDownload = () => {
    if (logs.length === 0) {
      alert('No logs to download');
      return;
    }

    // Format logs for export
    const exportData = logs.map((log) => ({
      Timestamp: new Date(log.createdAt ?? '').toLocaleString(),
      'User Name': userMap[log.userId] || log.userId,
      'User ID': log.userId,
      Message: log.message,
      'Project ID': log.projectId || '',
    }));

    exportFromJSON({
      data: exportData,
      fileName: `admin-logs-${projectId}-${startDate}-to-${endDate}`,
      exportType: exportFromJSON.types.csv,
    });
  };

  const formatTimestamp = (timestamp: string | null | undefined) => {
    return new Date(timestamp ?? '').toLocaleString();
  };

  const filteredLogs = useMemo(() => {
    const searchLower = search.toLowerCase();
    if (searchLower === '') return logs;
    return logs.filter((log) => {
      const name = userMap[log.userId] || log.userId;
      return (
        name.toLowerCase().includes(searchLower) ||
        (log.message ?? '').toLowerCase().includes(searchLower)
      );
    });
  }, [logs, search, userMap]);

  const sortedLogs = useMemo(() => {
    const sorted = [...filteredLogs];
    const dateOf = (log: Schema['AdminActionLog']['type']) =>
      new Date(log.createdAt ?? '').getTime();
    const nameOf = (log: Schema['AdminActionLog']['type']) =>
      userMap[log.userId] || log.userId;
    switch (sortBy) {
      case 'createdAt':
        return sorted.sort((a, b) => dateOf(b) - dateOf(a));
      case 'createdAt-reverse':
        return sorted.sort((a, b) => dateOf(a) - dateOf(b));
      case 'userName':
        return sorted.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
      case 'userName-reverse':
        return sorted.sort((a, b) => nameOf(b).localeCompare(nameOf(a)));
      default:
        return sorted;
    }
  }, [filteredLogs, sortBy, userMap]);

  const totalPages = Math.max(
    1,
    Math.ceil(sortedLogs.length / itemsPerPage)
  );
  const pageClamped = Math.min(Math.max(1, currentPage), totalPages);
  const pagedLogs = sortedLogs.slice(
    (pageClamped - 1) * itemsPerPage,
    pageClamped * itemsPerPage
  );

  return (
    <div className="d-flex flex-column gap-3">
      <Card>
        <Card.Header>
          <h5 className="mb-0">Filter Logs</h5>
        </Card.Header>
        <Card.Body>
          <div className="d-flex flex-column flex-md-row gap-3 align-items-md-end">
            <div className="flex-grow-1">
              <Form.Label>Start Date</Form.Label>
              <Form.Control
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="flex-grow-1">
              <Form.Label>Start Time</Form.Label>
              <Form.Control
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="flex-grow-1">
              <Form.Label>End Date</Form.Label>
              <Form.Control
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <div className="flex-grow-1">
              <Form.Label>End Time</Form.Label>
              <Form.Control
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            <div>
              <Button onClick={fetchLogs} disabled={loading}>
                {loading ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    Loading...
                  </>
                ) : (
                  'Apply Filter'
                )}
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      <Card>
        <Card.Header className="d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Admin Action Logs</h5>
          <Button
            variant="primary"
            size="sm"
            onClick={handleDownload}
            disabled={logs.length === 0}
          >
            <Download size={16} className="me-1" />
            Download CSV
          </Button>
        </Card.Header>
        <Card.Body className='p-0'>
          {loading ? (
            <div className='text-center py-4'>
              <Spinner />
            </div>
          ) : (
            <>
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
                  placeholder='Search logs…'
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{
                    minWidth: 0,
                    maxWidth: '260px',
                    flex: '0 1 auto',
                  }}
                />
                <Form.Select
                  value={sortBy}
                  onChange={(e) => {
                    setSortBy(e.target.value as SortOption);
                    setCurrentPage(1);
                  }}
                  style={{
                    minWidth: 0,
                    maxWidth: '200px',
                    flex: '0 1 auto',
                  }}
                >
                  <option value='createdAt'>Newest first</option>
                  <option value='createdAt-reverse'>Oldest first</option>
                  <option value='userName'>User (A-Z)</option>
                  <option value='userName-reverse'>User (Z-A)</option>
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
              <div style={{ overflowX: 'auto' }}>
                <table className='ss-data-table'>
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>User</th>
                      <th>Message</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatTimestamp(log.createdAt)}</td>
                        <td>{userMap[log.userId] || log.userId}</td>
                        <td>
                          <span style={{ whiteSpace: 'pre-wrap' }}>
                            {log.message}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {pagedLogs.length === 0 && (
                      <tr>
                        <td
                          colSpan={3}
                          style={{
                            textAlign: 'center',
                            color: 'var(--ss-text-dim)',
                            padding: '24px',
                          }}
                        >
                          No logs found for the selected date range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
