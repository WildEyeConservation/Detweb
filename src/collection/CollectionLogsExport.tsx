import { useContext, useState, useMemo, useEffect } from 'react';
import { Button, Card, Form, Spinner } from 'react-bootstrap';
import { GlobalContext } from '../Context';
import { fetchAllPaginatedResults } from '../utils';
import exportFromJSON from 'export-from-json';
import { useUsers } from '../apiInterface';
import { Download } from 'lucide-react';
import MyTable from '../Table';
import { Schema } from '../amplify/client-schema';
import { CollectionProject } from './CollectionView';

type Log = Schema['AdminActionLog']['type'] & { surveyName?: string; projectId?: string | null };

export default function CollectionLogsExport({ projects }: { projects: CollectionProject[] }) {
  const { client } = useContext(GlobalContext)!;
  const { users } = useUsers();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [startTime, setStartTime] = useState('00:00');
  const [endTime, setEndTime] = useState('23:59');

  const userMap = useMemo(
    () => users.reduce((acc, u) => { acc[u.id] = u.name ?? ''; return acc; }, {} as Record<string, string>),
    [users]
  );

  useEffect(() => {
    if (projects.length > 0) fetchLogs();
  }, [projects]);

  async function fetchLogs() {
    if (!startDate || !endDate || projects.length === 0) return;
    setLoading(true);
    setError(null);

    const startDateTime = `${startDate}T${startTime}:00.000Z`;
    const endDateTime = `${endDate}T${endTime}:59.999Z`;

    try {
      const projectNameMap = Object.fromEntries(projects.map((p) => [p.projectId, p.projectName]));

      const allLogs = await Promise.all(
        projects.map(async (proj) => {
          const projectLogs = await fetchAllPaginatedResults(
            client.models.AdminActionLog.adminActionLogsByProjectId,
            {
              projectId: proj.projectId,
              filter: {
                createdAt: { ge: startDateTime, le: endDateTime },
              },
              selectionSet: ['id', 'userId', 'message', 'createdAt', 'projectId'],
            }
          ).catch(async () => {
            const all = await fetchAllPaginatedResults(
              client.models.AdminActionLog.list,
              {
                filter: { projectId: { eq: proj.projectId } },
                selectionSet: ['id', 'userId', 'message', 'createdAt', 'projectId'],
              }
            );
            return all.filter((log) => {
              const d = new Date(log.createdAt ?? '');
              return d >= new Date(startDateTime) && d <= new Date(endDateTime);
            });
          });

          return projectLogs.map((log) => ({ ...log, surveyName: projectNameMap[proj.projectId] }));
        })
      );

      const merged = allLogs.flat().sort((a, b) => {
        const da = new Date(a.createdAt ?? '').getTime();
        const db = new Date(b.createdAt ?? '').getTime();
        return db - da;
      });

      setLogs(merged);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch logs. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (logs.length === 0) { alert('No logs to download'); return; }
    exportFromJSON({
      data: logs.map((log) => ({
        Survey: log.surveyName ?? '',
        Timestamp: new Date(log.createdAt ?? '').toLocaleString(),
        'User Name': userMap[log.userId] || log.userId,
        'User ID': log.userId,
        Message: log.message,
        'Project ID': log.projectId ?? '',
      })),
      fileName: `collection_admin_logs_${startDate}_to_${endDate}`,
      exportType: exportFromJSON.types.csv,
    });
  }

  const tableData = useMemo(
    () =>
      logs.map((log) => ({
        id: log.id,
        rowData: [
          log.surveyName ?? '',
          new Date(log.createdAt ?? '').toLocaleString(),
          userMap[log.userId] || log.userId,
          <span style={{ whiteSpace: 'pre-wrap' }}>{log.message}</span>,
        ],
      })),
    [logs, userMap]
  );

  const tableHeadings = [
    { content: 'Survey', sort: true },
    { content: 'Timestamp', sort: true },
    { content: 'User', sort: true },
    { content: 'Message', sort: false },
  ];

  if (projects.length === 0) {
    return <div className='p-3 text-warning'>No surveys in this collection yet.</div>;
  }

  return (
    <div className='d-flex flex-column gap-3 p-3'>
      <Card>
        <Card.Header>
          <h5 className='mb-0'>Filter Logs</h5>
        </Card.Header>
        <Card.Body>
          <div className='d-flex flex-column flex-md-row gap-3 align-items-md-end'>
            <div className='flex-grow-1'>
              <Form.Label>Start Date</Form.Label>
              <Form.Control type='date' value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className='flex-grow-1'>
              <Form.Label>Start Time</Form.Label>
              <Form.Control type='time' value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className='flex-grow-1'>
              <Form.Label>End Date</Form.Label>
              <Form.Control type='date' value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
            <div className='flex-grow-1'>
              <Form.Label>End Time</Form.Label>
              <Form.Control type='time' value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
            <div>
              <Button onClick={fetchLogs} disabled={loading}>
                {loading ? <><Spinner size='sm' className='me-2' />Loading...</> : 'Apply Filter'}
              </Button>
            </div>
          </div>
        </Card.Body>
      </Card>

      {error && <div className='alert alert-danger'>{error}</div>}

      <Card>
        <Card.Header className='d-flex justify-content-between align-items-center'>
          <h5 className='mb-0'>Admin Action Logs</h5>
          <Button variant='primary' size='sm' onClick={handleDownload} disabled={logs.length === 0}>
            <Download size={16} className='me-1' />
            Download CSV
          </Button>
        </Card.Header>
        <Card.Body>
          {loading ? (
            <div className='text-center py-4'><Spinner /></div>
          ) : (
            <MyTable
              tableHeadings={tableHeadings}
              tableData={tableData}
              pagination={true}
              itemsPerPage={25}
              emptyMessage='No logs found for the selected date range.'
            />
          )}
        </Card.Body>
      </Card>
    </div>
  );
}
