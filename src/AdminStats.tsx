import { useMemo, useState } from 'react';
import Spinner from 'react-bootstrap/Spinner';
import Alert from 'react-bootstrap/Alert';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import { DateTime } from 'luxon';
import { LineChart } from '@mui/x-charts/LineChart';
import { useAdminStatsData } from './useAdminStatsData';
import { Page, PageHeader, ContentArea } from './ss/PageShell';

function SummaryTile(props: {
  title: string;
  total: number;
  thisMonth: number;
}) {
  return (
    <div className='ss-card h-100'>
      <div className='d-flex justify-content-between align-items-baseline'>
        <div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--ss-text-dim)',
              textTransform: 'uppercase',
              letterSpacing: 0.06,
              fontWeight: 600,
            }}
          >
            {props.title}
          </div>
          <div
            style={{
              fontSize: 26,
              fontWeight: 700,
              marginTop: 4,
              letterSpacing: '-0.02em',
            }}
          >
            {props.total.toLocaleString()}
          </div>
        </div>
        <div
          style={{
            fontSize: 12,
            color: 'var(--ss-green, #2f8a5c)',
            fontWeight: 500,
          }}
        >
          +{props.thisMonth.toLocaleString()} this month
        </div>
      </div>
    </div>
  );
}

function MetricChart(props: {
  title: string;
  months: string[];
  values: number[];
}) {
  return (
    <div className='ss-card h-100'>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          marginBottom: 8,
          color: 'var(--ss-text)',
        }}
      >
        {props.title}
      </div>
      <div style={{ height: 240 }}>
        <LineChart
          xAxis={[{ scaleType: 'band', data: props.months }]}
          series={[{ data: props.values, label: props.title }]}
          slotProps={{ legend: { hidden: true } }}
        />
      </div>
    </div>
  );
}

type BreakdownRow = ReturnType<typeof useAdminStatsData>['breakdown'][number];

