import { Nav } from 'react-bootstrap';
import { NavLink, Outlet } from 'react-router-dom';

const LINKS = [
  { to: 'shares', label: 'Manage Shares' },
  { to: 'results', label: 'Results' },
  { to: 'disagreements', label: 'Disagreement Explorer' },
];

/**
 * Sidebar shell for the sysadmin chain-share dashboard. Renders a vertical nav
 * down the left and the active sub-page (Manage Shares / Results / Disagreement
 * Explorer) in the content area via <Outlet/>.
 */
export default function ChainShareAdminLayout() {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: 1500,
        marginTop: 16,
        marginBottom: 16,
        display: 'flex',
        gap: 16,
        alignItems: 'flex-start',
      }}
    >
      <Nav
        variant='pills'
        className='flex-column'
        style={{ flex: '0 0 210px', position: 'sticky', top: 16 }}
      >
        <div className='text-uppercase text-muted small fw-bold mb-2 px-2'>
          Chain Shares
        </div>
        {LINKS.map((l) => (
          <Nav.Link as={NavLink} to={l.to} key={l.to} className='mb-1'>
            {l.label}
          </Nav.Link>
        ))}
      </Nav>
      <div className='flex-grow-1' style={{ minWidth: 0 }}>
        <Outlet />
      </div>
    </div>
  );
}
