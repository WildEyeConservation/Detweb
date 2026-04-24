import { useContext, useEffect, useState, useRef } from 'react';
import {
  NavLink,
  useLocation,
  useNavigate,
  Outlet,
  matchPath,
} from 'react-router-dom';
import {
  ChevronDown,
  Check,
  Plus,
  Search,
  ClipboardList,
  Briefcase,
  BarChart3,
  Users,
  FlaskConical,
  Settings2,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { ProgressIndicators } from './ProgressIndicators.jsx';
import Notifications from './user/Notifications.tsx';
import Settings from './user/Settings.tsx';
import UploadProgress from './upload/UploadProgress.tsx';
import { UserContext, GlobalContext } from './Context.tsx';
import { useOrg, OrgSummary } from './OrgContext';
import { verifyToken } from './utils/jwt.ts';
import { useQueryClient } from '@tanstack/react-query';

type NavDef = {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  requires?: 'orgadmin' | 'sysadmin';
};

type NavSection = {
  section: string;
  items: NavDef[];
};

const NAV: NavSection[] = [
  {
    section: 'Surveys',
    items: [
      { id: 'surveys', label: 'Surveys', to: '/surveys', icon: ClipboardList },
    ],
  },
  {
    section: 'Annotation',
    items: [
      { id: 'jobs', label: 'Jobs', to: '/jobs', icon: Briefcase },
      { id: 'activity', label: 'Activity', to: '/activity', icon: BarChart3 },
    ],
  },
  {
    section: 'Org',
    items: [
      {
        id: 'permissions',
        label: 'Permissions',
        to: '/permissions',
        icon: Users,
        requires: 'orgadmin',
      },
      {
        id: 'testing',
        label: 'User Testing',
        to: '/testing',
        icon: FlaskConical,
        requires: 'orgadmin',
      },
    ],
  },
];

const SYSTEM_NAV: NavDef[] = [
  { id: 'admin', label: 'Admin', to: '/SSAdmin', icon: Settings2, requires: 'sysadmin' },
];

export default function MainNavigation({ signOut }: { signOut: () => void }) {
  const {
    cognitoGroups,
    myOrganizationHook,
    isOrganizationAdmin,
    myMembershipHook: myProjectsHook,
    isAnnotatePath,
    setIsAnnotatePath,
    user,
  } = useContext(UserContext)!;
  const queryClient = useQueryClient();
  const { client } = useContext(GlobalContext)!;
  const [, setCheckingToken] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const myAdminProjects = myProjectsHook.data?.filter((p) => p.isAdmin) ?? [];
  const belongsToOrganization = myOrganizationHook.data.length > 0;

  useEffect(() => {
    setIsAnnotatePath(
      /^\/surveys\/[^/]+\/annotate$/.test(location.pathname) ||
        /^\/surveys\/[^/]+\/qc-review\/[^/]+$/.test(location.pathname) ||
        /^\/surveys\/[^/]+\/homography\/[^/]+$/.test(location.pathname)
    );
  }, [location.pathname]);

  useEffect(() => {
    if (
      belongsToOrganization &&
      (location.pathname === '' ||
        location.pathname === '/' ||
        location.pathname === '/SSRegisterOrganization')
    ) {
      navigate(
        myAdminProjects.length > 0 || isOrganizationAdmin ? '/surveys' : '/jobs'
      );
    }
  }, [isOrganizationAdmin, myAdminProjects.length, belongsToOrganization]);

  // One-time JWT magic-link processing.
  useEffect(() => {
    async function checkToken() {
      setCheckingToken(true);
      try {
        const token = localStorage.getItem('jwt');
        if (token) {
          localStorage.removeItem('jwt');
          const { data: secret } = await client.mutations.getJwtSecret();
          if (!secret) return;
          const payload = (await verifyToken(token, secret)) as {
            type: string;
            surveyId: string;
            annotationSetId: string;
            exp: number;
          };
          if (payload.exp < Date.now() / 1000) {
            alert('Results link expired');
            return;
          }
          if (payload.type === 'jolly') {
            const { data: membership } =
              await client.models.JollyResultsMembership.get({
                surveyId: payload.surveyId,
                annotationSetId: payload.annotationSetId,
                userId: user.userId,
              });
            if (!membership) {
              const { data: surveyProject } = await client.models.Project.get({
                id: payload.surveyId,
              });
              await client.models.JollyResultsMembership.create({
                surveyId: payload.surveyId,
                annotationSetId: payload.annotationSetId,
                userId: user.userId,
                group: surveyProject?.organizationId,
              });
            }
            queryClient.invalidateQueries({
              queryKey: ['JollyResultsMembership'],
            });
            navigate(`/jolly/${payload.surveyId}/${payload.annotationSetId}`);
          }
        }
      } catch (err) {
        console.error(err);
        localStorage.removeItem('jwt');
      } finally {
        setCheckingToken(false);
      }
    }
    checkToken();
  }, []);

  // If the only route the user has access to is /jobs, keep them there.
  useEffect(() => {
    if (isOrganizationAdmin && location.pathname === '/jobs') {
      navigate('/surveys');
    }
  }, [isOrganizationAdmin]);

  if (!belongsToOrganization) {
    return (
      <NoOrgShell signOut={signOut}>
        <Outlet />
      </NoOrgShell>
    );
  }

  if (isAnnotatePath) {
    // Annotate/QC/homography screens own the whole viewport — no sidebar.
    return (
      <div style={{ height: '100dvh', overflow: 'hidden' }}>
        <Outlet />
      </div>
    );
  }

  const activeId = resolveActiveNavId(location.pathname);

  return (
    <div className='ss-app-shell'>
      <aside className='ss-sidebar'>
        <SidebarHeader />
        <OrgSwitcher />

        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {NAV.map((section) => {
            const items = section.items.filter((item) =>
              canShow(item, isOrganizationAdmin, cognitoGroups)
            );
            if (items.length === 0) return null;
            return (
              <div key={section.section}>
                <div className='ss-sidebar-section-label'>{section.section}</div>
                {items.map((item) => (
                  <SidebarNavItem
                    key={item.id}
                    item={item}
                    active={activeId === item.id}
                  />
                ))}
              </div>
            );
          })}

          {cognitoGroups.includes('sysadmin') && (
            <div
              style={{
                margin: '10px 10px 4px',
                borderTop: '1px solid rgba(255,255,255,0.07)',
                paddingTop: 10,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  padding: '0 4px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span style={{ color: 'rgba(255,255,255,0.22)' }}>System</span>
              </div>
              {SYSTEM_NAV.map((item) => (
                <SidebarNavItem
                  key={item.id}
                  item={item}
                  active={activeId === item.id}
                  muted
                />
              ))}
            </div>
          )}
        </nav>

        <SidebarFooter signOut={signOut} />
      </aside>

      <section className='ss-content'>
        <div className='ss-content-scroll'>
          <Outlet />
        </div>
        <UploadProgress />
        <ProgressIndicators />
      </section>
    </div>
  );
}

function canShow(
  item: NavDef,
  isOrgAdmin: boolean,
  cognitoGroups: string[]
): boolean {
  if (item.requires === 'orgadmin' && !isOrgAdmin) return false;
  if (item.requires === 'sysadmin' && !cognitoGroups.includes('sysadmin'))
    return false;
  return true;
}

function resolveActiveNavId(pathname: string): string {
  if (matchPath('/surveys/*', pathname) || pathname === '/surveys') return 'surveys';
  if (pathname.startsWith('/jobs')) return 'jobs';
  if (pathname.startsWith('/activity') || pathname.startsWith('/annotation-statistics'))
    return 'activity';
  if (pathname.startsWith('/permissions')) return 'permissions';
  if (pathname.startsWith('/testing')) return 'testing';
  if (pathname.startsWith('/SSAdmin')) return 'admin';
  return 'surveys';
}

function SidebarHeader() {
  return (
    <div
      style={{
        padding: '18px 16px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <img
        src='/Logo.png'
        alt='Logo'
        style={{ height: '32px', marginRight: '4px' }}
      />
      <div>
        <div
          style={{
            color: '#fff',
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: '-0.01em',
          }}
        >
          SurveyScope
        </div>
        <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
          AI Aerial-Census Software
        </div>
      </div>
    </div>
  );
}

function LogoMark() {
  return (
    <svg width='22' height='22' viewBox='0 0 22 22' fill='none'>
      <rect
        x='1'
        y='1'
        width='20'
        height='20'
        rx='5'
        fill='rgba(255,255,255,0.12)'
        stroke='rgba(255,255,255,0.2)'
        strokeWidth='1'
      />
      <circle cx='11' cy='11' r='5' stroke='rgba(255,255,255,0.8)' strokeWidth='1.5' />
      <circle cx='11' cy='11' r='2' fill='rgba(255,255,255,0.9)' />
      <path
        d='M11 1v3M11 18v3M1 11h3M18 11h3'
        stroke='rgba(255,255,255,0.4)'
        strokeWidth='1'
        strokeLinecap='round'
      />
    </svg>
  );
}

function SidebarNavItem({
  item,
  active,
  muted = false,
}: {
  item: NavDef;
  active: boolean;
  muted?: boolean;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className={`ss-nav-item ${active ? 'active' : ''}`}
      style={
        muted && !active
          ? { color: 'rgba(255,255,255,0.32)' }
          : undefined
      }
    >
      <span className='ss-nav-icon'>
        <Icon size={15} />
      </span>
      {item.label}
      {active && (
        <span
          style={{
            marginLeft: 'auto',
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: 'var(--ss-accent)',
          }}
        />
      )}
    </NavLink>
  );
}

function OrgSwitcher() {
  const { orgs, currentOrg, setCurrentOrg } = useOrg();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const filtered = orgs.filter((o) =>
    o.name.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div
      ref={ref}
      style={{ margin: '10px 10px 4px', position: 'relative' }}
    >
      <div
        onClick={() => setOpen((o) => !o)}
        style={{
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 8,
          padding: '8px 10px',
          cursor: 'pointer',
          border: `1px solid ${
            open ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.08)'
          }`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'border-color 0.15s',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div
            style={{
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentOrg?.name ?? 'Select organisation'}
          </div>
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>
            Switch org <ChevronDown size={9} style={{ verticalAlign: 'middle' }} />
          </div>
        </div>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: currentOrg ? '#6dcba0' : '#6b7a72',
          }}
        />
      </div>

      {open && (
        <OrgSwitcherDropdown
          orgs={filtered}
          currentOrg={currentOrg}
          onSelect={(org) => {
            setCurrentOrg(org);
            setOpen(false);
          }}
          query={query}
          setQuery={setQuery}
        />
      )}
    </div>
  );
}

function OrgSwitcherDropdown({
  orgs,
  currentOrg,
  onSelect,
  query,
  setQuery,
}: {
  orgs: OrgSummary[];
  currentOrg: OrgSummary | null;
  onSelect: (org: OrgSummary) => void;
  query: string;
  setQuery: (q: string) => void;
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 'calc(100% + 6px)',
        left: 0,
        right: 0,
        zIndex: 100,
        background: '#1e2f28',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 10,
        overflow: 'hidden',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
      }}
    >
      <div
        style={{
          padding: '8px 10px',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255,255,255,0.06)',
            borderRadius: 6,
            padding: '5px 9px',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <Search size={11} color='rgba(255,255,255,0.3)' />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Search organisations…'
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#fff',
              fontSize: 12,
              flex: 1,
              minWidth: 0,
              padding: 0,
            }}
          />
        </div>
      </div>

      <div style={{ padding: '4px 0', maxHeight: 240, overflowY: 'auto' }}>
        {orgs.length === 0 ? (
          <div
            style={{
              padding: '12px 14px',
              color: 'rgba(255,255,255,0.35)',
              fontSize: 12,
            }}
          >
            No organisations
          </div>
        ) : (
          orgs.map((org) => (
            <div
              key={org.id}
              onClick={() => onSelect(org)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                background:
                  org.id === currentOrg?.id ? 'rgba(255,255,255,0.06)' : 'transparent',
                transition: 'background 0.1s',
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  flexShrink: 0,
                  background: 'rgba(77,143,110,0.27)',
                  border: '1px solid rgba(77,143,110,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fff',
                }}
              >
                {org.name[0]?.toUpperCase() ?? '?'}
              </div>
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#fff',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {org.name}
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                  {org.isAdmin ? 'Admin' : 'Annotator'}
                </div>
              </div>
              {org.id === currentOrg?.id && (
                <Check size={13} color='var(--ss-accent)' />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SidebarFooter({ signOut }: { signOut: () => void }) {
  const { user } = useContext(UserContext)!;
  const { currentOrg, isCurrentOrgAdmin } = useOrg();
  const initials =
    (user.signInDetails?.loginId ?? user.username ?? 'U')
      .slice(0, 2)
      .toUpperCase();
  const email = user.signInDetails?.loginId ?? user.username ?? '';

  return (
    <div
      style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 9,
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'rgba(77,143,110,0.4)',
          border: '1.5px solid var(--ss-accent)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 11,
          fontWeight: 700,
          color: '#fff',
          flexShrink: 0,
        }}
      >
        {initials}
      </div>
      <div style={{ overflow: 'hidden', flex: 1 }}>
        <div
          style={{
            color: 'rgba(255,255,255,0.8)',
            fontSize: 12,
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {email}
        </div>
        <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 10 }}>
          {currentOrg
            ? isCurrentOrgAdmin
              ? 'Org Admin'
              : 'Annotator'
            : 'No org selected'}
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          flexShrink: 0,
          color: 'rgba(255,255,255,0.5)',
        }}
      >
        <Notifications />
        <Settings signOut={signOut} />
      </div>
    </div>
  );
}

function NoOrgShell({
  signOut,
  children,
}: {
  signOut: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        height: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--ss-content-bg)',
      }}
    >
      <header
        style={{
          padding: '14px 24px',
          background: 'var(--ss-sidebar-bg)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <LogoMark />
          <span style={{ fontWeight: 700, fontSize: 15 }}>SurveyScope</span>
        </div>
        <button
          onClick={signOut}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            borderRadius: 6,
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Sign out
        </button>
      </header>
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          justifyContent: 'center',
          padding: '48px 24px',
        }}
      >
        <div className='ss-card' style={{ maxWidth: 520, width: '100%' }}>
          <h4 style={{ marginBottom: 8 }}>Welcome</h4>
          <p style={{ color: 'var(--ss-text-muted)' }}>
            You are not currently a member of any organisation.
          </p>
          <p style={{ color: 'var(--ss-text-muted)' }}>
            Please visit the{' '}
            <a href='https://wildeyeconservation.org/surveyscope-registration/'>
              WildEye Conservation website
            </a>{' '}
            to register your organisation.
          </p>
          {children}
        </div>
      </main>
    </div>
  );
}
