import { useContext, useState, useMemo } from 'react';
import { Button, Spinner } from 'react-bootstrap';
import { GlobalContext } from '../Context';
import { fetchAllPaginatedResults } from '../utils';
import exportFromJSON from 'export-from-json';
import { useUsers } from '../apiInterface';
import { CollectionProject } from './CollectionView';

export default function CollectionAnnotationExport({
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
        setStatus(`Fetching annotation sets for ${proj.projectName}...`);
        const annotationSets = await fetchAllPaginatedResults(
          client.models.AnnotationSet.annotationSetsByProjectId,
          { projectId: proj.projectId, selectionSet: ['id', 'name'], limit: 1000 }
        );

        // Build category map for this project
        const categories = await fetchAllPaginatedResults(
          client.models.Category.categoriesByProjectId,
          { projectId: proj.projectId, selectionSet: ['id', 'name'], limit: 1000 }
        );
        const categoryMap = categories.reduce((acc, c) => { acc[c.id] = c.name; return acc; }, {} as Record<string, string>);

        let fetched = 0;
        for (const set of annotationSets) {
          setStatus(`Fetching annotations for ${proj.projectName} / ${set.name}... (${fetched} so far)`);
          const annotations = await fetchAllPaginatedResults(
            client.models.Annotation.annotationsByAnnotationSetId,
            {
              setId: set.id,
              selectionSet: [
                'y', 'x', 'category.name', 'owner', 'source', 'obscured',
                'id', 'objectId', 'reviewCatId', 'reviewedBy',
                'image.originalPath', 'image.timestamp', 'image.latitude', 'image.longitude',
              ] as const,
              limit: 1000,
            },
            (steps) => {
              setStatus(`Fetching annotations for ${proj.projectName} / ${set.name}... (${fetched + steps} fetched)`);
            }
          );
          fetched += annotations.length;

          for (const anno of annotations) {
            allRows.push({
              survey: proj.projectName,
              annotationSet: set.name,
              category: anno.category?.name ?? 'Unknown',
              image: anno.image.originalPath ?? 'Unknown',
              timestamp: anno.image.timestamp,
              latitude: anno.image.latitude,
              longitude: anno.image.longitude,
              obscured: anno.obscured ?? false,
              annotator: userMap[anno.owner ?? ''] || 'Unknown',
              isPrimary: anno.objectId === anno.id,
              x: anno.x,
              y: anno.y,
              source: anno.source,
              reviewedBy: userMap[anno.reviewedBy ?? ''] ?? '',
              reviewedCategory: categoryMap[anno.reviewCatId ?? ''] ?? '',
            });
          }
        }
      }

      setStatus(`Exporting ${allRows.length} annotations...`);
      exportFromJSON({
        data: allRows,
        fileName: `${collectionName}_annotations`,
        exportType: exportFromJSON.types.csv,
      });
      setStatus(`Exported ${allRows.length} annotations.`);
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
      <h5 className='mb-0'>Export Annotations</h5>
      <span className='text-muted' style={{ fontSize: '14px' }}>
        Export all annotations across all surveys in this collection as a single CSV file.
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
