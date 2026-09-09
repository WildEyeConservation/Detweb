import { getErrorMessage } from '../../../amplify/shared/errorMessage';
import { useState, useMemo } from 'react';
import { Button } from 'react-bootstrap';
import { Footer } from '../../shared/components/Modal';
import { client } from '../../shared/api/appClient';
import { fetchAllPaginatedResults } from '../../shared/api/pagination';

import exportFromJSON from 'export-from-json';
import { useUsers } from '../../shared/api/apiInterface';
import { Annotation } from '../../../amplify/shared/types';


export default function AdvancedOptions({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [loading, setLoading] = useState(false);
  const [, setError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const { users } = useUsers();

  const userMap = useMemo(() => {
    return users.reduce((acc, user) => {
      acc[user.id] = user.name ?? '';
      return acc;
    }, {} as Record<string, string>);
  }, [users]);

  async function exportScoutbotResults() {
    setLoading(true);
    setError(null);
    setLoadingStatus('Exporting scoutbot results...');

    try {
      const { data: project } = await client.models.Project.get(
        { id: projectId },
        { selectionSet: ['name'] }
      );

      const locations = await fetchAllPaginatedResults(
        client.models.Location.locationsByProjectIdAndSource,
        {
          projectId: projectId,
          source: { beginsWith: 'scoutbotv3' },
          selectionSet: [
            'imageId',
            'image.originalPath',
            'confidence',
            'x',
            'y',
            'width',
            'height',
            'observations.createdAt',
            'observations.owner',
          ],
          limit: 10000,
        },
        (stepsCompleted) => {
          setLoadingStatus(
            `Fetching scoutbot results... (${stepsCompleted} fetched)`
          );
        }
      );

      const annotationSets = await fetchAllPaginatedResults(
        client.models.AnnotationSet.annotationSetsByProjectId, {
        projectId: projectId,
        selectionSet: ['id', 'name'] as const,
        limit: 10000,
      }
      );

      const annotations: Annotation[] = [];

      let annotationsFetched = 0;
      await Promise.all(annotationSets.map(async (annotationSet) => {
        const a = await fetchAllPaginatedResults(
          client.models.Annotation.annotationsByAnnotationSetId, {
          setId: annotationSet.id,
          selectionSet: ['id', 'owner', 'imageId', 'x', 'y'] as const,
          limit: 10000,
        },
          (stepsCompleted) => {
            setLoadingStatus(
              `Fetching annotations... (${annotationsFetched + stepsCompleted} fetched)`
            );
          }
        );
        annotationsFetched += a.length;
        annotations.push(...a);
      }));

      // Map annotations by imageId, this is used to check if a location has an annotation regardless of observation
      const annotationMap = annotations.reduce((acc, annotation) => {
        acc[annotation.imageId] = [...(acc[annotation.imageId] || []), annotation];
        return acc;
      }, {} as Record<string, Annotation[]>);

      // Flatten locations so that each observation is its own row together with the location data
      const rows = [];
      for (const location of locations) {
        const boundsxy: [number, number][] = [
          [location!.x - location!.width! / 2, location!.y - location!.height! / 2],
          [location!.x + location!.width! / 2, location!.y + location!.height! / 2],
        ];

        const isWithinBounds = (annotation: Annotation) => {
          return annotation.x >= boundsxy[0][0] &&
            annotation.y >= boundsxy[0][1] &&
            annotation.x <= boundsxy[1][0] &&
            annotation.y <= boundsxy[1][1];
        };

        if (location.observations && location.observations.length > 0) {
          const hasAnnotation = annotationMap[location.imageId!]?.some(isWithinBounds) ?? false;
          for (const observation of location.observations) {
            rows.push({
              image: location.image.originalPath ?? '',
              confidence: location.confidence ?? 0,
              x: location.x,
              y: location.y,
              width: location.width ?? 0,
              height: location.height ?? 0,
              annotated: hasAnnotation,
              observationCreatedAt: observation.createdAt,
              observationOwner: userMap[observation.owner ?? ''],
            });
          }
        } else {
          // If there are no observations, still export the location row with empty observation fields
          const hasAnnotation = annotationMap[location.imageId!]?.some(isWithinBounds) ?? false;
          rows.push({
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

      exportFromJSON({
        data: rows.sort((a, b) => a.confidence - b.confidence),
        fileName: `${project!.name}_scoutbot_results`,
        exportType: exportFromJSON.types.csv,
      });
    } catch (e) {
      setError(getErrorMessage(e) ?? 'Failed to export scoutbot results');
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  }

  return (
    <>
      <div className='d-flex flex-column gap-2 p-3'>
        {/* Export image neighbours */}
        {/* <div>
          <h5 className='mb-0'>Export image neighbours</h5>
          <span className='text-muted' style={{ fontSize: '14px' }}>
            Export the image neighbours of all images in GeoJSON format.
          </span>
          <Button
            className='d-block mt-2'
            onClick={onFetchNeighbours}
            disabled={loading}
          >
            {loading ? loadingStatus || 'Exporting...' : 'Export'}
          </Button>
          {error && <span className='text-danger'>{error}</span>}
        </div> */}
        {/* Export scoutbot results */}
        <div>
          <h5 className='mb-0'>Export scoutbot detections</h5>
          <span className='text-muted' style={{ fontSize: '14px' }}>
            Export the scoutbot detections for all images in the survey.
          </span>
          <Button
            className='d-block mt-2'
            onClick={exportScoutbotResults}
            disabled={loading || users.length === 0}
          >
            {loading ? 'Exporting...' : 'Export'}
          </Button>
          <span className='text-muted' style={{ fontSize: '14px' }}>
            {loadingStatus}
          </span>
        </div>
      </div>
      <Footer>
        <Button variant='dark' onClick={() => onClose()}>
          Close
        </Button>
      </Footer>
    </>
  );
}
