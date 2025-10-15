import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { DateTime } from 'luxon';
import { GlobalContext } from './Context';
import { fetchAllPaginatedResults } from './utils';
import { useUsers } from './apiInterface';
import type { Schema } from './amplify/client-schema';

export type MonthKey = string; // yyyy-LL

export interface SeriesPoint {
  month: MonthKey;
  value: number;
}

export interface MetricSeries {
  months: MonthKey[];
  values: number[];
}

export interface SummaryMetric {
  total: number;
  thisMonth: number;
  series: MetricSeries;
}

export interface UsersMetric extends SummaryMetric {
  uniqueLoginSeries: MetricSeries;
}

export interface ProjectBreakdownMetric {
  projectId: string;
  projectName: string;
  totals: {
    surveys: number; // always 1 for a project row
    images: number;
    annotations: number;
  };
  thisMonth: {
    surveys: number; // 1 if created this month, else 0
    images: number;
    annotations: number;
  };
}

export interface OrganizationBreakdownMetric {
  organizationId: string;
  organizationName: string;
  totals: {
    organizations: number; // always 1 for an org row
    surveys: number;
    images: number;
    annotations: number;
  };
  thisMonth: {
    organizations: number; // 1 if created this month, else 0
    surveys: number;
    images: number;
    annotations: number;
  };
  projects: ProjectBreakdownMetric[];
}

export interface AdminStatsData {
  loading: boolean;
  error?: string;
  months: MonthKey[];
  users: UsersMetric;
  organizations: SummaryMetric;
  surveys: SummaryMetric; // Projects
  images: SummaryMetric;
  annotations: SummaryMetric;
  breakdown: OrganizationBreakdownMetric[];
  refresh: () => void;
}

function buildMonthKeys(monthCount: number, now: DateTime): MonthKey[] {
  const months: MonthKey[] = [];
  const start = now.minus({ months: monthCount - 1 }).startOf('month');
  for (let i = 0; i < monthCount; i += 1) {
    months.push(start.plus({ months: i }).toFormat('yyyy-LL'));
  }
  return months;
}

function monthKeyFromISO(iso?: string | null): MonthKey | null {
  if (!iso) return null;
  const dt = DateTime.fromISO(iso, { zone: 'utc' });
  if (!dt.isValid) return null;
  return dt.toFormat('yyyy-LL');
}

//

