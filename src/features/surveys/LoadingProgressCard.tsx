import { Spinner } from 'react-bootstrap';

// Shared loading panel for launch modals: a header spinner plus one row per
// parallel/sequential fetch, each showing its live count and a per-row
// spinner→✓ so a slow load reads as "still working", not "frozen".
export type LoadProgressRow = {
  label: string;
  count: number;
  done: boolean;
};

export function LoadingProgressCard({
  title,
  rows,
}: {
  title: string;
  rows: LoadProgressRow[];
}) {
  return (
    <div
      className='border border-dark shadow-sm p-3'
      style={{ backgroundColor: '#697582' }}
    >
      <div className='d-flex align-items-center gap-2 text-white mb-2'>
        <Spinner animation='border' size='sm' />
        <span style={{ fontSize: '13px', fontWeight: 600 }}>{title}</span>
      </div>
      <div
        className='d-flex flex-column gap-1 text-white'
        style={{ fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}
      >
        {rows.map((row) => (
          <LoadRow key={row.label} {...row} />
        ))}
      </div>
    </div>
  );
}

function LoadRow({ label, count, done }: LoadProgressRow) {
  return (
    <div className='d-flex flex-row align-items-center justify-content-between gap-4'>
      <span className='d-flex align-items-center gap-2'>
        {done ? (
          <span aria-hidden='true'>✓</span>
        ) : (
          <Spinner
            animation='border'
            role='status'
            style={{ width: 12, height: 12, borderWidth: 2 }}
          />
        )}
        {label}
      </span>
      <span style={{ fontWeight: 600 }}>{count.toLocaleString()}</span>
    </div>
  );
}
