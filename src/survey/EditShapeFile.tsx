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
import {
  parseShapefileToLatLngs,
  saveShapefileForProject,
} from '../utils/shapefileUtils';
import { Form, Spinner, Button } from 'react-bootstrap';
import { Footer } from '../Modal';
import FileInput from '../FileInput';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

export default function EditShapeFile({ projectId }: { projectId: string }) {
  const { client, showModal } = useContext(GlobalContext)!;
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
  const [drawMode, setDrawMode] = useState<'shapefile' | 'exclusions'>(
    'shapefile'
  );
  // disabledClose: only disables Close during active save; saveDisabled: governs Save button enablement
  const [disabledClose, setDisabledClose] = useState(false);
  const [saveDisabled, setSaveDisabled] = useState(false);

  // Adaptive simplification shared utility is imported as simplifyPolygonToRange

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
      parseShapefileToLatLngs(shapefileBuffer)
        .then((latLngs) => {
          if (latLngs)
            setPolygonCoords(latLngs as unknown as L.LatLngExpression[]);
        })
        .catch(console.error);
    }
  }, [shapefileBuffer]);

  // draw polygon on map when polygonCoords changes
  useEffect(() => {
    if (!featureGroupRef.current) return;
    featureGroupRef.current.clearLayers();
    if (polygonCoords) {
      const layer = L.polygon(polygonCoords, { color: '#97009c' });
      (layer as any).__isShapefile = true;
      featureGroupRef.current.addLayer(layer);
    }
  }, [polygonCoords]);

  // handle manual polygon drawn
  const onCreated = useCallback(
    (e: any) => {
      if (drawMode !== 'shapefile') return;
      const latlngs = (e.layer.getLatLngs()[0] as L.LatLng[]).map(
        ({ lat, lng }) => [lat, lng] as L.LatLngExpression
      );
      setPolygonCoords(latlngs);
    },
    [drawMode]
  );

  // handle polygon edits
  const onEdited = useCallback(
    (_e: any) => {
      if (drawMode !== 'shapefile') return;
      _e.layers.eachLayer((layer: any) => {
        if (
          featureGroupRef.current &&
          featureGroupRef.current.hasLayer(layer) &&
          (layer as any).__isShapefile
        ) {
          const latlngs = (layer.getLatLngs()[0] as L.LatLng[]).map(
            ({ lat, lng }) => [lat, lng] as L.LatLngExpression
          );
          setPolygonCoords(latlngs);
        }
      });
    },
    [drawMode]
  );

  // handle polygon deletion
  const onDeleted = useCallback(
    (_e?: any) => {
      if (drawMode !== 'shapefile') return;
      let shapefileWasDeleted = false;
      if (_e && _e.layers && typeof _e.layers.eachLayer === 'function') {
        _e.layers.eachLayer((layer: any) => {
          if ((layer as any).__isShapefile) shapefileWasDeleted = true;
        });
      }
      if (shapefileWasDeleted) setPolygonCoords(null);
    },
    [drawMode]
  );

  // enable submit only when polygon defined
  useEffect(() => {
    setSaveDisabled(!polygonCoords);
  }, [polygonCoords]);

  const saveShapefile = async () => {
    setDisabledClose(true);
    setSaving(true);

    if (!polygonCoords) return;
    const latLngs: [number, number][] = polygonCoords.map((pt) =>
      Array.isArray(pt)
        ? [pt[0] as number, pt[1] as number]
        : [pt.lat as number, pt.lng as number]
    );
    await saveShapefileForProject(
      client,
      projectId,
      latLngs as [number, number][]
    );
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
    const { data: strata } = await (
      client.models.Stratum.strataByProjectId as any
    )({
      projectId,
    });
    const { data: jollyResults } = await (
      client.models.JollyResult.jollyResultsBySurveyId as any
    )({
      surveyId: projectId,
    });

    await Promise.all(
      (strata as any[]).map((s: any) =>
        (client.models.Stratum.delete as any)({ id: s.id })
      )
    );
    await Promise.all(
      (jollyResults as any[]).map((r: any) =>
        (client.models.JollyResult.delete as any)({
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

    setDisabledClose(false);
    setSaving(false);
  };

  return (
    <>
      <Form className='p-3'>
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
          <Form.Group className='d-flex flex-column mb-2'>
            <Form.Label className='mb-0'>Drawing Mode</Form.Label>
            <div className='d-flex gap-3'>
              <Form.Check
                type='radio'
                id='mode-shapefile'
                label='Shapefile'
                name='draw-mode'
                checked={drawMode === 'shapefile'}
                onChange={() => setDrawMode('shapefile')}
              />
              <Form.Check
                type='radio'
                id='mode-exclusions'
                label='Exclusion Zones'
                name='draw-mode'
                checked={drawMode === 'exclusions'}
                onChange={() => setDrawMode('exclusions')}
              />
            </div>
            <span className='text-muted mt-1' style={{ fontSize: '14px' }}>
              Use the polygon tool with the selected mode to draw or edit.
              Exclusion zones will be deducted from the total area when
              computing results.
            </span>
          </Form.Group>
          <div style={{ height: '600px', width: '100%', position: 'relative' }}>
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
              {/* Shapefile feature group (single polygon) */}
              <FeatureGroup ref={featureGroupRef}>
                {drawMode === 'shapefile' && featureGroupRef.current ? (
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
                    edit={{ featureGroup: featureGroupRef.current } as any}
                  />
                ) : null}
              </FeatureGroup>
              {/* Exclusion zones feature group (multiple polygons) */}
              <FeatureGroup ref={exclusionFeatureGroupRef}>
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
                {drawMode === 'exclusions' &&
                exclusionFeatureGroupRef.current ? (
                  <EditControl
                    position='topright'
                    draw={{
                      rectangle: false,
                      circle: false,
                      circlemarker: false,
                      marker: false,
                      polyline: false,
                      polygon: {
                        shapeOptions: { color: 'red', fillOpacity: 0.3 },
                      },
                    }}
                    onCreated={(e: any) => {
                      if (e.layerType === 'polygon') {
                        const latlngs = (
                          e.layer.getLatLngs()[0] as L.LatLng[]
                        ).map(({ lat, lng }) => [lat, lng] as [number, number]);
                        setExclusionPolygons((prev) => [...prev, latlngs]);
                        if (exclusionFeatureGroupRef.current) {
                          exclusionFeatureGroupRef.current.removeLayer(e.layer);
                        }
                      }
                    }}
                    onEdited={() => {
                      if (exclusionFeatureGroupRef.current) {
                        const layers =
                          exclusionFeatureGroupRef.current.getLayers();
                        const newPolys: [number, number][][] = layers.map(
                          (layer: any) => {
                            const latlngs = (
                              layer.getLatLngs()[0] as L.LatLng[]
                            ).map(
                              ({ lat, lng }) => [lat, lng] as [number, number]
                            );
                            return latlngs;
                          }
                        );
                        setExclusionPolygons(newPolys);
                      }
                    }}
                    onDeleted={(e: any) => {
                      const removed: [number, number][][] = [];
                      e.layers.eachLayer((layer: any) => {
                        const latlngs = (
                          layer.getLatLngs()[0] as L.LatLng[]
                        ).map((ll) => [ll.lat, ll.lng] as [number, number]);
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
                      { featureGroup: exclusionFeatureGroupRef.current } as any
                    }
                  />
                ) : null}
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
      <Footer>
        <Button variant='primary' onClick={saveShapefile} disabled={saveDisabled || saving}>
          Save Shapefile
        </Button>
        <Button
          variant='dark'
          onClick={() => showModal(null)}
          disabled={disabledClose}
        >
          Close
        </Button>
      </Footer>
    </>
  );
}
