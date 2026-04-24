import { useContext, useEffect, useMemo, useState } from 'react';
import Select from 'react-select';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import { GlobalContext } from './Context';
import { useUsers } from './apiInterface';
import { fetchAllPaginatedResults } from './utils';
import type { Schema } from './amplify/client-schema';
import { Page, PageHeader, Toolbar, ContentArea, Spacer } from './ss/PageShell';

type Option = { label: string; value: string };

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];

export default function ClientLogs() {
  const { client } = useContext(GlobalContext)!;
  const { users } = useUsers();

  const userOptions: Option[] = useMemo(
    () =>
      users.map((u) => ({
        label: `${u.name || u.id} (${u.email || ''})`,
        value: u.id,
      })),
    [users]
  );

  const [selectedUser, setSelectedUser] = useState<Option | null>(null);
  const [start, setStart] = useState<string>('');
  const [end, setEnd] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<Schema['ClientLog']['type'][]>([]);
  const [page, setPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  function escapeCsvValue(value: unknown): string {
    const stringValue =
      value === null || value === undefined ? '' : String(value);
    const needsQuoting = /[",\n\r]/.test(stringValue);
    const escaped = stringValue.replace(/"/g, '""');
    return needsQuoting ? `"${escaped}"` : escaped;
  }

  function exportFilteredLogsToCsv() {
    if (!filteredLogs.length) return;

    const header = [
      'timestamp',
      'userId',
      'userName',
      'ipAddress',
      'deviceType',
      'os',
      'connectionType',
      'downlink',
      'rtt',
      'userAgent',
    ];

    const rows = filteredLogs.map((log) => {
      const user = users.find((u) => u.id === log.userId);
      return [
        new Date(log.createdAt as any).toISOString(),
        log.userId,
        user?.name || '',
        log.ipAddress || '',
        log.deviceType || '',
        log.os || '',
        log.connectionType || '',
        log.downlink ?? '',
        log.rtt ?? '',
        log.userAgent || '',
      ]
        .map(escapeCsvValue)
        .join(',');
    });

    const csv = [header.join(','), ...rows].join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const usernamePart =
      selectedUser?.label?.replace(/[^a-z0-9-_]+/gi, '_') || 'all';
    link.download = `client_logs_${usernamePart}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function loadLogs(userId: string) {
    setLoading(true);
    try {
      const data = await fetchAllPaginatedResults(
        client.models.ClientLog.clientLogsByUserId as any,
        {
          userId,
          selectionSet: [
            'id',
            'userId',
            'ipAddress',
            'userAgent',
            'deviceType',
            'os',
            'connectionType',
            'downlink',
            'rtt',
            'createdAt',
          ],
          limit: 10000,
        } as any
      );
      setLogs(data as any);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (selectedUser) {
      loadLogs(selectedUser.value);
    } else {
      setLogs([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedUser?.value]);

  const filteredLogs = useMemo(() => {
    let result = logs;
    if (start) {
      const s = new Date(start).getTime();
      result = result.filter(
        (l) => new Date(l.createdAt as any).getTime() >= s
      );
    }
    if (end) {
      const e = new Date(end).getTime();
      result = result.filter(
        (l) => new Date(l.createdAt as any).getTime() <= e
      );
    }
    return [...result].sort(
      (a, b) =>
        new Date(b.createdAt as any).getTime() -
        new Date(a.createdAt as any).getTime()
    );
  }, [logs, start, end]);

  useEffect(() => {
    setPage(1);
  }, [selectedUser?.value, start, end, itemsPerPage]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredLogs.length / itemsPerPage)
  );
  const pageClamped = Math.min(Math.max(1, page), totalPages);
  const pagedLogs = filteredLogs.slice(
    (pageClamped - 1) * itemsPerPage,
    pageClamped * itemsPerPage
  );

  const selectStyles = {
    control: (base: any) => ({
      ...base,
      background: 'var(--ss-surface)',
      borderColor: 'var(--ss-border)',
      minHeight: 38,
    }),
    menu: (base: any) => ({ ...base, zIndex: 20 }),
  };

  return (
    <Page>
      <PageHeader
        title='Client Logs'
        actions={
          <>
            <Button
              variant='secondary'
              onClick={() => selectedUser && loadLogs(selectedUser.value)}
              disabled={!selectedUser || loading}
            >
              {loading ? 'Loading…' : 'Refresh'}
            </Button>
            <Button
              variant='primary'
              onClick={exportFilteredLogsToCsv}
              disabled={!filteredLogs.length}
            >
              Export CSV
            </Button>
          </>
        }
      />
      <Toolbar>
        <div style={{ minWidth: 280, flex: '1 1 280px', maxWidth: 360 }}>
          <Select
            options={userOptions}
            value={selectedUser}
            onChange={(opt) => setSelectedUser(opt as Option)}
            placeholder='Select a user…'
            isClearable
            className='text-black'
            styles={selectStyles}
          />
        </div>
        <Form.Control
          type='datetime-local'
          value={start}
          onChange={(e) => setStart(e.target.value)}
          style={{ maxWidth: 210 }}
          placeholder='Start'
        />
        <Form.Control
          type='datetime-local'
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          style={{ maxWidth: 210 }}
          placeholder='End'
        />
        {(start || end) && (
          <Button
            variant='secondary'
            size='sm'
            onClick={() => {
              setStart('');
              setEnd('');
            }}
          >
            Clear
          </Button>
        )}
        <Spacer />
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
            onChange={(e) => setItemsPerPage(parseInt(e.target.value, 10))}
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
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={pageClamped === 1}
            style={{ padding: '2px 10px' }}
          >
            ‹
          </Button>
          <Button
            size='sm'
            variant='secondary'
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={pageClamped === totalPages}
            style={{ padding: '2px 10px' }}
          >
            ›
          </Button>
        </div>
      </Toolbar>
      <ContentArea style={{ paddingTop: 12 }}>
        <div className='ss-card' style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className='ss-data-table'>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>IP</th>
                  <th>Device</th>
                  <th>OS</th>
                  <th>Conn</th>
                  <th>Downlink (Mb/s)</th>
                  <th>RTT (ms)</th>
                  <th>User Agent</th>
                </tr>
              </thead>
              <tbody>
                {pagedLogs.map((log) => {
                  const user = users.find((u) => u.id === log.userId);
                  return (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt as any).toLocaleString()}
                      </td>
                      <td>{user?.name || log.userId}</td>
                      <td>{log.ipAddress || '—'}</td>
                      <td>{log.deviceType || '—'}</td>
                      <td>{log.os || '—'}</td>
                      <td>{log.connectionType || '—'}</td>
                      <td>{log.downlink ?? '—'}</td>
                      <td>{log.rtt ?? '—'}</td>
                      <td
                        style={{
                          maxWidth: 320,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: 'var(--ss-text-dim)',
                          fontSize: 12,
                        }}
                        title={log.userAgent || ''}
                      >
                        {log.userAgent || '—'}
                      </td>
                    </tr>
                  );
                })}
                {pagedLogs.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      style={{
                        textAlign: 'center',
                        color: 'var(--ss-text-dim)',
                        padding: '24px',
                      }}
                    >
                      {selectedUser
                        ? loading
                          ? 'Loading…'
                          : 'No logs found for selection'
                        : 'Select a user to view logs'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </ContentArea>
    </Page>
  );
}
