import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useContext } from 'react';
import { GlobalContext } from '../Context';
import { fetchAllPaginatedResults } from '../utils';
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
import shp from 'shpjs';
import * as turf from '@turf/turf';
import { Form } from 'react-bootstrap';
import FileInput from '../FileInput';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

export default function EditShapeFile({
  projectId,
  setHandleSubmit,
  setSubmitDisabled,
}: {
  projectId: string;
  setHandleSubmit: React.Dispatch<
    React.SetStateAction<(() => Promise<void>) | null>
  >;
  setSubmitDisabled: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { client } = useContext(GlobalContext)!;
  const [images, setImages] = useState<any[]>([]);
  const [loadingImages, setLoadingImages] = useState(true);
  const [polygonCoords, setPolygonCoords] = useState<
    L.LatLngExpression[] | null
  >(null);
  const featureGroupRef = useRef<L.FeatureGroup>(null);
  const [shapefileBuffer, setShapefileBuffer] = useState<ArrayBuffer>();

  // Adaptive simplification: if polygon has <=1000 points, keep raw; else increase tolerance until between 1000–1500 pts
  const simplifyToRange = (raw: [number, number][]): [number, number][] => {
    const minPoints = 1000;
    const maxPoints = 1500;
    if (raw.length <= minPoints) return raw;
    let tolerance = 1e-6;
    let coords: [number, number][];
    while (true) {
      const simplified = turf.simplify(turf.polygon([raw]), { tolerance });
      coords = simplified.geometry.coordinates[0] as [number, number][];
      if (coords.length <= maxPoints || tolerance > 1) {
        break;
      }
      tolerance *= 2;
    }
    return coords!;
  };

  // Fit map bounds to images
  const FitBoundsToPoints: React.FC<{ points: any[] }> = ({ points }) => {
    const map = useMap();
    useEffect(() => {
      const valid = points.filter(
        (p) => p.latitude != null && p.longitude != null
      );
      if (valid.length) {
        const bounds = L.latLngBounds(
          valid.map((p) => [p.latitude, p.longitude] as [number, number])
        );
        map.fitBounds(bounds);
      }
    }, [points]);
    return null;
  };

  useEffect(() => {
    // fetch images for project
    async function loadImages() {
      setLoadingImages(true);
      // fetch images (cast query function to any to avoid complex types)
      const imgs = (await fetchAllPaginatedResults<any, any>(
        client.models.Image.imagesByProjectId as any,
        { projectId, limit: 1000, selectionSet: [
            'id', 'originalPath', 'timestamp', 'latitude', 'longitude',
            'altitude_wgs84','altitude_egm96','altitude_agl'
          ] } as any
      )) as any[];
      setImages(imgs);
      setLoadingImages(false);
    }
    loadImages();
  }, [client, projectId]);

  useEffect(() => {
    // fetch existing shapefile if any
    async function loadShapefile() {
      // load existing shapefile (cast query function to any)
      const result = (await (
        client.models.Shapefile.shapefilesByProjectId as any
      )({ projectId })) as any;
      const data = result.data as Array<{ coordinates: (number | null)[] }>;
      if (data.length > 0 && data[0].coordinates) {
        // filter out any null entries
        const coordsArr = data[0].coordinates.filter((n): n is number => n != null);
        const coords: L.LatLngExpression[] = [];
        for (let i = 0; i < coordsArr.length; i += 2) {
          coords.push([coordsArr[i], coordsArr[i + 1]]);
        }
        setPolygonCoords(coords);
      }
    }
    loadShapefile();
  }, [client, projectId]);

  // parse and simplify shapefile upload into polygon coords
  useEffect(() => {
    if (shapefileBuffer) {
      shp(shapefileBuffer)
        .then((geojson: any) => {
          const features =
            geojson.features || (geojson.type === 'Feature' ? [geojson] : []);
          const poly = features.find(
            (f: any) =>
              f.geometry?.type === 'Polygon' ||
              f.geometry?.type === 'MultiPolygon'
          );
          if (poly) {
            // extract raw [lng, lat] pairs
            let coordsList: [number, number][] = [];
            if (poly.geometry.type === 'Polygon') coordsList = poly.geometry.coordinates[0];
            else coordsList = poly.geometry.coordinates[0][0];
            // ensure ring is closed
            const rawLonLat = [...coordsList];
            if (
              rawLonLat.length &&
              (rawLonLat[0][0] !== rawLonLat[rawLonLat.length - 1][0] ||
                rawLonLat[0][1] !== rawLonLat[rawLonLat.length - 1][1])
            ) {
              rawLonLat.push(rawLonLat[0]);
            }
            // adaptive simplify polygon
            const rawSimpleCoords = simplifyToRange(rawLonLat);
            // map back to [lat, lng] for Leaflet
            const simplifiedLatlngs: L.LatLngExpression[] = rawSimpleCoords.map(
              ([lng, lat]) => [lat, lng] as L.LatLngExpression
            );
            setPolygonCoords(simplifiedLatlngs);
          }
        })
        .catch(console.error);
    }
  }, [shapefileBuffer]);

  // draw polygon on map when polygonCoords changes
  useEffect(() => {
    if (polygonCoords && featureGroupRef.current) {
      featureGroupRef.current.clearLayers();
      const layer = L.polygon(polygonCoords, { color: '#97009c' });
      featureGroupRef.current.addLayer(layer);
    }
  }, [polygonCoords]);

  // handle manual polygon drawn
  const onCreated = useCallback((e: any) => {
    const latlngs = (e.layer.getLatLngs()[0] as L.LatLng[]).map(
      ({ lat, lng }) => [lat, lng] as L.LatLngExpression
    );
    setPolygonCoords(latlngs);
  }, []);

  // handle polygon edits
  const onEdited = useCallback((e: any) => {
    e.layers.eachLayer((layer: any) => {
      const latlngs = (layer.getLatLngs()[0] as L.LatLng[]).map(
        ({ lat, lng }) => [lat, lng] as L.LatLngExpression
      );
      setPolygonCoords(latlngs);
    });
  }, []);

  // handle polygon deletion
  const onDeleted = useCallback(() => {
    setPolygonCoords(null);
  }, []);

  // enable submit only when polygon defined
  useEffect(() => {
    setSubmitDisabled(!polygonCoords);
  }, [polygonCoords, setSubmitDisabled]);

  // set submit handler to save shapefile
  useEffect(() => {
    setHandleSubmit(() => async () => {
      setSubmitDisabled(true);
      if (!polygonCoords) return;
      // simplify polygon to reduce number of vertices
      // convert LatLngExpression ([lat,lng] or {lat,lng}) to [lng, lat]
      const rawLonLat: [number, number][] = polygonCoords.map((pt) =>
        Array.isArray(pt) ? [pt[1], pt[0]] : [pt.lng, pt.lat]
      );
      // ensure ring is closed
      if (
        rawLonLat.length &&
        (rawLonLat[0][0] !== rawLonLat[rawLonLat.length - 1][0] || rawLonLat[0][1] !== rawLonLat[rawLonLat.length - 1][1])
      ) {
        rawLonLat.push(rawLonLat[0]);
      }
      // adaptive simplify to desired point count range
      const rawSimple: [number, number][] = simplifyToRange(rawLonLat);
      const simpleCoords: [number, number][] = rawSimple;
      // flatten simplified coords back to [lat, lng]
      const flattened: number[] = [];
      simpleCoords.forEach(([lng, lat]) => {
        flattened.push(lat, lng);
      });
      // query Shapefile once to decide create vs update (cast function to any)
      const updateResult = (await (
        client.models.Shapefile.shapefilesByProjectId as any
      )({ projectId })) as any;
      const existing = updateResult.data as Array<{ id: string }>;
      if (existing.length > 0) {
        await (client.models.Shapefile.update as any)({ id: existing[0].id, coordinates: flattened });
      } else {
        await (client.models.Shapefile.create as any)({ projectId, coordinates: flattened });
      }
      setSubmitDisabled(false);
    });
  }, [client, projectId, polygonCoords, setHandleSubmit, setSubmitDisabled]);

  return (
    <Form>
      <Form.Group className='d-flex flex-column'>
        <Form.Label className='mb-0'>Upload or Draw Shapefile</Form.Label>
        <span className='text-muted mb-2' style={{ fontSize: '14px' }}>
          Select a shapefile to overlay on the map or draw a new one. Press "Save Shapefile" at the bottom of the page to save.
        </span>
        <FileInput
          id='shapefile-file'
          fileType='.zip'
          onFileChange={async (files) => {
            const buf = await files[0].arrayBuffer();
            setShapefileBuffer(buf);
          }}
        >
          <p className='mb-0'>Select Shapefile (optional)</p>
        </FileInput>
      </Form.Group>
      <Form.Group className='mt-3'>
        <div style={{ height: '600px', width: '100%', position: 'relative' }}>
          <MapContainer
            style={{ height: '100%', width: '100%' }}
            center={[0, 0]}
            zoom={2}
          >
            <FitBoundsToPoints points={images} />
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            />
            <FeatureGroup ref={featureGroupRef}>
              <EditControl
                position='topright'
                onCreated={onCreated}
                onEdited={onEdited}
                onDeleted={onDeleted}
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
                edit={ { featureGroup: featureGroupRef.current! } as any }
              />
            </FeatureGroup>
            {!loadingImages &&
              images.map((img, index) => (
                <CircleMarker
                  key={index}
                  center={[img.latitude, img.longitude]}
                  radius={3}
                  color='orange'
                >
                  <Popup>
                    {img.timestamp && (
                      <div>
                        <strong>Timestamp:</strong>{' '}
                        {new Date(img.timestamp).toISOString()}
                      </div>
                    )}
                    <div>
                      <strong>Lat:</strong> {img.latitude}
                    </div>
                    <div>
                      <strong>Lng:</strong> {img.longitude}
                    </div>
                    <div className='d-flex flex-column'>
                      {img.altitude_wgs84 && (
                        <div>
                          <strong>Alt (WGS84):</strong> {img.altitude_wgs84}
                        </div>
                      )}
                      {img.altitude_egm96 && (
                        <div>
                          <strong>Alt (EGM96):</strong> {img.altitude_egm96}
                        </div>
                      )}
                      {img.altitude_agl && (
                        <div>
                          <strong>Alt (AGL):</strong> {img.altitude_agl}
                        </div>
                      )}
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
          </MapContainer>
        </div>
      </Form.Group>
    </Form>
  );
}
