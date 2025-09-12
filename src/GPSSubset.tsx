import React, { useState, useCallback, useRef, useEffect } from 'react';
import Button from 'react-bootstrap/Button';
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  CircleMarker,
  Popup,
  useMap,
} from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import * as turf from '@turf/turf';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { Form } from 'react-bootstrap';
import Shapefile from './Shapefile';
import shp from 'shpjs';
import { parseShapefileToLatLngs } from './utils/shapefileUtils';
import FileInput from './FileInput';
import GPSSubsetImageViewerModal from './GPSSubsetImageViewerModal';

// Define the GPS data structure
export interface GPSData {
  timestamp?: number;
  filepath?: string;
  lat: number;
  lng: number;
  alt: number;
}

// Define a polygon subset structure
interface PolygonSubset {
  id: string;
  coords: L.LatLngExpression[];
}

// Props for the component
export interface GPSSubsetProps {
  gpsData: GPSData[];
  onFilter: (filteredData: GPSData[]) => void;
  imageFiles?: File[];
  onShapefileParsed?: (latLngs: [number, number][]) => void;
}

// A helper component to fit the map view to the given GPS points
const FitBoundsToPoints: React.FC<{ points: GPSData[] }> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    const validPoints = points.filter(
      (p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)
    );
    if (validPoints.length > 0) {
      const bounds = L.latLngBounds(
        validPoints.map((p) => [p.lat, p.lng] as [number, number])
      );
      map.fitBounds(bounds);
    }
  }, []);
  return null;
};

