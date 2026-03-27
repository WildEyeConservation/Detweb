import { useContext, useState, useMemo } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { GlobalContext } from '../Context';
import { fetchAllPaginatedResults } from '../utils';
import exportFromJSON from 'export-from-json';
import { useUsers } from '../apiInterface';
import { CollectionProject } from './CollectionView';
import { Annotation } from '../../amplify/shared/types';

export default function CollectionScoutbotExport({
  collectionName,
  projects,
}: {
  collectionName: string;
  projects: CollectionProject[];
}) {
  const { client } = useContext(GlobalContext)!;
  const { users } = useUsers();
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const userMap = useMemo(
    () => users.reduce((acc, u) => { acc[u.id] = u.name ?? ''; return acc; }, {} as Record<string, string>),
    [users]
  );

  async function handleExport() {
    if (projects.length === 0) return;
    setLoading(true);
    setStatus('Starting export...');

    try {
      const allRows: object[] = [];

      for (const proj of projects) {
        setStatus(`Fetching scoutbot detections for ${proj.projectName}...`);

        const locations = await fetchAllPaginatedResults(
          client.models.Location.locationsByProjectIdAndSource,
          {
            projectId: proj.projectId,
            source: { beginsWith: 'scoutbotv3' },
            selectionSet: [
              'imageId', 'image.originalPath', 'confidence',
              'x', 'y', 'width', 'height',
              'observations.createdAt', 'observations.owner',
            ],
            limit: 1000,
          },
          (steps) => {
            setStatus(`Fetching scoutbot detections for ${proj.projectName}... (${steps} fetched)`);
          }
        );

        // Build annotation map for this project
        setStatus(`Fetching annotations for ${proj.projectName}...`);
        const annotationSets = await fetchAllPaginatedResults(
          client.models.AnnotationSet.annotationSetsByProjectId,
          { projectId: proj.projectId, selectionSet: ['id'], limit: 1000 }
        );

        let annotations: Annotation[] = [];
        let annotationsFetched = 0;
        await Promise.all(
          annotationSets.map(async (set) => {
            const a = await fetchAllPaginatedResults(
              client.models.Annotation.annotationsByAnnotationSetId,
              {
                setId: set.id,
                selectionSet: ['id', 'owner', 'imageId', 'x', 'y'] as const,
                limit: 1000,
              },
              (steps) => {
                setStatus(`Fetching annotations for ${proj.projectName}... (${annotationsFetched + steps} fetched)`);
              }
            );
            annotationsFetched += a.length;
            annotations.push(...a);
          })
        );

        const annotationMap = annotations.reduce((acc, a) => {
          acc[a.imageId] = [...(acc[a.imageId] || []), a];
          return acc;
        }, {} as Record<string, Annotation[]>);

        for (const location of locations) {
          const boundsxy: [number, number][] = [
            [location!.x - location!.width! / 2, location!.y - location!.height! / 2],
            [location!.x + location!.width! / 2, location!.y + location!.height! / 2],
          ];
          const isWithinBounds = (a: Annotation) =>
            a.x >= boundsxy[0][0] && a.y >= boundsxy[0][1] &&
            a.x <= boundsxy[1][0] && a.y <= boundsxy[1][1];

          if (location.observations && location.observations.length > 0) {
            const hasAnnotation = annotationMap[location.imageId!]?.some(isWithinBounds) ?? false;
            for (const obs of location.observations) {
              allRows.push({
                survey: proj.projectName,
                image: location.image.originalPath ?? '',
                confidence: location.confidence ?? 0,
                x: location.x,
                y: location.y,
                width: location.width ?? 0,
                height: location.height ?? 0,
                annotated: hasAnnotation,
                observationCreatedAt: obs.createdAt,
                observationOwner: userMap[obs.owner ?? ''],
              });
            }
          } else {
            const hasAnnotation = annotationMap[location.imageId!]?.some(isWithinBounds) ?? false;
            allRows.push({
              survey: proj.projectName,
              image: location.image.originalPath ?? '',
              confidence: location.confidence ?? 0,
              x: location.x,
              y: location.y,
              width: location.width ?? 0,
              height: location.height ?? 0,
              annotated: hasAnnotation,
              observationCreatedAt: '',
              observationOwner: '',
            });
          }
        }
      }

      setStatus(`Exporting ${allRows.length} rows...`);
      exportFromJSON({
        data: allRows.sort((a: any, b: any) => a.confidence - b.confidence),
        fileName: `${collectionName}_scoutbot_results`,
        exportType: exportFromJSON.types.csv,
      });
      setStatus(`Exported ${allRows.length} rows.`);
      await new Promise((r) => setTimeout(r, 1500));
      setStatus('');
    } catch (e: any) {
      setStatus(`Error: ${e?.message ?? 'Export failed'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className='p-3 d-flex flex-column gap-2'>
      <h5 className='mb-0'>Export Scoutbot Detections</h5>
      <span className='text-muted' style={{ fontSize: '14px' }}>
        Export all scoutbot detections across all surveys in this collection as a single CSV file.
        Each row includes a <code>survey</code> column to identify the source survey.
      </span>
      {projects.length === 0 && (
        <span className='text-warning'>No surveys in this collection yet.</span>
      )}
      <Button
        className='align-self-start'
        onClick={handleExport}
        disabled={loading || projects.length === 0 || users.length === 0}
      >
        {loading ? 'Exporting...' : 'Download CSV'}
      </Button>
      {status && (
        <span className='text-muted d-flex align-items-center gap-2' style={{ fontSize: '14px' }}>
          {loading && <Spinner size='sm' />}
          {status}
        </span>
      )}
    </div>
  );
}