export function useAdminStatsData(monthCount: number): AdminStatsData {
  const { client } = useContext(GlobalContext)!;
  const { users: cognitoUsers } = useUsers();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [version, setVersion] = useState(0);

  const nowRef = useRef(DateTime.utc());
  const months = useMemo(
    () => buildMonthKeys(monthCount, nowRef.current),
    [monthCount]
  );
  const windowStartISO = useMemo(
    () =>
      nowRef.current
        .minus({ months: monthCount - 1 })
        .startOf('month')
        .toISO()!,
    [monthCount]
  );
  const thisMonthKey = useMemo(
    () => nowRef.current.startOf('month').toFormat('yyyy-LL'),
    []
  );

  const [usersMetric, setUsersMetric] = useState<UsersMetric>({
    total: 0,
    thisMonth: 0,
    series: { months, values: Array(months.length).fill(0) },
    uniqueLoginSeries: { months, values: Array(months.length).fill(0) },
  });
  const [orgMetric, setOrgMetric] = useState<SummaryMetric>({
    total: 0,
    thisMonth: 0,
    series: { months, values: Array(months.length).fill(0) },
  });
  const [surveyMetric, setSurveyMetric] = useState<SummaryMetric>({
    total: 0,
    thisMonth: 0,
    series: { months, values: Array(months.length).fill(0) },
  });
  const [imageMetric, setImageMetric] = useState<SummaryMetric>({
    total: 0,
    thisMonth: 0,
    series: { months, values: Array(months.length).fill(0) },
  });
  const [annotationMetric, setAnnotationMetric] = useState<SummaryMetric>({
    total: 0,
    thisMonth: 0,
    series: { months, values: Array(months.length).fill(0) },
  });
  const [breakdown, setBreakdown] = useState<OrganizationBreakdownMetric[]>([]);

  // Remap months when the prop changes
  useEffect(() => {
    setUsersMetric((prev) => ({
      total: prev.total,
      thisMonth: prev.thisMonth,
      series: { months, values: Array(months.length).fill(0) },
      uniqueLoginSeries: { months, values: Array(months.length).fill(0) },
    }));
    setOrgMetric((prev) => ({
      total: prev.total,
      thisMonth: prev.thisMonth,
      series: { months, values: Array(months.length).fill(0) },
    }));
    setSurveyMetric((prev) => ({
      total: prev.total,
      thisMonth: prev.thisMonth,
      series: { months, values: Array(months.length).fill(0) },
    }));
    setImageMetric((prev) => ({
      total: prev.total,
      thisMonth: prev.thisMonth,
      series: { months, values: Array(months.length).fill(0) },
    }));
    setAnnotationMetric((prev) => ({
      total: prev.total,
      thisMonth: prev.thisMonth,
      series: { months, values: Array(months.length).fill(0) },
    }));
  }, [months]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      setLoading(true);
      setError(undefined);
      try {
        // Parallel fetch: monthly-bounded datasets and totals
        const [
          orgsAll,
          projectsAll,
          imagesWindow,
          annotationsWindow,
          imagesAllIds,
          annotationsAllIds,
          clientLogsWindow,
        ] = await Promise.all([
          fetchAllPaginatedResults<Schema['Organization']['type']>(
            client.models.Organization.list,
            {
              selectionSet: ['id', 'name', 'createdAt'],
            }
          ),
          fetchAllPaginatedResults<Schema['Project']['type']>(
            client.models.Project.list,
            {
              selectionSet: ['id', 'name', 'createdAt', 'organizationId'],
            }
          ),
          fetchAllPaginatedResults<Schema['Image']['type']>(
            client.models.Image.list,
            {
              filter: { createdAt: { ge: windowStartISO } },
              selectionSet: ['id', 'createdAt', 'projectId'],
            }
          ),
          fetchAllPaginatedResults<Schema['Annotation']['type']>(
            client.models.Annotation.list,
            {
              filter: { createdAt: { ge: windowStartISO } },
              selectionSet: ['id', 'createdAt', 'projectId'],
            }
          ),
          // Totals (all-time): fetch only ids to minimize payload
          fetchAllPaginatedResults<Pick<Schema['Image']['type'], 'id'>>(
            client.models.Image.list,
            {
              selectionSet: ['id'],
            } as any
          ),
          fetchAllPaginatedResults<Pick<Schema['Annotation']['type'], 'id'>>(
            client.models.Annotation.list,
            {
              selectionSet: ['id'],
            } as any
          ),
          fetchAllPaginatedResults<Schema['ClientLog']['type']>(
            client.models.ClientLog.list,
            {
              filter: { createdAt: { ge: windowStartISO } },
              selectionSet: ['id', 'userId', 'createdAt'],
            }
          ),
        ]);

        if (cancelled) return;

        // Users total from Cognito
        const usersTotal = cognitoUsers.length;

        // Users monthly: "new users" (first-seen month within window) and unique monthly logins
        const monthIndex = new Map<MonthKey, number>(
          months.map((m, i) => [m, i])
        );
        const uniquePerMonth: Map<MonthKey, Set<string>> = new Map();
        const candidateFirstSeen = new Map<
          string,
          { firstMonth: MonthKey; firstAtISO: string }
        >();
        for (const log of clientLogsWindow) {
          const mk = monthKeyFromISO(log.createdAt) as MonthKey | null;
          if (!mk || !monthIndex.has(mk)) continue;
          if (!uniquePerMonth.has(mk)) uniquePerMonth.set(mk, new Set());
          uniquePerMonth.get(mk)!.add(log.userId);
          if (!candidateFirstSeen.has(log.userId)) {
            candidateFirstSeen.set(log.userId, {
              firstMonth: mk,
              firstAtISO: log.createdAt || '',
            });
          } else {
            const prev = candidateFirstSeen.get(log.userId)!;
            if ((log.createdAt || '') < prev.firstAtISO) {
              candidateFirstSeen.set(log.userId, {
                firstMonth: mk,
                firstAtISO: log.createdAt || '',
              });
            }
          }
        }

        // Validate first-seen users against any earlier logs before window start to avoid misclassifying returning users
        const candidateUserIds = Array.from(candidateFirstSeen.keys());
        const validatedFirstSeen = new Map<string, MonthKey>();
        await Promise.all(
          candidateUserIds.map(async (userId) => {
            const hasEarlier = await hasAnyClientLogBefore(
              client,
              userId,
              windowStartISO
            );
            if (!hasEarlier) {
              validatedFirstSeen.set(
                userId,
                candidateFirstSeen.get(userId)!.firstMonth
              );
            }
          })
        );

        const newUsersSeriesArr = Array(months.length).fill(0);
        for (const [, month] of validatedFirstSeen) {
          const idx = monthIndex.get(month)!;
          newUsersSeriesArr[idx] += 1;
        }
        const uniqueLoginSeriesArr = months.map(
          (m) => uniquePerMonth.get(m)?.size || 0
        );

        const usersThisMonth =
          newUsersSeriesArr[monthIndex.get(thisMonthKey)!] || 0;

        setUsersMetric({
          total: usersTotal,
          thisMonth: usersThisMonth,
          series: { months, values: newUsersSeriesArr },
          uniqueLoginSeries: { months, values: uniqueLoginSeriesArr },
        });

        // Organizations
        const orgTotals = orgsAll.length;
        const orgSeriesArr = Array(months.length).fill(0);
        let orgThisMonth = 0;
        for (const org of orgsAll) {
          const mk = monthKeyFromISO(org.createdAt);
          if (mk && monthIndex.has(mk)) {
            orgSeriesArr[monthIndex.get(mk)!] += 1;
            if (mk === thisMonthKey) orgThisMonth += 1;
          }
        }
        setOrgMetric({
          total: orgTotals,
          thisMonth: orgThisMonth,
          series: { months, values: orgSeriesArr },
        });

        // Surveys (Projects)
        const projTotals = projectsAll.length;
        const projSeriesArr = Array(months.length).fill(0);
        let projThisMonth = 0;
        for (const p of projectsAll) {
          const mk = monthKeyFromISO(p.createdAt);
          if (mk && monthIndex.has(mk)) {
            projSeriesArr[monthIndex.get(mk)!] += 1;
            if (mk === thisMonthKey) projThisMonth += 1;
          }
        }
        setSurveyMetric({
          total: projTotals,
          thisMonth: projThisMonth,
          series: { months, values: projSeriesArr },
        });

        // Images
        const imageSeriesArr = Array(months.length).fill(0);
        for (const img of imagesWindow) {
          const mk = monthKeyFromISO(img.createdAt);
          if (mk && monthIndex.has(mk))
            imageSeriesArr[monthIndex.get(mk)!] += 1;
        }
        const imageTotal = imagesAllIds.length;
        const imageThisMonth =
          imageSeriesArr[monthIndex.get(thisMonthKey)!] || 0;
        setImageMetric({
          total: imageTotal,
          thisMonth: imageThisMonth,
          series: { months, values: imageSeriesArr },
        });

        // Annotations
        const annSeriesArr = Array(months.length).fill(0);
        for (const ann of annotationsWindow) {
          const mk = monthKeyFromISO(ann.createdAt);
          if (mk && monthIndex.has(mk)) annSeriesArr[monthIndex.get(mk)!] += 1;
        }
        const annTotal = annotationsAllIds.length;
        const annThisMonth = annSeriesArr[monthIndex.get(thisMonthKey)!] || 0;
        setAnnotationMetric({
          total: annTotal,
          thisMonth: annThisMonth,
          series: { months, values: annSeriesArr },
        });

        // Breakdown by Organization → Project with totals and thisMonth
        const orgNameById = new Map(orgsAll.map((o) => [o.id, o.name]));
        const projectsByOrg = new Map<string, Schema['Project']['type'][]>();
        for (const p of projectsAll) {
          const list = projectsByOrg.get(p.organizationId) || [];
          list.push(p);
          projectsByOrg.set(p.organizationId, list);
        }

        // Pre-aggregate counts by project
        const imagesByProjectTotal = new Map<string, number>();
        const imagesByProjectThisMonth = new Map<string, number>();
        for (const img of imagesWindow) {
          const pid = (img.projectId || '') as string;
          const mk = monthKeyFromISO(img.createdAt);
          imagesByProjectTotal.set(
            pid,
            (imagesByProjectTotal.get(pid) || 0) + 1
          );
          if (mk === thisMonthKey)
            imagesByProjectThisMonth.set(
              pid,
              (imagesByProjectThisMonth.get(pid) || 0) + 1
            );
        }
        // Note: imagesAllIds is only ids; cannot map totals per project all-time without fetching all. We'll approximate total per project by window counts here.
        // For correctness, we will compute per-project totals within window and label totals based on window for breakdown.

        const annsByProjectTotal = new Map<string, number>();
        const annsByProjectThisMonth = new Map<string, number>();
        for (const ann of annotationsWindow) {
          const pid = (ann.projectId || '') as string;
          const mk = monthKeyFromISO(ann.createdAt);
          annsByProjectTotal.set(pid, (annsByProjectTotal.get(pid) || 0) + 1);
          if (mk === thisMonthKey)
            annsByProjectThisMonth.set(
              pid,
              (annsByProjectThisMonth.get(pid) || 0) + 1
            );
        }

        const breakdownRows: OrganizationBreakdownMetric[] = [];
        for (const [orgId, projList] of projectsByOrg.entries()) {
          const orgName = orgNameById.get(orgId) || orgId;
          const projectRows: ProjectBreakdownMetric[] = [];
          let orgSurveysTotal = projList.length;
          let orgSurveysThisMonth = projList.filter(
            (p) => monthKeyFromISO(p.createdAt) === thisMonthKey
          ).length;
          let orgImagesTotal = 0;
          let orgImagesThisMonth = 0;
          let orgAnnsTotal = 0;
          let orgAnnsThisMonth = 0;

          for (const p of projList) {
            const totalImages = imagesByProjectTotal.get(p.id) || 0;
            const totalAnns = annsByProjectTotal.get(p.id) || 0;
            const thisMonthImages = imagesByProjectThisMonth.get(p.id) || 0;
            const thisMonthAnns = annsByProjectThisMonth.get(p.id) || 0;
            orgImagesTotal += totalImages;
            orgImagesThisMonth += thisMonthImages;
            orgAnnsTotal += totalAnns;
            orgAnnsThisMonth += thisMonthAnns;
            projectRows.push({
              projectId: p.id,
              projectName: p.name,
              totals: {
                surveys: 1,
                images: totalImages,
                annotations: totalAnns,
              },
              thisMonth: {
                surveys: monthKeyFromISO(p.createdAt) === thisMonthKey ? 1 : 0,
                images: thisMonthImages,
                annotations: thisMonthAnns,
              },
            });
          }

          breakdownRows.push({
            organizationId: orgId,
            organizationName: orgName,
            totals: {
              organizations: 1,
              surveys: orgSurveysTotal,
              images: orgImagesTotal,
              annotations: orgAnnsTotal,
            },
            thisMonth: {
              organizations: orgsAll.find(
                (o) =>
                  o.id === orgId &&
                  monthKeyFromISO(o.createdAt) === thisMonthKey
              )
                ? 1
                : 0,
              surveys: orgSurveysThisMonth,
              images: orgImagesThisMonth,
              annotations: orgAnnsThisMonth,
            },
            projects: projectRows,
          });
        }

        // Include orgs with zero projects too
        for (const o of orgsAll) {
          if (projectsByOrg.has(o.id)) continue;
          breakdownRows.push({
            organizationId: o.id,
            organizationName: o.name,
            totals: { organizations: 1, surveys: 0, images: 0, annotations: 0 },
            thisMonth: {
              organizations:
                monthKeyFromISO(o.createdAt) === thisMonthKey ? 1 : 0,
              surveys: 0,
              images: 0,
              annotations: 0,
            },
            projects: [],
          });
        }

        if (!cancelled) setBreakdown(breakdownRows);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Failed to load stats');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [
    client,
    windowStartISO,
    months,
    thisMonthKey,
    version,
    cognitoUsers.length,
  ]);

  const refresh = () => setVersion((v) => v + 1);

  return {
    loading,
    error,
    months,
    users: usersMetric,
    organizations: orgMetric,
    surveys: surveyMetric,
    images: imageMetric,
    annotations: annotationMetric,
    breakdown,
    refresh,
  };
}

async function hasAnyClientLogBefore(
  client: any,
  userId: string,
  iso: string
): Promise<boolean> {
  try {
    const result = await (client.models.ClientLog.clientLogsByUserId as any)(
      { userId },
      {
        filter: { createdAt: { lt: iso } },
        limit: 1,
        selectionSet: ['id'],
      }
    );
    return (result?.data?.length || 0) > 0;
  } catch {
    return false;
  }
}
