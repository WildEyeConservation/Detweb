import { useContext, useState, useCallback } from 'react';
import { Button } from 'react-bootstrap';
import { Footer } from '../Modal';
import { GlobalContext } from '../Context';
import type {
  Feature as GeoJSONFeature,
  Polygon as GeoJSONPolygon,
} from 'geojson';
import {
  fetchAllPaginatedResults,
  array2Matrix,
  makeTransform,
} from '../utils';
import { inv } from 'mathjs';
import exportFromJSON from 'export-from-json';

type NeighbourGeoJSON = {
  fromPath: string; // coordinate frame of the GeoJSON polygon's input corners
  toPath: string; // target image frame the polygon is expressed in
  geojson: GeoJSONFeature<GeoJSONPolygon> | null;
};

export default function AdvancedOptions({ projectId }: { projectId: string }) {
  const { client, showModal } = useContext(GlobalContext)!;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState<string>('');

  const buildGeoJSON = useCallback(
    (
      fromId: string,
      toId: string,
      HArr: (number | null)[] | null | undefined,
      imageSizes: Record<string, { width: number; height: number }>,
      pathMap: Record<string, string | undefined>
    ): GeoJSONFeature<GeoJSONPolygon> | null => {
      if (!HArr || HArr.length !== 9) return null;

      const H = array2Matrix(HArr as any);
      if (!H) return null;

      const orientedFrom = fromId;
      const size = imageSizes[orientedFrom];
      if (!size) return null;

      const transform = makeTransform(H as any);
      const corners: [number, number][] = [
        [0, 0],
        [size.width, 0],
        [size.width, size.height],
        [0, size.height],
        [0, 0],
      ];
      const coords = corners.map((c) => transform(c));

      const fromPath = pathMap[fromId] ?? fromId;
      const toPath = pathMap[toId] ?? toId;

      return {
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [coords.map(([x, y]) => [x, y])],
        },
        properties: { fromPath, toPath },
      } as GeoJSONFeature<GeoJSONPolygon>;
    },
    []
  );

  const onFetchNeighbours = useCallback(async () => {
    setLoading(true);
    setError(null);
    setLoadingStatus('Fetching images...');

    try {
      const images = await fetchAllPaginatedResults(
        client.models.Image.imagesByProjectId,
        {
          projectId,
          selectionSet: [
            'id',
            'originalPath',
            'width',
            'height',
            'leftNeighbours.image2Id',
            'leftNeighbours.homography',
            'rightNeighbours.image1Id',
            'rightNeighbours.homography',
          ],
          limit: 1000,
        },
        (stepsCompleted) => {
          setLoadingStatus(`Fetching images... (${stepsCompleted} fetched)`);
        }
      );

      setLoadingStatus(`Fetched ${images.length} images. Processing...`);

      const sizeMap: Record<string, { width: number; height: number }> = {};
      const pathMap: Record<string, string | undefined> = {};
      for (const img of images) {
        sizeMap[img.id] = { width: img.width, height: img.height };
        pathMap[img.id] = img.originalPath ?? '';
      }

      const unique: Map<string, NeighbourGeoJSON> = new Map();

      for (const img of images) {
        // Left neighbours: records where current image is image1
        for (const n of img.leftNeighbours ?? []) {
          const a = img.id as string;
          const b = n.image2Id as string;
          const key = a < b ? `${a}::${b}` : `${b}::${a}`;

          let geo: GeoJSONFeature<GeoJSONPolygon> | null = null;
          let orientedFrom = a;
          let orientedTo = b;
          if (n.homography && n.homography.length === 9) {
            if (a < b) {
              geo = buildGeoJSON(a, b, n.homography, sizeMap, pathMap);
              orientedFrom = a;
              orientedTo = b;
            } else {
              const H = array2Matrix(n.homography as any);
              const Hinv = H ? (inv(H as any) as any) : null;
              geo = Hinv
                ? buildGeoJSON(b, a, Hinv as any, sizeMap, pathMap)
                : null;
              orientedFrom = b;
              orientedTo = a;
            }
          }

          const existing = unique.get(key);
          if (!existing || (!existing.geojson && geo)) {
            unique.set(key, {
              fromPath: pathMap[orientedFrom] ?? orientedFrom,
              toPath: pathMap[orientedTo] ?? orientedTo,
              geojson: geo,
            });
          }
        }

        // Right neighbours: records where current image is image2
        for (const n of img.rightNeighbours ?? []) {
          const a = n.image1Id as string;
          const b = img.id as string;
          const key = a < b ? `${a}::${b}` : `${b}::${a}`;

          let geo: GeoJSONFeature<GeoJSONPolygon> | null = null;
          let orientedFrom = a;
          let orientedTo = b;
          if (n.homography && n.homography.length === 9) {
            if (a < b) {
              geo = buildGeoJSON(a, b, n.homography, sizeMap, pathMap);
              orientedFrom = a;
              orientedTo = b;
            } else {
              const H = array2Matrix(n.homography as any);
              const Hinv = H ? (inv(H as any) as any) : null;
              geo = Hinv
                ? buildGeoJSON(b, a, Hinv as any, sizeMap, pathMap)
                : null;
              orientedFrom = b;
              orientedTo = a;
            }
          }

          const existing = unique.get(key);
          if (!existing || (!existing.geojson && geo)) {
            unique.set(key, {
              fromPath: pathMap[orientedFrom] ?? orientedFrom,
              toPath: pathMap[orientedTo] ?? orientedTo,
              geojson: geo,
            });
          }
        }
      }

      const { data: project } = await client.models.Project.get(
        { id: projectId },
        { selectionSet: ['name'] }
      );

      exportFromJSON({
        data: Array.from(unique.values()),
        fileName: `${project!.name}_neighbours`,
        exportType: exportFromJSON.types.csv,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to fetch neighbours');
    } finally {
      setLoading(false);
      setLoadingStatus('');
    }
  }, [client, projectId, buildGeoJSON]);

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
            'image.originalPath',
            'confidence',
            'x',
            'y',
            'width',
            'height',
          ],
          limit: 1000,
        },
        (stepsCompleted) => {
          setLoadingStatus(
            `Fetching scoutbot results... (${stepsCompleted} fetched)`
          );
        }
      );

      exportFromJSON({
        data: locations.map((location) => ({
          image: location.image.originalPath ?? '',
          confidence: location.confidence ?? 0,
          x: location.x,
          y: location.y,
          width: location.width ?? 0,
          height: location.height ?? 0,
        })),
        fileName: `${project!.name}_scoutbot_results`,
        exportType: exportFromJSON.types.csv,
      });
    } catch (e: any) {
      setError(e?.message ?? 'Failed to export scoutbot results');
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
            disabled={loading}
          >
            {loading ? 'Exporting...' : 'Export'}
          </Button>
          <span className='text-muted' style={{ fontSize: '14px' }}>
            {loadingStatus}
          </span>
        </div>
      </div>
      <Footer>
        <Button variant='dark' onClick={() => showModal(null)}>
          Close
        </Button>
      </Footer>
    </>
  );
}
