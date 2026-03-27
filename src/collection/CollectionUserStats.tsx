import { useContext, useEffect, useState, useMemo } from 'react';
import { Card, Button, Spinner } from 'react-bootstrap';
import { GlobalContext } from '../Context';
import { fetchAllPaginatedResults } from '../utils';
import exportFromJSON from 'export-from-json';
import { useUsers } from '../apiInterface';
import MyTable from '../Table';
import type { UserStatsType } from '../schemaTypes';
import { CollectionProject } from './CollectionView';

type SetInfo = { id: string; name: string; projectId: string; projectName: string };

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function CollectionUserStats({
  collectionName,
  projects,
}: {
  collectionName: string;
  projects: CollectionProject[];
}) {
  const { client } = useContext(GlobalContext)!;
  const { users } = useUsers();
  const [sets, setSets] = useState<SetInfo[]>([]);
  const [userStats, setUserStats] = useState<UserStatsType[]>([]);
  const [loadingSets, setLoadingSets] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);

  const userLookup = useMemo(
    () => new Map(users.map((u) => [u.id, u.name || u.id])),
    [users]
  );

  // Load all annotation sets across all projects
  useEffect(() => {
    if (projects.length === 0) { setSets([]); setUserStats([]); return; }
    setLoadingSets(true);
    Promise.all(
      projects.map(async (proj) => {
        const annotationSets = await fetchAllPaginatedResults(
          client.models.AnnotationSet.annotationSetsByProjectId,
          { projectId: proj.projectId, selectionSet: ['id', 'name'], limit: 1000 }
        );
        return annotationSets.map((s) => ({
          id: s.id,
          name: s.name,
          projectId: proj.projectId,
          projectName: proj.projectName,
        }));
      })
    )
      .then((results) => setSets(results.flat()))
      .catch(console.error)
      .finally(() => setLoadingSets(false));
  }, [projects]);

  // Load user stats for all sets
  useEffect(() => {
    if (sets.length === 0) { setUserStats([]); return; }
    setLoadingStats(true);
    const setIdConditions = sets.map((s) => ({ setId: { eq: s.id } }));
    fetchAllPaginatedResults<UserStatsType>(
      client.models.UserStats.list,
      { filter: { or: setIdConditions }, limit: 1000 }
    )
      .then(setUserStats)
      .catch(console.error)
      .finally(() => setLoadingStats(false));
  }, [sets]);

  // Aggregate stats per user
  const stats = useMemo(() => {
    const map: Record<string, {
      observationCount: number; annotationCount: number; activeTime: number;
      sightingCount: number; searchTime: number; annotationTime: number; waitingTime: number;
    }> = {};

    for (const s of userStats) {
      if (!map[s.userId]) {
        map[s.userId] = { observationCount: 0, annotationCount: 0, activeTime: 0, sightingCount: 0, searchTime: 0, annotationTime: 0, waitingTime: 0 };
      }
      map[s.userId].observationCount += s.observationCount;
      map[s.userId].annotationCount = Math.max(0, map[s.userId].annotationCount + s.annotationCount);
      map[s.userId].activeTime += s.activeTime;
      map[s.userId].sightingCount += s.sightingCount || 0;
      map[s.userId].searchTime += s.searchTime || 0;
      map[s.userId].annotationTime += s.annotationTime || 0;
      map[s.userId].waitingTime += s.waitingTime || 0;
    }
    return map;
  }, [userStats]);

  const tableData = Object.keys(stats).map((userId) => ({
    id: userId,
    rowData: [
      userLookup.get(userId) ?? userId,
      formatDuration(stats[userId].activeTime),
      stats[userId].observationCount,
      (stats[userId].searchTime / 1000 / stats[userId].observationCount || 0).toFixed(1),
      Math.max(0, stats[userId].annotationCount),
      stats[userId].sightingCount,
      formatDuration(stats[userId].searchTime),
      formatDuration(stats[userId].annotationTime),
      (stats[userId].observationCount / stats[userId].sightingCount || 0).toFixed(1),
      formatDuration(stats[userId].waitingTime),
    ],
  }));

  const tableHeadings = [
    { content: 'Username' },
    { content: 'Time spent' },
    { content: 'Jobs completed' },
    { content: 'Avg search time (s/job)' },
    { content: 'Total Annotations' },
    { content: 'Total Sightings' },
    { content: 'Total Search Time' },
    { content: 'Total Annotation Time' },
    { content: 'Locations/Sighting' },
    { content: 'Waiting time' },
  ];

  // Build set-to-project map for detailed export
  const setProjectMap = useMemo(
    () => Object.fromEntries(sets.map((s) => [s.id, s.projectName])),
    [sets]
  );

  function handleExportDetailedStats() {
    const rows = userStats
      .filter((s) => s != null)
      .map((s) => ({
        survey: setProjectMap[s.setId] ?? s.setId,
        date: s.date,
        username: userLookup.get(s.userId) ?? s.userId,
        annotationSet: sets.find((st) => st.id === s.setId)?.name ?? s.setId,
        time_spent: formatDuration(s.activeTime),
        activeTime_ms: s.activeTime,
        jobs_completed: s.observationCount,
        avg_search_s_per_job: s.observationCount > 0 ? ((s.searchTime || 0) / s.observationCount / 1000).toFixed(1) : '0.0',
        total_annotations: Math.max(0, s.annotationCount),
        total_sightings: s.sightingCount || 0,
        total_search_time: formatDuration(s.searchTime || 0),
        searchTime_ms: s.searchTime || 0,
        total_annotation_time: formatDuration(s.annotationTime || 0),
        annotationTime_ms: s.annotationTime || 0,
        locations_per_sighting: (s.sightingCount || 0) > 0 ? (s.observationCount / s.sightingCount!).toFixed(1) : '0.0',
        waiting_time: formatDuration(s.waitingTime || 0),
        waitingTime_ms: s.waitingTime || 0,
      }))
      .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.username < b.username ? -1 : 1);

    exportFromJSON({
      data: rows,
      fileName: `${collectionName}_DetailedStats`.replace(/ /g, '_'),
      exportType: exportFromJSON.types.csv,
    });
  }

  if (projects.length === 0) {
    return <div className='p-3 text-warning'>No surveys in this collection yet.</div>;
  }

  return (
    <div className='p-3 d-flex flex-column gap-3'>
      <Card>
        <Card.Header>
          <h5 className='mb-0'>User Statistics — All Surveys</h5>
        </Card.Header>
        <Card.Body>
          {loadingSets || loadingStats ? (
            <div className='d-flex justify-content-center align-items-center py-5'>
              <Spinner animation='border' role='status'>
                <span className='visually-hidden'>Loading stats...</span>
              </Spinner>
              <span className='ms-3'>Loading stats...</span>
            </div>
          ) : (
            <div className='overflow-x-auto'>
              <MyTable
                tableHeadings={tableHeadings}
                tableData={tableData}
                emptyMessage='No stats found.'
              />
            </div>
          )}
        </Card.Body>
        {!loadingStats && userStats.length > 0 && (
          <Card.Footer className='d-flex justify-content-center gap-2'>
            <Button variant='primary' onClick={handleExportDetailedStats}>
              Export Daily Stats CSV
            </Button>
          </Card.Footer>
        )}
      </Card>
    </div>
  );
}