function OrgBreakdownTable(props: { breakdown: BreakdownRow[] }) {
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] =
    useState<'name' | 'surveys' | 'images' | 'annotations'>('annotations');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return props.breakdown;
    return props.breakdown.filter((org) => {
      if (org.organizationName.toLowerCase().includes(q)) return true;
      return org.projects.some((p) =>
        p.projectName.toLowerCase().includes(q)
      );
    });
  }, [props.breakdown, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let va: number | string;
      let vb: number | string;
      switch (sortBy) {
        case 'name':
          va = a.organizationName.toLowerCase();
          vb = b.organizationName.toLowerCase();
          break;
        case 'surveys':
          va = a.totals.surveys;
          vb = b.totals.surveys;
          break;
        case 'images':
          va = a.totals.images;
          vb = b.totals.images;
          break;
        case 'annotations':
        default:
          va = a.totals.annotations;
          vb = b.totals.annotations;
          break;
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  const toggleSort = (key: typeof sortBy) => {
    if (sortBy === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(key);
      setSortDir(key === 'name' ? 'asc' : 'desc');
    }
  };

  const arrow = (key: typeof sortBy) =>
    sortBy === key ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '';

  return (
    <div className='ss-card' style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '14px 18px',
          borderBottom: '1px solid var(--ss-border-soft)',
        }}
      >
        <div style={{ fontWeight: 600, fontSize: 14 }}>
          Organisations & Surveys
        </div>
        <div style={{ flex: 1 }} />
        <Form.Control
          type='text'
          size='sm'
          placeholder='Search organisation or survey…'
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 280 }}
        />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className='ss-data-table'>
          <thead>
            <tr>
              <th style={{ width: 32 }}></th>
              <th
                onClick={() => toggleSort('name')}
                style={{ cursor: 'pointer' }}
              >
                Organisation{arrow('name')}
              </th>
              <th
                onClick={() => toggleSort('surveys')}
                style={{ cursor: 'pointer', textAlign: 'right' }}
              >
                Surveys{arrow('surveys')}
              </th>
              <th
                onClick={() => toggleSort('images')}
                style={{ cursor: 'pointer', textAlign: 'right' }}
              >
                Images{arrow('images')}
              </th>
              <th
                onClick={() => toggleSort('annotations')}
                style={{ cursor: 'pointer', textAlign: 'right' }}
              >
                Annotations{arrow('annotations')}
              </th>
              <th style={{ textAlign: 'right' }}>This month (S / I / A)</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((org) => (
              <OrgRow key={org.organizationId} org={org} />
            ))}
            {sorted.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  style={{
                    textAlign: 'center',
                    color: 'var(--ss-text-dim)',
                    padding: '24px',
                  }}
                >
                  No matching organisations
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function OrgRow(props: { org: BreakdownRow }) {
  const { org } = props;
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr>
        <td>
          {org.projects.length > 0 ? (
            <Button
              size='sm'
              variant='outline-secondary'
              onClick={() => setOpen((o) => !o)}
              style={{
                width: 28,
                height: 28,
                padding: 0,
                lineHeight: 1,
              }}
            >
              {open ? '−' : '+'}
            </Button>
          ) : null}
        </td>
        <td style={{ fontWeight: 500 }}>{org.organizationName}</td>
        <td style={{ textAlign: 'right' }}>
          <span className='ss-pill'>{org.totals.surveys.toLocaleString()}</span>
        </td>
        <td style={{ textAlign: 'right' }}>
          {org.totals.images.toLocaleString()}
        </td>
        <td style={{ textAlign: 'right' }}>
          {org.totals.annotations.toLocaleString()}
        </td>
        <td
          style={{
            textAlign: 'right',
            color: 'var(--ss-text-dim)',
            fontSize: 12,
          }}
        >
          {org.thisMonth.surveys.toLocaleString()} /{' '}
          {org.thisMonth.images.toLocaleString()} /{' '}
          {org.thisMonth.annotations.toLocaleString()}
        </td>
      </tr>
      {open &&
        org.projects.map((p) => (
          <tr
            key={p.projectId}
            style={{ background: 'var(--ss-surface-alt)' }}
          >
            <td></td>
            <td style={{ paddingLeft: 36, color: 'var(--ss-text-muted)' }}>
              {p.projectName}
            </td>
            <td style={{ textAlign: 'right' }}>{p.totals.surveys}</td>
            <td style={{ textAlign: 'right' }}>
              {p.totals.images.toLocaleString()}
            </td>
            <td style={{ textAlign: 'right' }}>
              {p.totals.annotations.toLocaleString()}
            </td>
            <td
              style={{
                textAlign: 'right',
                color: 'var(--ss-text-dim)',
                fontSize: 12,
              }}
            >
              {p.thisMonth.surveys} / {p.thisMonth.images.toLocaleString()} /{' '}
              {p.thisMonth.annotations.toLocaleString()}
            </td>
          </tr>
        ))}
    </>
  );
}

function formatFetchedAt(iso: string | null): string | null {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso).toLocal();
  if (!dt.isValid) return null;
  return dt.toFormat('dd LLL yyyy, HH:mm');
}

