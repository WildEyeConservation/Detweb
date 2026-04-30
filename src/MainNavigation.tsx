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
  Search,
  ClipboardList,
  Briefcase,
  BarChart3,
  Users,
  FlaskConical,
  Settings2,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react';
import { fetchUserAttributes } from 'aws-amplify/auth';
import { ProgressIndicators } from './ProgressIndicators.jsx';
import Notifications from './user/Notifications.tsx';
import Settings from './user/Settings.tsx';
import UploadStatusButton from './upload/UploadsPanel.tsx';
import { UserContext, GlobalContext } from './Context.tsx';
import { useOrg, OrgSummary } from './OrgContext';
import { verifyToken } from './utils/jwt.ts';
import { useQueryClient } from '@tanstack/react-query';
import { AnnotateShell } from './ss/AnnotateChrome.tsx';
import {
  OrgInvite,
  useOrgInvitations,
  useRespondToInvite,
} from './user/useOrgInvitations';

type NavDef = {
  id: string;
  label: string;
  to: string;
  icon: LucideIcon;
  requires?: 'orgadmin' | 'sysadmin' | 'surveyAdmin';
};

type NavSection = {
  section: string;
  items: NavDef[];
};

const NAV: NavSection[] = [
  {
    section: 'Surveys',
    items: [
      {
        id: 'surveys',
        label: 'Surveys',
        to: '/surveys',
        icon: ClipboardList,
        requires: 'surveyAdmin',
      },
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
  const { isCurrentOrgAdmin, currentOrg } = useOrg();
  const queryClient = useQueryClient();
  const { client } = useContext(GlobalContext)!;
  const [, setCheckingToken] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem('ss-sidebar-collapsed') === 'true'
  );
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('ss-sidebar-collapsed', String(collapsed));
    document.body.classList.toggle('ss-sidebar-collapsed', collapsed);
    return () => document.body.classList.remove('ss-sidebar-collapsed');
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMobileOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  const myAdminProjects = myProjectsHook.data?.filter((p) => p.isAdmin) ?? [];
  const hasAdminProjectsInCurrentOrg = myAdminProjects.some(
    (p) => p.group === currentOrg?.id
  );
  const belongsToOrganization = myOrganizationHook.data.length > 0;

  useEffect(() => {
    setIsAnnotatePath(
      /^\/surveys\/[^/]+\/annotate$/.test(location.pathname) ||
        /^\/surveys\/[^/]+\/qc-review\/[^/]+$/.test(location.pathname) ||
        /^\/surveys\/[^/]+\/homography\/[^/]+$/.test(location.pathname) ||
        /^\/surveys\/[^/]+\/registration$/.test(location.pathname) ||
        /^\/surveys\/[^/]+\/set\/[^/]+\/registration$/.test(location.pathname)
    );
  }, [location.pathname]);

  const canAccessSurveys = isCurrentOrgAdmin || hasAdminProjectsInCurrentOrg;

  useEffect(() => {
    if (
      belongsToOrganization &&
      (location.pathname === '' ||
        location.pathname === '/')
    ) {
      navigate(canAccessSurveys ? '/surveys' : '/jobs');
    }
  }, [canAccessSurveys, belongsToOrganization]);

  useEffect(() => {
    if (!belongsToOrganization || canAccessSurveys) return;
    if (!location.pathname.startsWith('/surveys')) return;
    const isAnnotateSubroute =
      /^\/surveys\/[^/]+\/annotate$/.test(location.pathname) ||
      /^\/surveys\/[^/]+\/qc-review\/[^/]+$/.test(location.pathname) ||
      /^\/surveys\/[^/]+\/homography\/[^/]+$/.test(location.pathname) ||
      /^\/surveys\/[^/]+\/registration$/.test(location.pathname) ||
      /^\/surveys\/[^/]+\/set\/[^/]+\/registration$/.test(location.pathname);
    if (isAnnotateSubroute) return;
    navigate('/jobs');
  }, [canAccessSurveys, belongsToOrganization, location.pathname]);

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
      <NoOrgShell signOut={signOut} />
    );
  }

  if (isAnnotatePath) {
    // Annotate/QC/homography screens use a presentational top bar instead
    // of the sidebar, with portal slots for per-page action items.
    return <AnnotateShell />;
  }

  const activeId = resolveActiveNavId(location.pathname);

  const sidebarClass = [
    'ss-sidebar',
    collapsed ? 'collapsed' : '',
    mobileOpen ? 'mobile-open' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className='ss-app-shell'>
      <header className='ss-mobile-topbar'>
        <button
          className='ss-mobile-topbar-burger'
          onClick={() => setMobileOpen(true)}
          aria-label='Open navigation'
        >
          <Menu size={18} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src='/Logo.png' alt='Logo' style={{ height: 24 }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>SurveyScope</span>
        </div>
      </header>

      <div
        className={`ss-sidebar-backdrop${mobileOpen ? ' visible' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <aside className={sidebarClass}>
        <SidebarHeader
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((c) => !c)}
          onCloseMobile={() => setMobileOpen(false)}
        />
        <OrgSwitcher
          collapsed={collapsed}
          onExpand={() => setCollapsed(false)}
        />

        <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {NAV.map((section) => {
            const items = section.items.filter((item) =>
              canShow(item, {
                isOrgAdmin: isOrganizationAdmin,
                isCurrentOrgAdmin,
                hasAdminProjectsInCurrentOrg,
                cognitoGroups,
              })
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
                    collapsed={collapsed}
                  />
                ))}
              </div>
            );
          })}

          {cognitoGroups.includes('sysadmin') && (
            <div
              className='ss-sidebar-system-group'
              style={{
                margin: '10px 10px 4px',
                borderTop: '1px solid rgba(255,255,255,0.07)',
                paddingTop: 10,
              }}
            >
              <div
                className='ss-sidebar-section-label'
                style={{ padding: '0 4px 4px' }}
              >
                <span style={{ color: 'rgba(255,255,255,0.22)' }}>System</span>
              </div>
              {SYSTEM_NAV.map((item) => (
                <SidebarNavItem
                  key={item.id}
                  item={item}
                  active={activeId === item.id}
                  collapsed={collapsed}
                  muted
                />
              ))}
            </div>
          )}
        </nav>

        <SidebarFooter signOut={signOut} collapsed={collapsed} />
      </aside>

      {collapsed && (
        <div className='ss-sidebar-rail ss-desktop-only'>
          <button
            type='button'
            onClick={() => setCollapsed(false)}
            aria-label='Expand sidebar'
            title='Expand sidebar'
            className='ss-sidebar-rail-btn'
          >
            <PanelLeftOpen size={15} />
          </button>
        </div>
      )}

      <section className='ss-content'>
        <div className='ss-content-scroll'>
          <Outlet />
        </div>
        <ProgressIndicators />
      </section>
    </div>
  );
}

function canShow(
  item: NavDef,
  ctx: {
    isOrgAdmin: boolean;
    isCurrentOrgAdmin: boolean;
    hasAdminProjectsInCurrentOrg: boolean;
    cognitoGroups: string[];
  }
): boolean {
  if (item.requires === 'orgadmin' && !ctx.isCurrentOrgAdmin) return false;
  if (item.requires === 'sysadmin' && !ctx.cognitoGroups.includes('sysadmin'))
    return false;
  if (
    item.requires === 'surveyAdmin' &&
    !ctx.isCurrentOrgAdmin &&
    !ctx.hasAdminProjectsInCurrentOrg
  )
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

function SidebarHeader({
  collapsed,
  onToggleCollapse,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCloseMobile: () => void;
}) {
  return (
    <div
      style={{
        padding: collapsed ? '14px 8px' : '18px 12px 14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        justifyContent: collapsed ? 'center' : 'space-between',
        position: 'relative',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
        <img
          src='/Logo.png'
          alt='Logo'
          style={{ height: '32px', flexShrink: 0 }}
        />
        {!collapsed && (
          <div className='ss-sidebar-collapse-hide' style={{ minWidth: 0 }}>
            <div
              style={{
                color: '#fff',
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
              }}
            >
              SurveyScope
            </div>
            <div
              style={{
                color: 'rgba(255,255,255,0.35)',
                fontSize: 10,
                whiteSpace: 'nowrap',
              }}
            >
              AI Aerial-Census Software
            </div>
          </div>
        )}
      </div>
      {!collapsed && (
        <button
          onClick={onToggleCollapse}
          aria-label='Collapse sidebar'
          title='Collapse sidebar'
          className='ss-sidebar-icon-btn ss-desktop-only'
        >
          <PanelLeftClose size={15} />
        </button>
      )}
      <button
        onClick={onCloseMobile}
        aria-label='Close navigation'
        className='ss-sidebar-icon-btn ss-mobile-only'
      >
        <X size={16} />
      </button>
    </div>
  );
}

function SidebarNavItem({
  item,
  active,
  collapsed = false,
  muted = false,
}: {
  item: NavDef;
  active: boolean;
  collapsed?: boolean;
  muted?: boolean;
}) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      className={`ss-nav-item ${active ? 'active' : ''}`}
      title={collapsed ? item.label : undefined}
      style={
        muted && !active
          ? { color: 'rgba(255,255,255,0.32)' }
          : undefined
      }
    >
      <span className='ss-nav-icon'>
        <Icon size={15} />
      </span>
      <span className='ss-nav-label'>{item.label}</span>
      {active && !collapsed && (
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

function OrgSwitcher({
  collapsed,
  onExpand,
}: {
  collapsed: boolean;
  onExpand: () => void;
}) {
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

  if (collapsed) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          padding: '10px 0 4px',
        }}
      >
        <div
          onClick={onExpand}
          title={currentOrg?.name ?? 'Select organisation'}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'rgba(77,143,110,0.27)',
            border: '1px solid rgba(77,143,110,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            fontWeight: 700,
            color: '#fff',
            cursor: 'pointer',
          }}
        >
          {currentOrg?.name?.[0]?.toUpperCase() ?? '?'}
        </div>
      </div>
    );
  }

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
                {org.isAdmin && (
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                    Admin
                  </div>
                )}
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

function SidebarFooter({
  signOut,
  collapsed,
}: {
  signOut: () => void;
  collapsed: boolean;
}) {
  const { user } = useContext(UserContext)!;
  const initials =
    (user.signInDetails?.loginId ?? user.username ?? 'U')
      .slice(0, 2)
      .toUpperCase();
  const email = user.signInDetails?.loginId ?? user.username ?? '';

  if (collapsed) {
    return (
      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.07)',
          padding: '10px 0',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <div
          title={email}
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
          }}
        >
          {initials}
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 4,
            color: 'rgba(255,255,255,0.5)',
          }}
        >
          <UploadStatusButton />
          <Notifications />
          <Settings signOut={signOut} />
        </div>
      </div>
    );
  }

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
        <UploadStatusButton />
        <Notifications />
        <Settings signOut={signOut} />
      </div>
    </div>
  );
}

function NoOrgShell({
  signOut,
}: {
  signOut: () => void;
}) {
  const { pendingInvites, queryKey } = useOrgInvitations();
  const { user } = useContext(UserContext)!;
  const hasInvites = pendingInvites.length > 0;

  const [attrs, setAttrs] = useState<{ email?: string }>({});
  useEffect(() => {
    fetchUserAttributes().then((a) => setAttrs({ email: a.email }));
  }, []);

  const displayEmail = attrs.email ?? user.signInDetails?.loginId;

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src='/Logo.png' alt='Logo' style={{ height: 24 }} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>SurveyScope</span>
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
          overflowY: 'auto',
          display: 'flex',
          justifyContent: 'center',
          padding: '48px 24px',
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          <div className='ss-card'>
            <h4 style={{ marginBottom: 8 }}>Welcome</h4>
            {hasInvites ? (
              <p style={{ color: 'var(--ss-text-muted)', marginBottom: 12 }}>
                You have {pendingInvites.length} pending organisation{' '}
                {pendingInvites.length === 1 ? 'invitation' : 'invitations'}.
                Accept one below to get started.
              </p>
            ) : (
              <>
                <p style={{ color: 'var(--ss-text-muted)' }}>
                  You are not currently a member of any organisation.
                </p>
                <p style={{ color: 'var(--ss-text-muted)', marginBottom: 12 }}>
                  Ask your organisation admin to invite you using the account
                  details below, or visit the{' '}
                  <a href='https://wildeyeconservation.org/surveyscope-registration/'>
                    WildEye Conservation website
                  </a>{' '}
                  to register your organisation.
                </p>
              </>
            )}
            <div
              style={{
                background: 'var(--ss-surface-alt)',
                border: '1px solid var(--ss-border-soft)',
                borderRadius: 8,
                padding: '10px 12px',
                fontSize: 13,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              <div>
                <strong>Your email:</strong>{' '}
                {displayEmail ?? (
                  <span style={{ color: 'var(--ss-text-muted)' }}>—</span>
                )}
              </div>
            </div>
          </div>

          {hasInvites && (
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              {pendingInvites.map((invite) => (
                <InviteCardLight
                  key={invite.id}
                  invite={invite}
                  queryKey={queryKey}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function InviteCardLight({
  invite,
  queryKey,
}: {
  invite: OrgInvite;
  queryKey: readonly unknown[];
}) {
  const { accept, decline, responding } = useRespondToInvite(invite, queryKey);

  const organizationName =
    (invite as { organizationName?: string }).organizationName ??
    'Unknown organisation';

  return (
    <div
      className='ss-card'
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--ss-text-muted)',
            marginBottom: 4,
          }}
        >
          Organisation invite
        </div>
        <div
          style={{
            fontSize: 16,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={organizationName}
        >
          {organizationName}
        </div>
        <div
          style={{
            color: 'var(--ss-text-muted)',
            fontSize: 13,
            marginTop: 2,
            lineHeight: 1.4,
          }}
        >
          invited you to join their organisation.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type='button'
          className='btn btn-outline-secondary btn-sm'
          onClick={decline}
          disabled={responding}
        >
          <X size={14} style={{ marginRight: 4, verticalAlign: '-2px' }} />
          Decline
        </button>
        <button
          type='button'
          className='btn btn-primary btn-sm'
          onClick={accept}
          disabled={responding}
        >
          <Check size={14} style={{ marginRight: 4, verticalAlign: '-2px' }} />
          Accept
        </button>
      </div>
    </div>
  );
}
