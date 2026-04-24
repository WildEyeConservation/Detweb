import { ReactNode, CSSProperties } from 'react';

/** Outermost page wrapper — replaces the old `<div style="maxWidth:1555">` + `<Card>` shell. */
export function Page({ children }: { children: ReactNode }) {
  return <div className='ss-page'>{children}</div>;
}

/**
 * Header strip with optional breadcrumb, title, and trailing action slot.
 * Matches the mockup: title sits aligned bottom-left, actions float right.
 */
export function PageHeader({
  title,
  breadcrumb,
  actions,
}: {
  title: ReactNode;
  breadcrumb?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className='ss-page-header'>
      <div>
        {breadcrumb && <div className='ss-page-breadcrumb'>{breadcrumb}</div>}
        <h1 className='ss-page-title'>{title}</h1>
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  );
}

/** Toolbar strip under the header — search/filter/sort controls. */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className='ss-page-toolbar'>{children}</div>;
}

/** Tab underline bar matching the mockup. Purely presentational. */
export type TabBarTab = { id: string; label: string };
export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: TabBarTab[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 0,
        padding: '0 28px',
        marginTop: 16,
        borderBottom: '1.5px solid var(--ss-border)',
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <div
            key={t.id}
            onClick={() => onChange(t.id)}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: isActive ? 600 : 400,
              color: isActive ? 'var(--ss-accent)' : 'var(--ss-text-muted)',
              cursor: 'pointer',
              borderBottom: `2px solid ${
                isActive ? 'var(--ss-accent)' : 'transparent'
              }`,
              marginBottom: -1.5,
              whiteSpace: 'nowrap',
              transition: 'color 0.15s',
            }}
          >
            {t.label}
          </div>
        );
      })}
    </div>
  );
}

/** Scrollable content area that fills remaining vertical space. */
export function ContentArea({
  children,
  style,
}: {
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className='ss-page-content' style={style}>
      {children}
    </div>
  );
}

/** Big number + label card used on Activity / dashboard screens. */
export function StatCard({
  num,
  label,
  style,
}: {
  num: ReactNode;
  label: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <div className='ss-card' style={{ flex: 1, minWidth: 150, ...style }}>
      <div className='ss-stat-card-num'>{num}</div>
      <div className='ss-stat-card-label'>{label}</div>
    </div>
  );
}

/** Flexible spacer for toolbars. */
export function Spacer() {
  return <div style={{ flex: 1 }} />;
}

/** Breadcrumb link segment helper. */
export function Crumb({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <a
      style={{
        color: 'var(--ss-accent)',
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={onClick}
    >
      {children}
    </a>
  );
}

/** Breadcrumb separator. */
export function CrumbSep() {
  return <span>/</span>;
}