export default function AdminStats() {
  const [timeframe, setTimeframe] = useState(12);
  const data = useAdminStatsData(timeframe);
  const fetchedLabel = formatFetchedAt(data.fetchedAt);

  const summary = useMemo(
    () => [
      {
        title: 'Users',
        total: data.users.total,
        thisMonth: data.users.thisMonth,
      },
      {
        title: 'Organizations',
        total: data.organizations.total,
        thisMonth: data.organizations.thisMonth,
      },
      {
        title: 'Surveys',
        total: data.surveys.total,
        thisMonth: data.surveys.thisMonth,
      },
      {
        title: 'Images',
        total: data.images.total,
        thisMonth: data.images.thisMonth,
      },
      {
        title: 'Annotations',
        total: data.annotations.total,
        thisMonth: data.annotations.thisMonth,
      },
      {
        title: 'Primary Annotations',
        total: data.primaryAnnotations.total,
        thisMonth: data.primaryAnnotations.thisMonth,
      },
    ],
    [data]
  );

  return (
    <Page>
      <PageHeader title='Admin Statistics' />
      <ContentArea style={{ paddingTop: 12 }}>
        <div
          className='ss-card'
          style={{
            marginBottom: 16,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div>
            <Form.Label
              className='mb-1'
              style={{ fontSize: 12, color: 'var(--ss-text-dim)' }}
            >
              Timeframe
            </Form.Label>
            <Form.Select
              value={timeframe}
              onChange={(e) => setTimeframe(parseInt(e.target.value, 10))}
              style={{ minWidth: 180 }}
              disabled={data.loading}
            >
              <option value={6}>Last 6 months</option>
              <option value={12}>Last 12 months</option>
              <option value={24}>Last 24 months</option>
            </Form.Select>
          </div>
          <div style={{ flex: 1 }} />
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-end',
              gap: 6,
            }}
          >
            <Button
              variant='primary'
              onClick={data.refresh}
              disabled={data.loading}
            >
              {data.loading ? (
                <>
                  <Spinner animation='border' size='sm' className='me-2' />
                  Fetching…
                </>
              ) : data.hasData ? (
                'Refresh Metrics'
              ) : (
                'Fetch Metrics'
              )}
            </Button>
            <div style={{ fontSize: 12, color: 'var(--ss-text-dim)' }}>
              {fetchedLabel ? (
                <>Last fetched: {fetchedLabel}</>
              ) : (
                <>No cached data — click Fetch Metrics to load.</>
              )}
            </div>
          </div>
        </div>

        {data.error && (
          <Alert variant='danger' className='mb-3'>
            {data.error}
          </Alert>
        )}

        {!data.hasData && !data.loading ? (
          <div
            className='ss-card'
            style={{
              textAlign: 'center',
              padding: '48px 20px',
              color: 'var(--ss-text-dim)',
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: 'var(--ss-text)',
                marginBottom: 6,
              }}
            >
              No statistics loaded
            </div>
            <div style={{ fontSize: 13 }}>
              These queries are heavy — click{' '}
              <strong>Fetch Metrics</strong> above to run them. Results are
              cached locally for your next visit.
            </div>
          </div>
        ) : (
          <>
            <Row xs={1} md={3} lg={6} className='g-3 mb-3'>
              {summary.map((m) => (
                <Col key={m.title}>
                  <SummaryTile
                    title={m.title}
                    total={m.total}
                    thisMonth={m.thisMonth}
                  />
                </Col>
              ))}
            </Row>

            <Row className='g-3 mb-3'>
              <Col md={6}>
                <MetricChart
                  title='New users'
                  months={data.months}
                  values={data.users.series.values}
                />
              </Col>
              <Col md={6}>
                <MetricChart
                  title='Unique monthly logins'
                  months={data.months}
                  values={data.users.uniqueLoginSeries.values}
                />
              </Col>
              <Col md={6}>
                <MetricChart
                  title='New organizations'
                  months={data.months}
                  values={data.organizations.series.values}
                />
              </Col>
              <Col md={6}>
                <MetricChart
                  title='New surveys'
                  months={data.months}
                  values={data.surveys.series.values}
                />
              </Col>
              <Col md={6}>
                <MetricChart
                  title='New images'
                  months={data.months}
                  values={data.images.series.values}
                />
              </Col>
              <Col md={6}>
                <MetricChart
                  title='New annotations'
                  months={data.months}
                  values={data.annotations.series.values}
                />
              </Col>
            </Row>

            <OrgBreakdownTable breakdown={data.breakdown} />
          </>
        )}
      </ContentArea>
    </Page>
  );
}
