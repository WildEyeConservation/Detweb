import { useContext, useEffect, useState } from 'react';
import { GlobalContext, UserContext } from './Context';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import type { UserStatsType } from './schemaTypes';
import exportFromJSON from 'export-from-json';
import { useUsers } from './apiInterface';
import Select from 'react-select';
import { Button, Spinner } from 'react-bootstrap';
import { Page, PageHeader, ContentArea, StatCard } from './ss/PageShell';
import SnapshotStatsModal from './SnapshotStatsModal';
import { fetchAllPaginatedResults } from './utils';

export default function UserStats() {
  const { myOrganizationHook, myMembershipHook } =
    useContext(UserContext)!;
  const { client, modalToShow, showModal } =
    useContext(GlobalContext)!;
  const { users: allUsers } = useUsers();
  const [projects, setProjects] = useState<
    {
      id: string;
      name: string;
      annotationSets?: { id: string; name: string }[];
      organization: { name: string };
    }[]
  >([]);
  const [project, setProject] = useState<{
    label: string;
    value: string;
  } | null>(null);
  const [stats, setStats] = useState<
    Record<
      string,
      { observationCount: number; annotationCount: number; activeTime: number; sightingCount: number; searchTime: number; annotationTime: number; waitingTime: number }
    >
  >({});
  const [startDate, setStartDate] = useState<Date | null>(new Date());
  const [endDate, setEndDate] = useState<Date | null>(new Date());
  const [userStats, setUserStats] = useState<UserStatsType[]>([]);

  const [selectedSets, setSelectedSets] = useState<
    | {
      label: string;
      value: string;
    }[]
    | undefined
  >([]);

  // State for export loading
  const [exporting, setExporting] = useState(false);
  // State for initial fetch loading
  const [loadingStats, setLoadingStats] = useState(true);

  // Check if user is admin for the selected project
  const isProjectAdmin = project
    ? myMembershipHook.data?.find((m) => m.projectId === project.value)
      ?.isAdmin || false
    : false;

  const startString = startDate
    ? `${startDate?.getFullYear()}-${String(startDate?.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(startDate?.getDate()).padStart(2, '0')}`
    : null;
  const endString = endDate
    ? `${endDate?.getFullYear()}-${String(endDate?.getMonth() + 1).padStart(
      2,
      '0'
    )}-${String(endDate?.getDate()).padStart(2, '0')}`
    : null;

  useEffect(() => {
    async function loadProjects() {
      const userProjects = [
        ...new Set(myMembershipHook.data?.map((m) => m.projectId) || []),
      ];

      const projectPromises = userProjects.map((projectId) =>
        client.models.Project.get(
          { id: projectId },
          {
            selectionSet: [
              'id',
              'name',
              'annotationSets.id',
              'annotationSets.name',
              'organization.name',
            ] as string[],
          }
        )
      );

      const projectResults = await Promise.all(projectPromises);
      const validProjects = projectResults
        .map((result) => result.data)
        .filter(
          (project): project is NonNullable<typeof project> => project !== null
        );

      setProjects(validProjects as typeof projects);
    }

    loadProjects();
  }, [myOrganizationHook.data]);

  // Rapid fetch for initial data, then individual subscriptions for updates
  useEffect(() => {
    let cancelled = false;
    const subs: { unsubscribe: () => void }[] = [];

    // Reset state when selectedSets changes
    setUserStats([]);
    setLoadingStats(true);

    // Rapid fetch for initial data - only when annotation sets are selected
    async function rapidFetch() {
      // Only fetch if we have selected sets
      if (!selectedSets || selectedSets.length === 0) {
        setLoadingStats(false);
        return;
      }

      try {
        // Build filter for selected setIds
        const setIdConditions = selectedSets.map((set) => ({
          setId: { eq: set.value },
        }));
        const filter = { or: setIdConditions };

        const fetched = await fetchAllPaginatedResults<UserStatsType>(
          client.models.UserStats.list,
          { filter, limit: 10000 }
        );
        if (!cancelled) {
          setUserStats(fetched);
          setLoadingStats(false);
        }
      } catch (error) {
        console.error('Error fetching UserStats:', error);
        if (!cancelled) {
          setLoadingStats(false);
        }
      }
    }

    rapidFetch();

    // onCreate - add new item (or replace if exists)
    subs.push(
      client.models.UserStats.onCreate().subscribe({
        next: (newItem) => {
          if (!cancelled && newItem) {
            setUserStats((prev) => {
              // Check if already exists by composite key
              const exists = prev.some(
                (s) =>
                  s.userId === newItem.userId &&
                  s.date === newItem.date &&
                  s.setId === newItem.setId &&
                  s.projectId === newItem.projectId
              );
              if (exists) {
                return prev.map((s) =>
                  s.userId === newItem.userId &&
                    s.date === newItem.date &&
                    s.setId === newItem.setId &&
                    s.projectId === newItem.projectId
                    ? { ...s, ...newItem }
                    : s
                );
              }
              return [...prev, newItem];
            });
          }
        },
        error: (error) => console.error('UserStats onCreate error:', error),
      })
    );

    // onUpdate - replace existing item by composite key
    subs.push(
      client.models.UserStats.onUpdate().subscribe({
        next: (updatedItem) => {
          if (!cancelled && updatedItem) {
            setUserStats((prev) =>
              prev.map((s) =>
                s.userId === updatedItem.userId &&
                  s.date === updatedItem.date &&
                  s.setId === updatedItem.setId &&
                  s.projectId === updatedItem.projectId
                  ? { ...s, ...updatedItem }
                  : s
              )
            );
          }
        },
        error: (error) => console.error('UserStats onUpdate error:', error),
      })
    );

    // Subscribe to real-time updates via custom pub/sub channels per annotation set
    // if (selectedSets && selectedSets.length > 0) {
    //   for (const set of selectedSets) {
    //     subs.push(
    //       client.subscriptions
    //         .receive({ namePrefix: `${set.value}-userstats` })
    //         .subscribe({
    //           next: (event) => {
    //             if (!cancelled && event?.content) {
    //               try {
    //                 const data = JSON.parse(event.content) as UserStatsType;
    //                 setUserStats((prev) => {
    //                   const exists = prev.some(
    //                     (s) =>
    //                       s.userId === data.userId &&
    //                       s.date === data.date &&
    //                       s.setId === data.setId &&
    //                       s.projectId === data.projectId
    //                   );
    //                   if (exists) {
    //                     return prev.map((s) =>
    //                       s.userId === data.userId &&
    //                         s.date === data.date &&
    //                         s.setId === data.setId &&
    //                         s.projectId === data.projectId
    //                         ? { ...s, ...data }
    //                         : s
    //                     );
    //                   }
    //                   return [...prev, data];
    //                 });
    //               } catch (e) {
    //                 console.error('Failed to parse userstats message:', e);
    //               }
    //             }
    //           },
    //           error: (error) =>
    //             console.error('UserStats receive error:', error),
    //         })
    //     );
    //   }
    // }

    return () => {
      cancelled = true;
      subs.forEach((sub) => sub.unsubscribe());
    };
  }, [client, selectedSets]);

  useEffect(() => {
    // Compute all stats synchronously, then set state once
    const newStats: typeof stats = {};

    if (project && selectedSets && selectedSets.length > 0) {
      userStats
        .filter((s) => s != null)
        .forEach((s) => {
          if (
            !startString ||
            (s.date >= startString && (!endString || s.date <= endString))
          ) {
            if (selectedSets.some((set) => set.value === s.setId)) {
              if (!newStats[s.userId]) {
                newStats[s.userId] = {
                  observationCount: 0,
                  annotationCount: 0,
                  activeTime: 0,
                  sightingCount: 0,
                  searchTime: 0,
                  annotationTime: 0,
                  waitingTime: 0,
                };
              }
              newStats[s.userId].observationCount += s.observationCount;
              newStats[s.userId].annotationCount = Math.max(
                0,
                newStats[s.userId].annotationCount + s.annotationCount
              );
              newStats[s.userId].activeTime += s.activeTime;
              newStats[s.userId].sightingCount += s.sightingCount || 0;
              newStats[s.userId].searchTime += s.searchTime || 0;
              newStats[s.userId].annotationTime += s.annotationTime || 0;
              newStats[s.userId].waitingTime += s.waitingTime || 0;
            }
          }
        });
    }

    setStats(newStats);
  }, [project, startDate, endDate, userStats, selectedSets]);

  // Format duration in milliseconds to H:MM:SS format
  const formatDuration = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const tableRows = Object.keys(stats).map((userId) => ({
    id: userId,
    username: allUsers.find((u) => u.id == userId)?.name || userId,
    timeSpent: formatDuration(stats[userId].activeTime),
    jobsCompleted: stats[userId].observationCount,
    avgSearch: (
      stats[userId].searchTime / 1000 / stats[userId].observationCount || 0
    ).toFixed(1),
    totalAnnotations: Math.max(0, stats[userId].annotationCount),
    totalSightings: stats[userId].sightingCount,
    totalSearchTime: formatDuration(stats[userId].searchTime),
    totalAnnotationTime: formatDuration(stats[userId].annotationTime),
    locsPerSighting: (
      stats[userId].observationCount / stats[userId].sightingCount || 0
    ).toFixed(1),
    waitingTime: formatDuration(stats[userId].waitingTime),
  }));

  async function queryObservations(
    annotationSetId: string,
    lowerLimitOverride?: string,
    upperLimitOverride?: string
  ): Promise<any[]> {
    const lower = lowerLimitOverride ?? `${startString}T00:00:00Z`;
    const upper = upperLimitOverride ?? `${endString}T23:59:59Z`;
    const allObs = await fetchAllPaginatedResults(
      client.models.Observation.observationsByAnnotationSetId,
      {
        annotationSetId,
        createdAt: { between: [lower, upper] },
        limit: 10000,
        selectionSet: [
          'createdAt', 'annotationCount', 'timeTaken', 'waitingTime', 'owner', 'locationId',
          'location.id', 'location.confidence',
        ] as const,
      }
    );
    return allObs.map(o => ({
      createdAt: o.createdAt,
      annotationCount: o.annotationCount,
      timeTaken: o.timeTaken,
      waitingTime: o.waitingTime,
      owner: o.owner,
      locationId: o.locationId,
      confidence: (o as any).location?.confidence ?? null,
    }));
  }

  const handleExportDetailedStats = () => {
    if (!project || !selectedSets || selectedSets.length === 0) return;

    const setLabelMap = new Map(selectedSets.map((s) => [s.value, s.label]));
    const userLookup = new Map(allUsers.map((u) => [u.id, u.name]));

    const filtered = userStats
      .filter((s) => s != null)
      .filter((s) => {
        if (!selectedSets.some((set) => set.value === s.setId)) return false;
        if (startString && s.date < startString) return false;
        if (endString && s.date > endString) return false;
        return true;
      });

    const rows = filtered
      .map((s) => ({
        date: s.date,
        username: userLookup.get(s.userId) || s.userId,
        annotationSet: setLabelMap.get(s.setId) || s.setId,
        time_spent: formatDuration(s.activeTime),
        activeTime_ms: s.activeTime,
        jobs_completed: s.observationCount,
        avg_search_s_per_job:
          s.observationCount > 0
            ? ((s.searchTime || 0) / s.observationCount / 1000).toFixed(1)
            : '0.0',
        total_annotations: Math.max(0, s.annotationCount),
        total_sightings: s.sightingCount || 0,
        total_search_time: formatDuration(s.searchTime || 0),
        searchTime_ms: s.searchTime || 0,
        total_annotation_time: formatDuration(s.annotationTime || 0),
        annotationTime_ms: s.annotationTime || 0,
        locations_per_sighting:
          (s.sightingCount || 0) > 0
            ? (s.observationCount / s.sightingCount!).toFixed(1)
            : '0.0',
        waiting_time: formatDuration(s.waitingTime || 0),
        waitingTime_ms: s.waitingTime || 0,
      }))
      .sort((a, b) =>
        a.date < b.date ? -1 : a.date > b.date ? 1 : a.username < b.username ? -1 : 1
      );

    const fileName =
      `${project.label}_DetailedStats_${startString || 'all'}_${endString || 'all'}`.replace(
        / /g,
        '_'
      );
    exportFromJSON({ data: rows, fileName, exportType: exportFromJSON.types.csv });
  };

  const handleExportData = async () => {
    // Start export loading
    setExporting(true);
    try {
      const userLookup = new Map<string, string>();
      allUsers.forEach((u) => {
        userLookup.set(u.id, u.name || u.id);
        userLookup.set(u.id + '::' + u.id, u.name || u.id);
      });
      for (const annotationSetId of selectedSets?.map((s) => s.value) || []) {
        const observations = await queryObservations(annotationSetId);
        const fileName =
          `${project?.label}_Observations_${startString}_${endString}`.replace(
            / /g,
            '_'
          );
        const exportType = exportFromJSON.types.csv;
        exportFromJSON({
          data: observations.map((o) => {
            const { confidence, ...rest } = o;
            return {
              ...rest,
              annotationCount: Math.max(0, o.annotationCount || 0),
              owner: userLookup.get(o.owner),
              locationConfidence: confidence,
            };
          }),
          fileName,
          exportType,
        });
      }
    } finally {
      // End export loading
      setExporting(false);
    }
  };

  const statsTotals = Object.values(stats).reduce(
    (acc, s) => {
      acc.observationCount += s.observationCount;
      acc.annotationCount += Math.max(0, s.annotationCount);
      acc.sightingCount += s.sightingCount;
      return acc;
    },
    { observationCount: 0, annotationCount: 0, sightingCount: 0 }
  );

  const hasStats = !loadingStats && Object.keys(stats).length > 0;

  return (
    <Page>
      <PageHeader title='Activity' />
      <ContentArea style={{ paddingTop: 12 }}>
        <div className='ss-card' style={{ padding: 16, marginBottom: 16 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                htmlFor='start-date'
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--ss-text-dim)',
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                From
              </label>
              <DatePicker
                id='start-date'
                selected={startDate ?? undefined}
                onChange={(date) => setStartDate(date)}
                selectsStart
                startDate={startDate ?? undefined}
                endDate={endDate ?? undefined}
                className='form-control'
                isClearable
                dateFormat='yyyy/MM/dd'
                placeholderText='No start date'
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                htmlFor='end-date'
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--ss-text-dim)',
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                To
              </label>
              <DatePicker
                id='end-date'
                selected={endDate ?? undefined}
                onChange={(date) => setEndDate(date)}
                selectsEnd
                startDate={startDate ?? undefined}
                endDate={endDate ?? undefined}
                className='form-control'
                isClearable
                dateFormat='yyyy/MM/dd'
                placeholderText='No end date'
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--ss-text-dim)',
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                Survey
              </label>
              <Select
                className='text-black'
                value={project}
                options={projects.map((p) => ({
                  label: `${p.name} (${p.organization.name})`,
                  value: p.id,
                }))}
                onChange={(e) => {
                  setProject(e);
                  const sets = projects
                    .find((p) => p.id === e?.value)
                    ?.annotationSets?.map((s) => ({ label: s.name, value: s.id })) || [];
                  setSelectedSets(sets);
                }}
                menuPortalTarget={document.body}
                menuPosition='fixed'
                styles={{
                  valueContainer: (base) => ({
                    ...base,
                    overflowY: 'auto',
                  }),
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  color: 'var(--ss-text-dim)',
                  fontWeight: 600,
                  margin: 0,
                }}
              >
                Annotation Sets
              </label>
              <Select
                className='text-black basic-multi-select'
                value={selectedSets}
                onChange={(e) => setSelectedSets([...e])}
                isMulti
                name='Annotation sets'
                options={
                  projects
                    .find((p) => p.id == project?.value)
                    ?.annotationSets?.map((s) => ({
                      label: s.name,
                      value: s.id,
                    })) || []
                }
                classNamePrefix='select'
                closeMenuOnSelect={false}
                menuPortalTarget={document.body}
                menuPosition='fixed'
                styles={{
                  valueContainer: (base) => ({
                    ...base,
                    overflowY: 'auto',
                  }),
                  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                }}
              />
            </div>
          </div>
        </div>

        {hasStats && (
          <div
            style={{
              display: 'flex',
              gap: 12,
              marginBottom: 16,
              flexWrap: 'wrap',
            }}
          >
            <StatCard
              num={statsTotals.observationCount.toLocaleString()}
              label='Jobs Completed'
            />
            <StatCard
              num={statsTotals.annotationCount.toLocaleString()}
              label='Total Annotations'
            />
            <StatCard
              num={statsTotals.sightingCount.toLocaleString()}
              label='Total Sightings'
            />
          </div>
        )}

        <div className='ss-card' style={{ padding: 0, overflow: 'hidden' }}>
          {loadingStats ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                padding: 48,
                gap: 12,
              }}
            >
              <Spinner animation='border' role='status' size='sm'>
                <span className='visually-hidden'>Loading stats...</span>
              </Spinner>
              <span style={{ fontSize: 13, color: 'var(--ss-text-dim)' }}>
                Loading stats...
              </span>
            </div>
          ) : tableRows.length === 0 ? (
            <div
              style={{
                padding: 48,
                textAlign: 'center',
                color: 'var(--ss-text-dim)',
                fontSize: 13,
              }}
            >
              {project && selectedSets && selectedSets.length > 0
                ? 'No stats found'
                : 'Select a survey and annotation sets to view stats'}
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <table className='ss-data-table'>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Time Spent</th>
                    <th>Jobs Completed</th>
                    <th>Avg Search (s/job)</th>
                    <th>Total Annotations</th>
                    <th>Total Sightings</th>
                    <th>Total Search Time</th>
                    <th>Total Annotation Time</th>
                    <th>Locs / Sighting</th>
                    <th>Waiting Time</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 500 }}>{r.username}</td>
                      <td>{r.timeSpent}</td>
                      <td>{r.jobsCompleted}</td>
                      <td>{r.avgSearch}</td>
                      <td>{r.totalAnnotations}</td>
                      <td>{r.totalSightings}</td>
                      <td>{r.totalSearchTime}</td>
                      <td>{r.totalAnnotationTime}</td>
                      <td>{r.locsPerSighting}</td>
                      <td>{r.waitingTime}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {isProjectAdmin && selectedSets && selectedSets.length > 0 && !loadingStats && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-start',
              gap: 8,
              marginTop: 16,
              flexWrap: 'wrap',
            }}
          >
            <Button
              size='sm'
              variant='primary'
              onClick={() => showModal('snapshotStats')}
              disabled={!project || !selectedSets?.length}
            >
              Snapshot
            </Button>
            <Button
              size='sm'
              variant='secondary'
              onClick={handleExportDetailedStats}
              disabled={!project || !selectedSets?.length || loadingStats}
            >
              Export Daily Stats
            </Button>
            <Button
              size='sm'
              variant='secondary'
              onClick={handleExportData}
              disabled={exporting}
            >
              {exporting ? 'Loading…' : 'Export Raw Observation Data'}
            </Button>
          </div>
        )}
      </ContentArea>
      <SnapshotStatsModal
        show={modalToShow === 'snapshotStats'}
        onHide={() => showModal(null)}
        projectLabel={project?.label}
        startDate={startDate}
        endDate={endDate}
        startString={startString}
        endString={endString}
        selectedSets={selectedSets}
        allUsers={allUsers.map((u) => ({ id: u.id, name: u.name || u.id }))}
        queryObservations={queryObservations}
      />
    </Page>
  );
}
