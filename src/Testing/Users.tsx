import { TestingContext } from '../Context';
import { useContext, useMemo, useState } from 'react';
import { Button, Form } from 'react-bootstrap';
import { useUsers } from '../apiInterface';
import LabeledToggleSwitch from '../LabeledToggleSwitch';

const ROWS_PER_PAGE_OPTIONS = [10, 25, 50, 100];
const ROWS_PER_PAGE_STORAGE_KEY = 'testingUsersRowsPerPage';

type SortOption = 'name' | 'name-reverse';

export default function Users() {
  const { organizationMembershipsHook: hook, organizationId } =
    useContext(TestingContext)!;
  const { users } = useUsers();

  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');
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

  if (typeof window !== 'undefined') {
    localStorage.setItem(ROWS_PER_PAGE_STORAGE_KEY, String(itemsPerPage));
  }

  const rows = useMemo(() => {
    return hook.data.map((membership) => {
      const user = users.find((u) => u.id === membership.userId);
      return {
        userId: membership.userId,
        userName: user?.name ?? 'Unknown',
        isTested: membership.isTested ?? false,
      };
    });
  }, [hook.data, users]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.userName.toLowerCase().includes(q));
  }, [rows, search]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    switch (sortBy) {
      case 'name':
        return copy.sort((a, b) => a.userName.localeCompare(b.userName));
      case 'name-reverse':
        return copy.sort((a, b) => b.userName.localeCompare(a.userName));
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

  return (
    <div className='d-flex flex-column gap-3'>
      <div>
        <h5 className='mb-1'>Organisation Users</h5>
        <div style={{ color: 'var(--ss-text-muted)', fontSize: 12, lineHeight: 1.4 }}>
          Mark members as test users to have them complete testing tasks before
          annotating surveys.
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          alignItems: 'center',
        }}
      >
          <Form.Control
            type='text'
            placeholder='Search users…'
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
        <div className='ss-card' style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className='ss-data-table'>
            <thead>
              <tr>
                <th>Name</th>
                <th>Test User</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((row) => (
                <tr key={row.userId}>
                  <td>{row.userName}</td>
                  <td>
                    <LabeledToggleSwitch
                      className='mb-0'
                      leftLabel='No'
                      rightLabel='Yes'
                      checked={row.isTested}
                      onChange={async (checked) => {
                        hook.update({
                          userId: row.userId,
                          organizationId,
                          isTested: checked,
                        });
                      }}
                    />
                  </td>
                </tr>
              ))}
              {paged.length === 0 && (
                <tr>
                  <td
                    colSpan={2}
                    style={{
                      textAlign: 'center',
                      color: 'var(--ss-text-dim)',
                      padding: '24px',
                    }}
                  >
                    {hook.data.length === 0 ? 'Loading users…' : 'No users found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
        </div>
    </div>
  );
}
