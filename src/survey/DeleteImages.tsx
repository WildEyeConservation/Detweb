import {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import { useContext } from 'react';
import { GlobalContext } from '../Context';
import { Footer } from '../Modal';
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  CircleMarker,
  useMap,
  Popup,
} from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import { Button, Spinner, Alert, ProgressBar, Badge } from 'react-bootstrap';
import { fetchAllPaginatedResults } from '../utils';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

type ImageData = {
  id: string;
  latitude: number;
  longitude: number;
  originalPath?: string | null;
};

type ImageAggregate = {
  id: string;
  originalPath?: string | null;
  annotationIds: string[];
  locationIds: string[];
  membershipRecords: Array<{ id: string; imageSetId?: string | null }>;
  fileRecords: Array<{ id: string }>;
  neighbourPairs: Array<{ key: string; image1Id: string; image2Id: string }>;
};

type DeletionCounters = {
  imagesDeleted: number;
  annotationsDeleted: number;
  locationsDeleted: number;
  membershipsDeleted: number;
  filesDeleted: number;
  neighboursDeleted: number;
  imageSetsUpdated: number;
  failures: number;
};

function ensureArray<T>(value?: Array<T> | null): Array<T> {
  return Array.isArray(value) ? value : [];
}

// Component to fit map bounds to image locations
function FitBoundsToImages({ images }: { images: ImageData[] }) {
  const map = useMap();

  useEffect(() => {
    if (images.length > 0) {
      const bounds = L.latLngBounds(
        images.map((img) => [img.latitude, img.longitude])
      );
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [images, map]);

  return null;
}


export default function DeleteImages({ projectId }: { projectId: string }) {
  const { client, showModal } = useContext(GlobalContext)!;
  const [images, setImages] = useState<ImageData[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteProgress, setDeleteProgress] = useState<{
    current: number;
    total: number;
    phase: string;
  } | null>(null);
  const [deleteResult, setDeleteResult] = useState<DeletionCounters | null>(
    null
  );
  const [popupImage, setPopupImage] = useState<ImageData | null>(null);
  const featureGroupRef = useRef<L.FeatureGroup>(null);
  const isActiveRef = useRef(true);

  // Fetch images with GPS coordinates
  const fetchImages = useCallback(async () => {
    isActiveRef.current = true;
    setLoading(true);
    setError(null);
    setLoadingStatus('Fetching images...');
    setDeleteResult(null);

    try {
      const allImages = (await fetchAllPaginatedResults(
        client.models.Image.imagesByProjectId,
        {
          projectId,
          selectionSet: ['id', 'latitude', 'longitude', 'originalPath'],
          limit: 1000,
        },
        (count) => {
          if (isActiveRef.current) {
            setLoadingStatus(`Fetching images... (${count} fetched)`);
          }
        }
      )) as Array<{
        id: string;
        latitude?: number | null;
        longitude?: number | null;
        originalPath?: string | null;
      }>;

      if (!isActiveRef.current) return;

      // Filter to only images with valid GPS coordinates
      const gpsImages: ImageData[] = allImages
        .filter(
          (img) =>
            img.id &&
            typeof img.latitude === 'number' &&
            typeof img.longitude === 'number' &&
            Number.isFinite(img.latitude) &&
            Number.isFinite(img.longitude)
        )
        .map((img) => ({
          id: img.id,
          latitude: img.latitude!,
          longitude: img.longitude!,
          originalPath: img.originalPath,
        }));

      setImages(gpsImages);
      setSelectedIds(new Set());
      setLoadingStatus(
        `Loaded ${gpsImages.length} images with GPS coordinates (${allImages.length - gpsImages.length} without GPS)`
      );
    } catch (err) {
      console.error('Failed to fetch images:', err);
      setError(
        `Failed to fetch images: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setLoading(false);
    }
  }, [client, projectId]);

  // Initial fetch
  useEffect(() => {
    fetchImages();
    return () => {
      isActiveRef.current = false;
    };
  }, [fetchImages]);

  // Handle polygon selection
  const onPolygonCreated = useCallback(
    (e: any) => {
      if (e.layerType !== 'polygon') return;

      const layer = e.layer;
      const polygonLatLngs = layer.getLatLngs()[0] as L.LatLng[];

      // Find all images within the polygon
      const newSelectedIds = new Set<string>();
      for (const img of images) {
        const point = L.latLng(img.latitude, img.longitude);
        // Check if point is inside polygon using ray casting
        let inside = false;
        for (
          let i = 0, j = polygonLatLngs.length - 1;
          i < polygonLatLngs.length;
          j = i++
        ) {
          const xi = polygonLatLngs[i].lat;
          const yi = polygonLatLngs[i].lng;
          const xj = polygonLatLngs[j].lat;
          const yj = polygonLatLngs[j].lng;

          if (
            yi > point.lng !== yj > point.lng &&
            point.lat < ((xj - xi) * (point.lng - yi)) / (yj - yi) + xi
          ) {
            inside = !inside;
          }
        }

        if (inside) {
          newSelectedIds.add(img.id);
        }
      }

      // Replace selection with polygon selection (not merge)
      setSelectedIds(newSelectedIds);

      // Remove the drawn shape after selection
      if (featureGroupRef.current) {
        featureGroupRef.current.removeLayer(layer);
      }
    },
    [images]
  );

  // Handle marker click
  const handleMarkerClick = useCallback(
    (imageId: string, e: L.LeafletMouseEvent) => {
      const isCtrlPressed = e.originalEvent.ctrlKey;

      setSelectedIds((prev) => {
        const newSet = new Set(prev);
        if (isCtrlPressed) {
          if (newSet.has(imageId)) {
            newSet.delete(imageId);
          } else {
            newSet.add(imageId);
          }
        } else {
          newSet.clear();
          newSet.add(imageId);
        }
        return newSet;
      });
    },
    []
  );

  // Fetch all associated data for selected images
  const fetchImageData = useCallback(
    async (imageIds: string[]): Promise<Map<string, ImageAggregate>> => {
      const imageMap = new Map<string, ImageAggregate>();
      let totalMemberships = 0;
      let totalFiles = 0;
      let totalNeighbours = 0;
      let totalAnnotations = 0;
      let totalLocations = 0;

      setDeleteProgress({ current: 0, total: 0, phase: 'Fetching image details and relationships...' });

      // Fetch images with their relationships
      const imageData = (await fetchAllPaginatedResults(
        client.models.Image.imagesByProjectId,
        {
          projectId,
          selectionSet: [
            'id',
            'originalPath',
            'memberships.id',
            'memberships.imageSetId',
            'files.id',
            'leftNeighbours.image1Id',
            'leftNeighbours.image2Id',
            'rightNeighbours.image1Id',
            'rightNeighbours.image2Id',
          ],
          limit: 1000,
        },
        (count) => {
          setDeleteProgress({ current: count, total: 0, phase: `Fetching image details... (${count} images scanned)` });
        }
      )) as Array<any>;

      const selectedImageSet = new Set(imageIds);

      for (const img of imageData) {
        if (!img?.id || !selectedImageSet.has(img.id)) continue;

        const membershipRecords: Array<{ id: string; imageSetId?: string | null }> = 
          ensureArray(img.memberships)
            .map((m: any) => {
              if (!m?.id) return null;
              return { id: m.id as string, imageSetId: m.imageSetId ?? null };
            })
            .filter((m): m is { id: string; imageSetId: string | null } => m !== null);

        const fileRecords = ensureArray(img.files)
          .map((f: any) => (f?.id ? { id: f.id } : null))
          .filter((f: any): f is { id: string } => Boolean(f));

        const neighbourPairs: Array<{
          key: string;
          image1Id: string;
          image2Id: string;
        }> = [];
        const addNeighbours = (
          list?: Array<{ image1Id?: string | null; image2Id?: string | null }>
        ) => {
          for (const neighbour of list || []) {
            const image1Id = neighbour?.image1Id;
            const image2Id = neighbour?.image2Id;
            if (!image1Id || !image2Id) continue;
            const key =
              image1Id < image2Id
                ? `${image1Id}::${image2Id}`
                : `${image2Id}::${image1Id}`;
            neighbourPairs.push({ key, image1Id, image2Id });
          }
        };
        addNeighbours(img.leftNeighbours);
        addNeighbours(img.rightNeighbours);

        totalMemberships += membershipRecords.length;
        totalFiles += fileRecords.length;
        totalNeighbours += neighbourPairs.length;

        imageMap.set(img.id, {
          id: img.id,
          originalPath: img.originalPath,
          annotationIds: [],
          locationIds: [],
          membershipRecords,
          fileRecords,
          neighbourPairs,
        });
      }

      setDeleteProgress({ 
        current: 0, 
        total: 0, 
        phase: `Found ${imageMap.size} selected images with ${totalMemberships} memberships, ${totalFiles} files, ${totalNeighbours} neighbour links. Fetching annotations...` 
      });

      // Fetch annotations for selected images
      const annotationSets = (await fetchAllPaginatedResults(
        client.models.AnnotationSet.annotationSetsByProjectId,
        {
          projectId,
          selectionSet: ['id'],
          limit: 1000,
        }
      )) as Array<{ id?: string | null }>;

      let setsProcessed = 0;
      for (const set of annotationSets) {
        if (!set?.id) continue;
        setsProcessed++;
        setDeleteProgress({ 
          current: setsProcessed, 
          total: annotationSets.length, 
          phase: `Fetching annotations from set ${setsProcessed}/${annotationSets.length}... (${totalAnnotations} annotations found)` 
        });

        const annotations = (await fetchAllPaginatedResults(
          client.models.Annotation.annotationsByAnnotationSetId,
          {
            setId: set.id,
            selectionSet: ['id', 'imageId'],
            limit: 1000,
          }
        )) as Array<{ id?: string | null; imageId?: string | null }>;

        for (const annotation of annotations) {
          if (!annotation?.id || !annotation?.imageId) continue;
          const agg = imageMap.get(annotation.imageId);
          if (!agg) continue;
          agg.annotationIds.push(annotation.id);
          totalAnnotations++;
        }
      }

      setDeleteProgress({ 
        current: 0, 
        total: 0, 
        phase: `Found ${totalAnnotations} annotations. Fetching locations/detections...` 
      });

      // Fetch locations for selected images
      const locations = (await fetchAllPaginatedResults(
        client.models.Location.locationsByProjectIdAndSource,
        {
          projectId,
          selectionSet: ['id', 'imageId'],
          limit: 1000,
        },
        (count) => {
          setDeleteProgress({ 
            current: count, 
            total: 0, 
            phase: `Fetching locations... (${count} scanned, ${totalLocations} found for selected images)` 
          });
        }
      )) as Array<{ id?: string | null; imageId?: string | null }>;

      for (const location of locations) {
        if (!location?.id || !location?.imageId) continue;
        const agg = imageMap.get(location.imageId);
        if (!agg) continue;
        agg.locationIds.push(location.id);
        totalLocations++;
      }

      setDeleteProgress({ 
        current: 0, 
        total: 0, 
        phase: `Ready to delete: ${imageMap.size} images, ${totalAnnotations} annotations, ${totalLocations} locations, ${totalFiles} files, ${totalMemberships} memberships, ${totalNeighbours} neighbour links` 
      });

      return imageMap;
    },
    [client, projectId]
  );

  // Delete selected images
  const handleDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;

    // Build summary of what will be deleted
    const imageCount = selectedIds.size;
    const selectedImages = images.filter((img) => selectedIds.has(img.id));
    const samplePaths = selectedImages
      .slice(0, 3)
      .map((img) => img.originalPath || 'Unknown path');
    const pathSummary =
      samplePaths.join('\n') +
      (imageCount > 3 ? `\n... and ${imageCount - 3} more` : '');

    const confirmMessage = `Are you sure you want to delete ${imageCount} image(s)?

This will permanently delete:
- The image records
- All annotations on these images
- All detections/locations on these images

Sample images:
${pathSummary}

This action cannot be undone.`;

    if (!window.confirm(confirmMessage)) return;

    setDeleting(true);
    setError(null);
    setDeleteResult(null);

    try {
      const imageIds = Array.from(selectedIds);

      // Fetch all associated data
      const imageMap = await fetchImageData(imageIds);

      const counters: DeletionCounters = {
        imagesDeleted: 0,
        annotationsDeleted: 0,
        locationsDeleted: 0,
        membershipsDeleted: 0,
        filesDeleted: 0,
        neighboursDeleted: 0,
        imageSetsUpdated: 0,
        failures: 0,
      };

      const deletedNeighbourKeys = new Set<string>();
      const impactedImageSetIds = new Set<string>();
      const batchSize = 10;
      const aggregates = Array.from(imageMap.values());

      setDeleteProgress({
        current: 0,
        total: aggregates.length,
        phase: 'Deleting images and associated data...',
      });

      for (let i = 0; i < aggregates.length; i += batchSize) {
        const batch = aggregates.slice(i, i + batchSize);

        await Promise.all(
          batch.map(async (agg) => {
            try {
              // Delete annotations
              for (const annotationId of agg.annotationIds) {
                await (client as any).models.Annotation.delete({
                  id: annotationId,
                });
                counters.annotationsDeleted += 1;
              }

              // Delete locations
              for (const locationId of agg.locationIds) {
                await (client as any).models.Location.delete({
                  id: locationId,
                });
                counters.locationsDeleted += 1;
              }

              // Delete memberships
              for (const membership of agg.membershipRecords) {
                await (client as any).models.ImageSetMembership.delete({
                  id: membership.id,
                });
                counters.membershipsDeleted += 1;
                if (membership.imageSetId) {
                  impactedImageSetIds.add(membership.imageSetId);
                }
              }

              // Delete files
              for (const file of agg.fileRecords) {
                await (client as any).models.ImageFile.delete({ id: file.id });
                counters.filesDeleted += 1;
              }

              // Delete neighbours
              for (const neighbour of agg.neighbourPairs) {
                if (deletedNeighbourKeys.has(neighbour.key)) continue;
                deletedNeighbourKeys.add(neighbour.key);
                try {
                  await (client as any).models.ImageNeighbour.delete({
                    image1Id: neighbour.image1Id,
                    image2Id: neighbour.image2Id,
                  });
                  counters.neighboursDeleted += 1;
                } catch (err) {
                  const msg =
                    (err as any)?.errors?.[0]?.errorType ||
                    (err as any)?.name ||
                    (err as any)?.message ||
                    '';
                  if (!String(msg).includes('ConditionalCheckFailed')) {
                    counters.failures += 1;
                    console.warn('Failed to delete neighbour', neighbour, err);
                  }
                }
              }

              // Delete the image itself
              await (client as any).models.Image.delete({ id: agg.id });
              counters.imagesDeleted += 1;
            } catch (err) {
              counters.failures += 1;
              console.warn('Failed to delete image', agg.id, err);
            }
          })
        );

        setDeleteProgress({
          current: counters.imagesDeleted,
          total: aggregates.length,
          phase: `Deleted ${counters.imagesDeleted}/${aggregates.length} images (${counters.annotationsDeleted} annotations, ${counters.locationsDeleted} locations)...`,
        });
      }

      // Update impacted image sets
      if (impactedImageSetIds.size > 0) {
        setDeleteProgress({
          current: 0,
          total: impactedImageSetIds.size,
          phase: 'Updating image set counts...',
        });

        for (const imageSetId of impactedImageSetIds) {
          try {
            const memberships = (await fetchAllPaginatedResults(
              (client as any).models.ImageSetMembership
                .imageSetMembershipsByImageSetId,
              {
                imageSetId,
                selectionSet: ['id'],
                limit: 1000,
              }
            )) as Array<{ id: string }>;

            await (client as any).models.ImageSet.update({
              id: imageSetId,
              imageCount: memberships.length,
            });
            counters.imageSetsUpdated += 1;
          } catch (err) {
            counters.failures += 1;
            console.warn('Failed to update image set count', imageSetId, err);
          }
        }
      }

      setDeleteResult(counters);

      // Notify other users about the changes
      setDeleteProgress({
        current: 0,
        total: 0,
        phase: 'Notifying other users...',
      });
      await client.mutations.updateProjectMemberships({ projectId });

      // Refresh the map
      setDeleteProgress({
        current: 0,
        total: 0,
        phase: 'Refreshing map...',
      });
      await fetchImages();

      setDeleteProgress(null);
    } catch (err) {
      console.error('Delete operation failed:', err);
      setError(
        `Delete operation failed: ${err instanceof Error ? err.message : String(err)}`
      );
    } finally {
      setDeleting(false);
    }
  }, [selectedIds, images, fetchImageData, fetchImages, client]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // Select all images
  const selectAll = useCallback(() => {
    setSelectedIds(new Set(images.map((img) => img.id)));
  }, [images]);

  // Memoized selected count
  const selectedCount = useMemo(() => selectedIds.size, [selectedIds]);

  return (
    <>
      <div className="p-3 d-flex flex-column gap-3">
        {/* Instructions */}
        <Alert variant="info" className="mb-0">
          <strong>Instructions:</strong>
          <ul className="mb-0 mt-2">
            <li>Click on an image marker to select it</li>
            <li>Hold <kbd>Ctrl</kbd> + click to select multiple images</li>
            <li>Use the polygon tool (top-right) to draw around multiple images</li>
            <li>Right-click on a marker to view image details</li>
            <li>Blue markers = unselected, Red markers = selected</li>
          </ul>
        </Alert>

        {/* Status bar */}
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <div className="d-flex gap-2 align-items-center">
            <Badge bg="primary">{images.length} images loaded</Badge>
            <Badge bg={selectedCount > 0 ? 'danger' : 'secondary'}>
              {selectedCount} selected
            </Badge>
          </div>
          <div className="d-flex gap-2">
            <Button
              size="sm"
              variant="outline-secondary"
              onClick={fetchImages}
              disabled={loading || deleting}
            >
              {loading ? (
                <>
                  <Spinner animation="border" size="sm" className="me-1" />
                  Loading...
                </>
              ) : (
                'Refresh'
              )}
            </Button>
            <Button
              size="sm"
              variant="outline-primary"
              onClick={selectAll}
              disabled={loading || deleting || images.length === 0}
            >
              Select All
            </Button>
            <Button
              size="sm"
              variant="outline-info"
              onClick={clearSelection}
              disabled={loading || deleting || selectedCount === 0}
            >
              Clear Selection
            </Button>
            <Button
              size="sm"
              variant="danger"
              onClick={handleDelete}
              disabled={loading || deleting || selectedCount === 0}
            >
              {deleting ? (
                <>
                  <Spinner animation="border" size="sm" className="me-1" />
                  Deleting...
                </>
              ) : (
                `Delete ${selectedCount > 0 ? `(${selectedCount})` : ''}`
              )}
            </Button>
          </div>
        </div>

        {/* Loading status */}
        {loadingStatus && !error && (
          <div className="text-muted small">{loadingStatus}</div>
        )}

        {/* Error display */}
        {error && (
          <Alert variant="danger" dismissible onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Delete progress */}
        {deleteProgress && (
          <div>
            <div className="text-muted small mb-1">{deleteProgress.phase}</div>
            {deleteProgress.total > 0 && (
              <ProgressBar
                now={(deleteProgress.current / deleteProgress.total) * 100}
                label={`${deleteProgress.current}/${deleteProgress.total}`}
                animated
                striped
              />
            )}
          </div>
        )}

        {/* Delete result */}
        {deleteResult && (
          <Alert
            variant={deleteResult.failures > 0 ? 'warning' : 'success'}
            dismissible
            onClose={() => setDeleteResult(null)}
          >
            <strong>Deletion complete:</strong>
            <ul className="mb-0 mt-2">
              <li>Images deleted: {deleteResult.imagesDeleted}</li>
              <li>Annotations deleted: {deleteResult.annotationsDeleted}</li>
              <li>Locations deleted: {deleteResult.locationsDeleted}</li>
              <li>File records deleted: {deleteResult.filesDeleted}</li>
              <li>Memberships deleted: {deleteResult.membershipsDeleted}</li>
              <li>Neighbour links deleted: {deleteResult.neighboursDeleted}</li>
              <li>Image sets updated: {deleteResult.imageSetsUpdated}</li>
              {deleteResult.failures > 0 && (
                <li className="text-danger">
                  Failures: {deleteResult.failures}
                </li>
              )}
            </ul>
          </Alert>
        )}

        {/* Map */}
        <div
          style={{
            height: '600px',
            width: '100%',
            position: 'relative',
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            overflow: 'hidden',
          }}
        >
          {images.length === 0 && !loading ? (
            <div className="d-flex justify-content-center align-items-center h-100 text-muted">
              No images with GPS coordinates found
            </div>
          ) : (
            <MapContainer
              style={{ height: '100%', width: '100%' }}
              center={[0, 0]}
              zoom={2}
            >
              <TileLayer
                attribution='&copy; OpenStreetMap contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {images.length > 0 && <FitBoundsToImages images={images} />}

              {/* Feature group for polygon drawing */}
              <FeatureGroup ref={featureGroupRef}>
                <EditControl
                  position="topright"
                  onCreated={onPolygonCreated}
                  draw={{
                    polygon: {
                      allowIntersection: false,
                      shapeOptions: { color: '#3388ff', weight: 2 },
                    },
                    rectangle: false,
                    circle: false,
                    circlemarker: false,
                    marker: false,
                    polyline: false,
                  }}
                  edit={{ edit: false, remove: false }}
                />
              </FeatureGroup>

              {/* Image markers */}
              {images.map((img) => {
                const isSelected = selectedIds.has(img.id);
                return (
                  <CircleMarker
                    key={img.id}
                    center={[img.latitude, img.longitude]}
                    radius={isSelected ? 8 : 5}
                    pathOptions={{
                      color: isSelected ? '#dc3545' : '#0d6efd',
                      fillColor: isSelected ? '#dc3545' : '#0d6efd',
                      fillOpacity: isSelected ? 0.8 : 0.5,
                      weight: isSelected ? 3 : 1,
                    }}
                    eventHandlers={{
                      click: (e) => handleMarkerClick(img.id, e),
                      contextmenu: (e) => {
                        e.originalEvent.preventDefault();
                        setPopupImage(img);
                      },
                    }}
                  />
                );
              })}

              {/* Popup for right-clicked image */}
              {popupImage && (
                <Popup
                  position={[popupImage.latitude, popupImage.longitude]}
                  eventHandlers={{
                    remove: () => setPopupImage(null),
                  }}
                >
                  <div style={{ maxWidth: '300px' }}>
                    <strong>Path:</strong>{' '}
                    {popupImage.originalPath || 'Unknown'}
                    <br />
                    <strong>Lat:</strong> {popupImage.latitude.toFixed(6)}
                    <br />
                    <strong>Lng:</strong> {popupImage.longitude.toFixed(6)}
                  </div>
                </Popup>
              )}
            </MapContainer>
          )}

          {/* Loading overlay */}
          {loading && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.8)',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                zIndex: 1000,
              }}
            >
              <div className="text-center">
                <Spinner animation="border" variant="primary" />
                <div className="mt-2">{loadingStatus || 'Loading...'}</div>
              </div>
            </div>
          )}
        </div>
      </div>
      <Footer>
        <Button variant="dark" onClick={() => showModal(null)}>
          Close
        </Button>
      </Footer>
    </>
  );
}