// The main component
const GPSSubset: React.FC<GPSSubsetProps> = ({
  gpsData,
  onFilter,
  imageFiles,
  onShapefileParsed,
}) => {
  const [polygons, setPolygons] = useState<PolygonSubset[]>([]);
  const featureGroupRef = useRef<L.FeatureGroup>(null);
  const [shapefileBuffer, setShapefileBuffer] = useState<
    ArrayBuffer | undefined
  >(undefined);

  // Image modal state
  const [showImageModal, setShowImageModal] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [imageRotation, setImageRotation] = useState(0); // Global rotation for all images (0, 90, 180, 270)

  // Add object URL mapping for imageFiles to show thumbnails
  const [objectUrlMap, setObjectUrlMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (imageFiles) {
      const map: Record<string, string> = {};
      imageFiles.forEach((file) => {
        const relativePath = (file as any).webkitRelativePath as string;
        if (relativePath) {
          map[relativePath.toLowerCase()] = URL.createObjectURL(file);
        }
      });
      setObjectUrlMap(map);
      return () => {
        Object.values(map).forEach((url) => URL.revokeObjectURL(url));
      };
    }
  }, [imageFiles]);

  const validGpsData = gpsData.filter(
    (point) => Number.isFinite(point.lat) && Number.isFinite(point.lng)
  );

  const [currentFilteredPoints, setCurrentFilteredPoints] =
    useState<GPSData[]>(validGpsData);
  const [deletedPointsStack, setDeletedPointsStack] = useState<GPSData[][]>([]);
  // When a polygon is created
  const handleCreated = useCallback((e: any) => {
    const { layer } = e;
    let drawnCoords = layer.getLatLngs()[0] as L.LatLngExpression[];
    // Filter out invalid coordinates
    drawnCoords = drawnCoords.filter((coord) => {
      if (Array.isArray(coord)) {
        return Number.isFinite(coord[0]) && Number.isFinite(coord[1]);
      } else if (
        coord &&
        typeof coord === 'object' &&
        'lat' in coord &&
        'lng' in coord
      ) {
        return Number.isFinite(coord.lat) && Number.isFinite(coord.lng);
      }
      return false;
    });
    if (drawnCoords.length === 0) return;
    const newPolygon: PolygonSubset = {
      id: Date.now().toString(),
      coords: drawnCoords,
    };
    setPolygons((prev) => [...prev, newPolygon]);

    // Remove the temporary drawn layer and add a new one with an identifier
    if (featureGroupRef.current) {
      featureGroupRef.current.removeLayer(layer);
      const newLayer = L.polygon(newPolygon.coords);
      (newLayer as any).polygonId = newPolygon.id;
      newLayer.bindTooltip('Polygon ' + newPolygon.id, { permanent: false });
      featureGroupRef.current.addLayer(newLayer);
    }
  }, []);

  // When a polygon is edited
  const handleEdited = useCallback((e: any) => {
    e.layers.eachLayer((layer: any) => {
      if (layer instanceof L.Polygon && (layer as any).polygonId) {
        let editedCoords = layer.getLatLngs()[0] as L.LatLngExpression[];
        // Filter out invalid coordinates
        editedCoords = editedCoords.filter((coord) => {
          if (Array.isArray(coord)) {
            return Number.isFinite(coord[0]) && Number.isFinite(coord[1]);
          } else if (
            coord &&
            typeof coord === 'object' &&
            'lat' in coord &&
            'lng' in coord
          ) {
            return Number.isFinite(coord.lat) && Number.isFinite(coord.lng);
          }
          return false;
        });
        if (editedCoords.length === 0) return;
        const polygonId = (layer as any).polygonId;
        setPolygons((prev) =>
          prev.map((p) =>
            p.id === polygonId ? { ...p, coords: editedCoords } : p
          )
        );
      }
    });
  }, []);

  // When a polygon is deleted
  const handleDeleted = useCallback((e: any) => {
    e.layers.eachLayer((layer: any) => {
      if (layer instanceof L.Polygon && (layer as any).polygonId) {
        const polygonId = (layer as any).polygonId;
        setPolygons((prev) => prev.filter((p) => p.id !== polygonId));
      }
    });
  }, []);

  // Function to filter points within any drawn polygon
  const handleFilterPoints = useCallback(
    (exclude: boolean) => {
      if (polygons.length === 0) {
        return;
      }
      const newVisiblePoints: GPSData[] = [];
      const removedPoints: GPSData[] = [];
      currentFilteredPoints.forEach((point) => {
        const pt = turf.point([point.lng, point.lat]);
        const inside = polygons.some((polygon) => {
          const polyCoords = polygon.coords.map((coord) => {
            if (Array.isArray(coord)) {
              return [coord[1], coord[0]];
            } else if (
              coord &&
              typeof coord === 'object' &&
              'lat' in coord &&
              'lng' in coord
            ) {
              return [coord.lng, coord.lat];
            }
            return [0, 0];
          });
          if (
            JSON.stringify(polyCoords[0]) !==
            JSON.stringify(polyCoords[polyCoords.length - 1])
          ) {
            polyCoords.push(polyCoords[0]);
          }
          const turfPolygon = turf.polygon([polyCoords]);
          return turf.booleanPointInPolygon(pt, turfPolygon);
        });
        // If exclude is false, remove points inside the polygon.
        // If exclude is true, remove points outside the polygon.
        if ((!exclude && inside) || (exclude && !inside)) {
          removedPoints.push(point);
        } else {
          newVisiblePoints.push(point);
        }
      });
      // Record the removed points (for undo) and update current visible points
      setDeletedPointsStack((prev) => [...prev, removedPoints]);
      setCurrentFilteredPoints(newVisiblePoints);
      onFilter(newVisiblePoints);
      // Clear polygon layers after filtering points
      if (featureGroupRef.current) {
        featureGroupRef.current.clearLayers();
      }
      setPolygons([]);
    },
    [currentFilteredPoints, polygons, onFilter]
  );

  const handleUndo = useCallback(() => {
    setDeletedPointsStack((oldStack) => {
      if (oldStack.length === 0) {
        return oldStack;
      }
      const newStack = oldStack.slice(0, oldStack.length - 1);
      const lastDeleted = oldStack[oldStack.length - 1];
      setCurrentFilteredPoints((curr) => {
        const newVisible = [...curr, ...lastDeleted];
        onFilter(newVisible);
        return newVisible;
      });
      return newStack;
    });
  }, [onFilter]);

  const handleRemovePoint = useCallback(
    (index: number) => {
      setCurrentFilteredPoints((prevPoints) => {
        if (index < 0 || index >= prevPoints.length) return prevPoints;
        const removedPoint = prevPoints[index];
        const newPoints = prevPoints.filter((_, i) => i !== index);
        onFilter(newPoints);
        setDeletedPointsStack((prevStack) => [...prevStack, [removedPoint]]);
        return newPoints;
      });
    },
    [onFilter]
  );

  // Image modal handlers
  const handleViewImage = useCallback((index: number) => {
    setCurrentImageIndex(index);
    setShowImageModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowImageModal(false);
  }, []);

  const handleNextImage = useCallback(() => {
    setCurrentImageIndex((prev) => (prev + 1) % currentFilteredPoints.length);
  }, [currentFilteredPoints.length]);

  const handlePrevImage = useCallback(() => {
    setCurrentImageIndex((prev) =>
      prev === 0 ? currentFilteredPoints.length - 1 : prev - 1
    );
  }, [currentFilteredPoints.length]);

  const handleRemoveImage = useCallback(() => {
    handleRemovePoint(currentImageIndex);
    // Adjust current index if we're removing the last image or if the index is now out of bounds
    if (currentFilteredPoints.length === 1) {
      setShowImageModal(false);
    } else if (currentImageIndex >= currentFilteredPoints.length - 1) {
      setCurrentImageIndex(currentFilteredPoints.length - 2);
    }
  }, [currentImageIndex, currentFilteredPoints.length, handleRemovePoint]);

  const handleRotateImage = useCallback(() => {
    setImageRotation((prev) => (prev + 90) % 360);
  }, []);

  useEffect(() => {
    if (shapefileBuffer) {
      shp(shapefileBuffer)
        .then(async (geojson: any) => {
          let allowedPolygons: any[] = [];
          if (geojson.type === 'FeatureCollection') {
            allowedPolygons = geojson.features.filter(
              (feature: any) =>
                feature.geometry &&
                (feature.geometry.type === 'Polygon' ||
                  feature.geometry.type === 'MultiPolygon')
            );
          } else if (
            geojson.type === 'Feature' &&
            geojson.geometry &&
            (geojson.geometry.type === 'Polygon' ||
              geojson.geometry.type === 'MultiPolygon')
          ) {
            allowedPolygons = [geojson];
          }
          if (allowedPolygons.length === 0) {
            console.warn('No valid polygon found in shapefile');
            return;
          }
          // Apply shapefile filter relative to the current filtered set
          // and push the removed points onto the undo stack so this action is undoable.
          setCurrentFilteredPoints((prev) => {
            const newVisiblePoints: GPSData[] = [];
            const removedPoints: GPSData[] = [];
            prev.forEach((point) => {
              const pt = turf.point([point.lng, point.lat]);
              const inside = allowedPolygons.some((feature: any) =>
                turf.booleanPointInPolygon(pt, feature)
              );
              if (inside) {
                newVisiblePoints.push(point);
              } else {
                removedPoints.push(point);
              }
            });
            setDeletedPointsStack((stack) => [...stack, removedPoints]);
            onFilter(newVisiblePoints);
            return newVisiblePoints;
          });

          // Also parse to simplified [lat,lng] list for saving later
          try {
            const latLngs = await parseShapefileToLatLngs(shapefileBuffer);
            if (latLngs && onShapefileParsed) onShapefileParsed(latLngs);
          } catch (e) {
            console.error('Error simplifying shapefile for save', e);
          }
        })
        .catch((err: any) => {
          console.error('Error parsing shapefile', err);
        });
    }
  }, [shapefileBuffer]);

  return (
    <>
      <Form.Group className='mt-3'>
        <Form.Label className='mb-0'>Upload Shapefile (Optional)</Form.Label>
        <Form.Text className='d-block mb-1 mt-0' style={{ fontSize: '12px' }}>
          If you have a zipped shapefile, you can upload it here. Uploading this
          file will filter the GPS data to only include images within the
          shapefile.
        </Form.Text>
        <FileInput
          id='shapefile-file'
          fileType='.zip'
          onFileChange={async (files) => {
            const buffer = await files[0].arrayBuffer();
            setShapefileBuffer(buffer);
          }}
        >
          <p className='mb-0'>Select Shapefile</p>
        </FileInput>
      </Form.Group>
      <Form.Group className='mt-3 d-flex flex-column gap-2'>
        <div>
          <Form.Label className='d-block mb-0'>
            Filter Data by Polygon (Optional)
          </Form.Label>
          <Form.Text className='d-block' style={{ fontSize: '12px' }}>
            <b>These points represent your georeferenced images.</b>
          </Form.Text>
          <Form.Text style={{ fontSize: '12px' }}>
            Use this tool to filter out images based on a polygon.
            <ul>
              <li>
                Select the polygon function in the top-right corner of the map.
              </li>
              <li>Click to draw a polygon.</li>
              <li>
                Click "Include Images" to keep only the images within the
                polygon.
              </li>
              <li>
                Click "Remove Images" to remove the images within the polygon.
              </li>
              <li>Click "Undo" to reverse the last action.</li>
            </ul>
          </Form.Text>
        </div>
        <div style={{ height: '600px', width: '100%', position: 'relative' }}>
          <MapContainer
            style={{ height: '100%', width: '100%' }}
            center={[0, 0]}
            zoom={2}
          >
            <FitBoundsToPoints points={validGpsData} />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            />
            {shapefileBuffer && <Shapefile buffer={shapefileBuffer} />}
            <FeatureGroup ref={featureGroupRef}>
              <EditControl
                position='topright'
                onCreated={handleCreated}
                onEdited={handleEdited}
                onDeleted={handleDeleted}
                draw={{
                  polygon: {
                    allowIntersection: false,
                    shapeOptions: { color: '#97009c' },
                  },
                  rectangle: false,
                  circle: false,
                  circlemarker: false,
                  marker: false,
                  polyline: false,
                }}
                edit={{}}
              />
            </FeatureGroup>
            {validGpsData.map((point, index) => (
              <CircleMarker
                key={index}
                center={[point.lat, point.lng]}
                radius={3}
                color='orange'
              >
                <Popup>
                  <div>
                    {point.timestamp && (
                      <div>
                        <strong>Timestamp:</strong>{' '}
                        {new Date(point.timestamp).toISOString()}
                      </div>
                    )}
                    {point.filepath && (
                      <div>
                        <strong>Filepath:</strong> {point.filepath}
                      </div>
                    )}
                    <div>
                      <strong>Lng:</strong> {point.lng}
                    </div>
                    <div>
                      <strong>Lat:</strong> {point.lat}
                    </div>
                    <div>
                      <strong>Alt:</strong> {point.alt}
                    </div>
                    {point.filepath &&
                      objectUrlMap[point.filepath.toLowerCase()] && (
                        <div style={{ textAlign: 'center', margin: '8px 0' }}>
                          <img
                            src={objectUrlMap[point.filepath.toLowerCase()]}
                            alt={point.filepath}
                            style={{
                              maxWidth: '150px',
                              maxHeight: '150px',
                              objectFit: 'contain',
                              display: 'block',
                              margin: 'auto',
                            }}
                          />
                        </div>
                      )}
                    {point.filepath &&
                      objectUrlMap[point.filepath.toLowerCase()] && (
                        <Button
                          className='w-100 mt-2'
                          variant='primary'
                          size='sm'
                          onClick={() => handleViewImage(index)}
                        >
                          View Image
                        </Button>
                      )}
                    <Button
                      className='w-100 mt-2'
                      variant='danger'
                      size='sm'
                      onClick={() => handleRemovePoint(index)}
                    >
                      Remove
                    </Button>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MapContainer>
          <div
            className='d-flex flex-row gap-2 p-2'
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              backgroundColor: 'rgba(255,255,255,0.8)',
              border: '2px solid rgba(0, 0, 0, 0.28)',
              borderRadius: '4px',
            }}
          >
            <Button variant='info' onClick={() => handleFilterPoints(true)}>
              Include Images
            </Button>
            <Button variant='danger' onClick={() => handleFilterPoints(false)}>
              Remove Images
            </Button>
            <Button
              disabled={deletedPointsStack.length === 0}
              variant='outline-primary'
              onClick={handleUndo}
            >
              Undo
            </Button>
          </div>
        </div>
      </Form.Group>

      <GPSSubsetImageViewerModal
        showImageModal={showImageModal}
        imageData={{
          currentImageIndex,
          currentFilteredPoints,
          objectUrlMap,
          imageRotation,
        }}
        handlers={{
          handleCloseModal,
          handleNextImage,
          handlePrevImage,
          handleRotateImage,
          handleRemoveImage,
        }}
      />
    </>
  );
};

export default React.memo(GPSSubset);
