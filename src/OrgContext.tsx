import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { UserContext, GlobalContext } from './Context';
import type { Schema } from './amplify/client-schema';

export type OrgSummary = {
  id: string;
  name: string;
  isAdmin: boolean;
};

interface OrgContextValue {
  /** The org the user is currently working in (sidebar switcher selection). */
  currentOrg: OrgSummary | null;
  setCurrentOrg: (org: OrgSummary | null) => void;
  /** Every org the user belongs to, via their active memberships. */
  orgs: OrgSummary[];
  /** True if the user is admin of the currently-selected org. */
  isCurrentOrgAdmin: boolean;
}

const OrgContext = createContext<OrgContextValue | null>(null);

const STORAGE_KEY = 'ss_current_org_id';

export function OrgProvider({ children }: { children: ReactNode }) {
  const { myOrganizationHook } = useContext(UserContext)!;
  const { client } = useContext(GlobalContext)!;

  const memberships = myOrganizationHook.data ?? [];
  const [orgDetails, setOrgDetails] = useState<
    Record<string, Schema['Organization']['type']>
  >({});
  const [currentOrgId, setCurrentOrgId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(STORAGE_KEY);
  });

  // Fetch org names (membership only has the id) on demand, cached.
  useEffect(() => {
    const missingIds = memberships
      .map((m) => m.organizationId)
      .filter((id) => !orgDetails[id]);
    if (missingIds.length === 0) return;
    let cancelled = false;
    (async () => {
      const results = await Promise.all(
        missingIds.map((id) => client.models.Organization.get({ id }))
      );
      if (cancelled) return;
      setOrgDetails((prev) => {
        const next = { ...prev };
        for (const result of results) {
          if (result.data) next[result.data.id] = result.data;
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [memberships.map((m) => m.organizationId).join('|'), client.models.Organization, orgDetails]);

  const orgs: OrgSummary[] = useMemo(() => {
    return memberships.map((m) => ({
      id: m.organizationId,
      name: orgDetails[m.organizationId]?.name ?? 'Loading…',
      isAdmin: Boolean(m.isAdmin),
    }));
  }, [memberships, orgDetails]);

  // Default selection: keep stored id if still valid, else first available org.
  useEffect(() => {
    if (orgs.length === 0) return;
    if (currentOrgId && orgs.some((o) => o.id === currentOrgId)) return;
    const fallback = orgs[0];
    setCurrentOrgId(fallback.id);
  }, [orgs, currentOrgId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (currentOrgId) localStorage.setItem(STORAGE_KEY, currentOrgId);
  }, [currentOrgId]);

  const currentOrg = useMemo(() => {
    if (!currentOrgId) return null;
    return orgs.find((o) => o.id === currentOrgId) ?? null;
  }, [currentOrgId, orgs]);

  const value: OrgContextValue = {
    currentOrg,
    setCurrentOrg: (org) => setCurrentOrgId(org?.id ?? null),
    orgs,
    isCurrentOrgAdmin: Boolean(currentOrg?.isAdmin),
  };

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
}

export function useOrg() {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error('useOrg must be used inside <OrgProvider>');
  return ctx;
}
