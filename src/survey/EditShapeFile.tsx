import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useContext } from 'react';
import { GlobalContext } from '../Context';
import {
  MapContainer,
  TileLayer,
  FeatureGroup,
  useMap,
  Polygon,
} from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import shp from 'shpjs';
import * as turf from '@turf/turf';
import { Form, Spinner } from 'react-bootstrap';
import FileInput from '../FileInput';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

export default function EditShapeFile({
  projectId,
  setHandleSubmit,
  setSubmitDisabled,
  setCloseDisabled,
}: {
  projectId: string;
  setHandleSubmit: React.Dispatch<
    React.SetStateAction<(() => Promise<void>) | null>
  >;
  setSubmitDisabled: React.Dispatch<React.SetStateAction<boolean>>;
  setCloseDisabled: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { client } = useContext(GlobalContext)!;
  const [polygonCoords, setPolygonCoords] = useState<
    L.LatLngExpression[] | null
  >(null);
  const featureGroupRef = useRef<L.FeatureGroup>(null);
  const [shapefileBuffer, setShapefileBuffer] = useState<ArrayBuffer>();
  const [exclusionPolygons, setExclusionPolygons] = useState<
    [number, number][][]
  >([]);
  const exclusionFeatureGroupRef = useRef<L.FeatureGroup>(null);
  const [saving, setSaving] = useState(false);
  const [loadingShapefile, setLoadingShapefile] = useState(false);

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

  // Fit map bounds to polygon coordinates
  const FitBoundsToCoords: React.FC<{ coords: L.LatLngExpression[] }> = ({
    coords,
  }) => {
    const map = useMap();
    useEffect(() => {
      if (coords && coords.length) {
        const bounds = L.latLngBounds(coords as [number, number][]);
        map.fitBounds(bounds);
      }
    }, [coords, map]);
    return null;
  };

  // fetch existing shapefile if any
  useEffect(() => {
    async function loadShapefile() {
      setLoadingShapefile(true);
      // load existing shapefile (cast query function to any)
      const result = (await (
        client.models.Shapefile.shapefilesByProjectId as any
      )({ projectId })) as any;
      const data = result.data as Array<{ coordinates: (number | null)[] }>;
      if (data.length > 0 && data[0].coordinates) {
        // filter out any null entries
        const coordsArr = data[0].coordinates.filter(
          (n): n is number => n != null
        );
        const coords: L.LatLngExpression[] = [];
        for (let i = 0; i < coordsArr.length; i += 2) {
          coords.push([coordsArr[i], coordsArr[i + 1]]);
        }
        setPolygonCoords(coords);
      }
      setLoadingShapefile(false);
    }
    loadShapefile();
  }, [client, projectId]);

  // fetch existing exclusion polygons if any
  useEffect(() => {
    async function loadExclusions() {
      const result = (await (
        client.models.ShapefileExclusions.shapefileExclusionsByProjectId as any
      )({ projectId })) as any;
      const data = result.data as Array<{ coordinates: (number | null)[] }>;
      const loadedPolys: [number, number][][] = [];
      data.forEach((item) => {
        if (item.coordinates) {
          const coordsArr = item.coordinates.filter(
            (n): n is number => n != null
          );
          const poly: [number, number][] = [];
          for (let i = 0; i < coordsArr.length; i += 2) {
            poly.push([coordsArr[i], coordsArr[i + 1]]);
          }
          loadedPolys.push(poly);
        }
      });
      setExclusionPolygons(loadedPolys);
    }
    loadExclusions();
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
            if (poly.geometry.type === 'Polygon')
              coordsList = poly.geometry.coordinates[0];
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
  const onEdited = useCallback((_e: any) => {
    _e.layers.eachLayer((layer: any) => {
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
      setCloseDisabled(true);
      setSaving(true);

      if (!polygonCoords) return;
      // simplify polygon to reduce number of vertices
      // convert LatLngExpression ([lat,lng] or {lat,lng}) to [lng, lat]
      const rawLonLat: [number, number][] = polygonCoords.map((pt) =>
        Array.isArray(pt) ? [pt[1], pt[0]] : [pt.lng, pt.lat]
      );
      // ensure ring is closed
      if (
        rawLonLat.length &&
        (rawLonLat[0][0] !== rawLonLat[rawLonLat.length - 1][0] ||
          rawLonLat[0][1] !== rawLonLat[rawLonLat.length - 1][1])
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
        await (client.models.Shapefile.update as any)({
          id: existing[0].id,
          coordinates: flattened,
        });
      } else {
        await (client.models.Shapefile.create as any)({
          projectId,
          coordinates: flattened,
        });
      }
      // save exclusion polygons
      const exResult = (await (
        client.models.ShapefileExclusions.shapefileExclusionsByProjectId as any
      )({ projectId })) as any;
      const existingExclusions = exResult.data as Array<{ id: string }>;
      // delete old exclusions
      await Promise.all(
        existingExclusions.map((ex: any) =>
          (client.models.ShapefileExclusions.delete as any)({ id: ex.id })
        )
      );
      // create new exclusions
      await Promise.all(
        exclusionPolygons.map((poly) => {
          const flatEx: number[] = [];
          poly.forEach((pt) => {
            const [lat, lng] = pt;
            flatEx.push(lat, lng);
          });
          return (client.models.ShapefileExclusions.create as any)({
            projectId,
            coordinates: flatEx,
          });
        })
      );

      // delete strata information and jolly results
      const { data: strata } = await client.models.Stratum.strataByProjectId({
        projectId,
      });
      const { data: jollyResults } =
        await client.models.JollyResult.jollyResultsBySurveyId({
          surveyId: projectId,
        });

      await Promise.all(
        strata.map((s: any) => client.models.Stratum.delete({ id: s.id }))
      );
      await Promise.all(
        jollyResults.map((r: any) =>
          client.models.JollyResult.delete({
            surveyId: projectId,
            stratumId: r.stratumId,
            annotationSetId: r.annotationSetId,
            categoryId: r.categoryId,
          })
        )
      );

      alert(
        'You have successfully updated the shapefile. Please review your strata and transects on the next tab and save your work whether you made any changes or not.'
      );

      setSubmitDisabled(false);
      setCloseDisabled(false);
      setSaving(false);
    });
  }, [
    client,
    projectId,
    polygonCoords,
    exclusionPolygons,
    setHandleSubmit,
    setSubmitDisabled,
    setCloseDisabled,
  ]);

  return (
    <Form>
      <Form.Group className='d-flex flex-column'>
        <Form.Label className='mb-0'>Upload or Draw Shapefile</Form.Label>
        <span className='text-muted mb-2' style={{ fontSize: '14px' }}>
          Select a shapefile to overlay on the map or draw a new one. Press
          "Save Shapefile" at the bottom of the page to save.
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
      {loadingShapefile && (
        <div className='d-flex justify-content-center align-items-center mt-3'>
          <Spinner animation='border' />
          <span className='ms-2'>Loading shapefile</span>
        </div>
      )}
      <Form.Group className='mt-3'>
        <div style={{ height: '600px', width: '100%', position: 'relative' }}>
          <MapContainer
            style={{ height: '100%', width: '100%' }}
            center={[0, 0]}
            zoom={2}
          >
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
                edit={{ featureGroup: featureGroupRef.current! } as any}
              />
              {polygonCoords && <FitBoundsToCoords coords={polygonCoords} />}
            </FeatureGroup>
          </MapContainer>
        </div>
        <Form.Group className='d-flex flex-column mt-3'>
          <Form.Label className='mb-0'>Exclusion Zones</Form.Label>
          <span className='text-muted mb-2' style={{ fontSize: '14px' }}>
            Use the polygon tool to draw exclusion zones within the boundary.
            These zones will be deducted from the total area of the shapefile
            when computing Jolly 2 results.
          </span>
        </Form.Group>
        {/* Second map for drawing exclusion polygons */}
        <div
          style={{
            height: '600px',
            width: '100%',
            position: 'relative',
          }}
        >
          <MapContainer
            style={{ height: '100%', width: '100%' }}
            center={[0, 0]}
            zoom={2}
          >
            {polygonCoords && <FitBoundsToCoords coords={polygonCoords} />}
            <TileLayer
              attribution='&copy; OpenStreetMap contributors'
              url='https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
            />
            {polygonCoords && (
              <Polygon
                positions={polygonCoords}
                pathOptions={{ fill: false, color: '#97009c' }}
              />
            )}
            <FeatureGroup ref={exclusionFeatureGroupRef}>
              <EditControl
                position='topright'
                draw={{
                  rectangle: false,
                  circle: false,
                  circlemarker: false,
                  marker: false,
                  polyline: false,
                  polygon: { shapeOptions: { color: 'red', fillOpacity: 0.3 } },
                }}
                onCreated={(e: any) => {
                  if (e.layerType === 'polygon') {
                    const latlngs = (e.layer.getLatLngs()[0] as L.LatLng[]).map(
                      ({ lat, lng }) => [lat, lng] as [number, number]
                    );
                    setExclusionPolygons((prev) => [...prev, latlngs]);
                    // remove the default drawn layer to avoid duplicate polygon
                    if (exclusionFeatureGroupRef.current) {
                      exclusionFeatureGroupRef.current.removeLayer(e.layer);
                    }
                  }
                }}
                onEdited={() => {
                  if (exclusionFeatureGroupRef.current) {
                    const layers = exclusionFeatureGroupRef.current.getLayers();
                    const newPolys: [number, number][][] = layers.map(
                      (layer: any) => {
                        const latlngs = (
                          layer.getLatLngs()[0] as L.LatLng[]
                        ).map(({ lat, lng }) => [lat, lng] as [number, number]);
                        return latlngs;
                      }
                    );
                    setExclusionPolygons(newPolys);
                  }
                }}
                onDeleted={(e: any) => {
                  const removed: [number, number][][] = [];
                  e.layers.eachLayer((layer: any) => {
                    const latlngs = (layer.getLatLngs()[0] as L.LatLng[]).map(
                      (ll) => [ll.lat, ll.lng] as [number, number]
                    );
                    removed.push(latlngs);
                  });
                  setExclusionPolygons((prev) =>
                    prev.filter(
                      (poly) =>
                        !removed.some(
                          (rem) =>
                            rem.length === poly.length &&
                            rem.every(([rLat, rLng], _idx) => {
                              const [pLat, pLng] = poly[_idx];
                              return rLat === pLat && rLng === pLng;
                            })
                        )
                    )
                  );
                }}
                edit={
                  { featureGroup: exclusionFeatureGroupRef.current! } as any
                }
              />
              {exclusionPolygons.map((poly) => (
                <Polygon
                  pane='markerPane'
                  key={`excl-${JSON.stringify(poly)}`}
                  positions={poly}
                  pathOptions={{
                    color: 'red',
                    fillColor: 'red',
                    fillOpacity: 0.3,
                  }}
                />
              ))}
            </FeatureGroup>
          </MapContainer>
        </div>
        {saving && (
          <div className='d-flex justify-content-center align-items-center mt-3'>
            <Spinner animation='border' />
            <span className='ms-2'>
              Saving, please do not close this window
            </span>
          </div>
        )}
      </Form.Group>
    </Form>
  );
}
