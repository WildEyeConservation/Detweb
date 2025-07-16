import { useState } from 'react';
import { Modal, Button } from 'react-bootstrap';
import MyTable from './Table';
import humanizeDuration from 'humanize-duration';
import exportFromJSON from 'export-from-json';

type AnnotationSet = { label: string; value: string };
type UserType = { id: string; name: string };

interface StatsEntry {
  observationCount: number;
  annotationCount: number;
  activeTime: number;
  sightingCount: number;
  searchTime: number;
  annotationTime: number;
  waitingTime: number;
}

type Props = {
  show: boolean;
  onHide: () => void;
  projectLabel?: string;
  startDate: Date | null;
  endDate: Date | null;
  startString: string | null;
  endString: string | null;
  selectedSets?: AnnotationSet[];
  allUsers: UserType[];
  queryObservations: (
    annotationSetId: string,
    lowerLimitOverride?: string,
    upperLimitOverride?: string
  ) => Promise<any[]>;
};

export default function SnapshotStatsModal({
  show,
  onHide,
  projectLabel,
  startDate,
  endDate,
  startString,
  endString,
  selectedSets,
  allUsers,
  queryObservations,
}: Props) {
  const [snapshotStartTime, setSnapshotStartTime] = useState('00:00');
  const [snapshotEndTime, setSnapshotEndTime] = useState('23:59');
  const [snapshotStats, setSnapshotStats] = useState<Record<string, StatsEntry>>({});
  const [snapshotLoading, setSnapshotLoading] = useState(false);

  const tableHeadings = [
    { content: 'Username' },
    { content: 'Time spent' },
    { content: 'Jobs completed' },
    { content: 'Average search time (s/job)' },
    { content: 'Total Annotations' },
    { content: 'Total Sightings' },
    { content: 'Total Search Time' },
    { content: 'Total Annotation Time' },
    { content: 'Locations/Sighting' },
    { content: 'Waiting time' },
  ];

  const handleRunSnapshot = async () => {
    setSnapshotLoading(true);
    const tempStats: Record<string, StatsEntry> = {};
    if (!snapshotStartTime || !snapshotEndTime || !startString || !endString) {
      setSnapshotLoading(false);
      return;
    }
    const lowerLimitDate = new Date(`${startString}T${snapshotStartTime}:00`);
    const upperLimitDate = new Date(`${endString}T${snapshotEndTime}:59`);
    const lowerLimit = lowerLimitDate.toISOString();
    const upperLimit = upperLimitDate.toISOString();
    for (const s of selectedSets || []) {
      const observations = await queryObservations(s.value, lowerLimit, upperLimit);
      observations.forEach((o: any) => {
        const userId = o.owner.includes('::') ? o.owner.split('::')[1] : o.owner;
        if (!tempStats[userId]) {
          tempStats[userId] = {
            observationCount: 0,
            annotationCount: 0,
            activeTime: 0,
            sightingCount: 0,
            searchTime: 0,
            annotationTime: 0,
            waitingTime: 0,
          };
        }
        const entry = tempStats[userId];
        entry.observationCount += 1;
        entry.annotationCount += o.annotationCount || 0;
        const sighting = o.annotationCount > 0 ? 1 : 0;
        entry.sightingCount += sighting;
        const timeTaken = o.timeTaken || 0;
        entry.activeTime += timeTaken;
        entry.searchTime += (1 - sighting) * timeTaken;
        entry.annotationTime += sighting * timeTaken;
        entry.waitingTime += Math.max(0, o.waitingTime || 0);
      });
    }
    setSnapshotStats(tempStats);
    setSnapshotLoading(false);
  };

  const handleExportSnapshot = () => {
    const data = Object.keys(snapshotStats).map((userId) => {
      const statsEntry = snapshotStats[userId];
      return {
        Username: allUsers.find((u) => u.id == userId)?.name || userId,
        'Time spent': humanizeDuration(statsEntry.activeTime, {
          units: ['h', 'm', 's'],
          round: true,
          largest: 2,
        }),
        'Jobs completed': statsEntry.observationCount,
        'Average search time (s/job)': (
          statsEntry.searchTime / 1000 / statsEntry.observationCount || 0
        ).toFixed(1),
        'Total Annotations': statsEntry.annotationCount,
        'Total Sightings': statsEntry.sightingCount,
        'Total Search Time': humanizeDuration(statsEntry.searchTime, {
          units: ['h', 'm', 's'],
          round: true,
          largest: 2,
        }),
        'Total Annotation Time': humanizeDuration(statsEntry.annotationTime, {
          units: ['h', 'm', 's'],
          round: true,
          largest: 2,
        }),
        'Locations/Sighting': (
          statsEntry.observationCount / statsEntry.sightingCount || 0
        ).toFixed(1),
        'Waiting time': humanizeDuration(statsEntry.waitingTime, {
          units: ['h', 'm', 's'],
          round: true,
          largest: 2,
        }),
      };
    });
    const fileName =
      `${projectLabel}_Snapshot_${startString}_${endString}_${snapshotStartTime}_${snapshotEndTime}`.replace(
        / /g,
        '_'
      );
    exportFromJSON({ data, fileName, exportType: exportFromJSON.types.csv });
  };

  return (
    <Modal show={show} onHide={onHide} size='xl' backdrop='static'>
      <Modal.Header>
        <Modal.Title>Snapshot Stats for {projectLabel}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <div className='d-flex flex-column gap-2'>
          <div className='d-flex justify-content-between align-items-center gap-2'>
            <div style={{ width: '150px' }}>
              <label>Date: {startDate?.toLocaleDateString()}</label>
              <label>Start Time:</label>
            </div>
            <input
              type='time'
              className='form-control'
              value={snapshotStartTime}
              onChange={(e) => setSnapshotStartTime(e.target.value)}
            />
          </div>
          <div className='d-flex justify-content-between align-items-center gap-2'>
            <div style={{ width: '150px' }}>
              <label>Date: {endDate?.toLocaleDateString()}</label>
              <label>End Time:</label>
            </div>
            <input
              type='time'
              className='form-control'
              value={snapshotEndTime}
              onChange={(e) => setSnapshotEndTime(e.target.value)}
            />
          </div>
        </div>
        <div className='mt-3 overflow-x-auto'>
          <MyTable
            tableHeadings={tableHeadings}
            tableData={Object.keys(snapshotStats).map((userId) => ({
              id: userId,
              rowData: [
                allUsers.find((u) => u.id == userId)?.name,
                humanizeDuration(snapshotStats[userId].activeTime, {
                  units: ['h', 'm', 's'],
                  round: true,
                  largest: 2,
                }),
                snapshotStats[userId].observationCount,
                (
                  snapshotStats[userId].searchTime /
                    1000 /
                    snapshotStats[userId].observationCount || 0
                ).toFixed(1),
                snapshotStats[userId].annotationCount,
                snapshotStats[userId].sightingCount,
                humanizeDuration(snapshotStats[userId].searchTime, {
                  units: ['h', 'm', 's'],
                  round: true,
                  largest: 2,
                }),
                humanizeDuration(snapshotStats[userId].annotationTime, {
                  units: ['h', 'm', 's'],
                  round: true,
                  largest: 2,
                }),
                (
                  snapshotStats[userId].observationCount /
                    snapshotStats[userId].sightingCount || 0
                ).toFixed(1),
                humanizeDuration(snapshotStats[userId].waitingTime, {
                  units: ['h', 'm', 's'],
                  round: true,
                  largest: 2,
                }),
              ],
            }))}
            emptyMessage="No snapshot stats. Please select time range and click 'Run Snapshot'."
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant='success'
          onClick={handleExportSnapshot}
          disabled={snapshotLoading || Object.keys(snapshotStats).length === 0}
        >
          Export Snapshot
        </Button>
        <Button
          variant='primary'
          onClick={handleRunSnapshot}
          disabled={snapshotLoading || !snapshotStartTime || !snapshotEndTime}
        >
          {snapshotLoading ? 'Loading...' : 'Run Snapshot'}
        </Button>
        <Button variant='dark' onClick={onHide}>
          Close
        </Button>
      </Modal.Footer>
    </Modal>
  );
} 