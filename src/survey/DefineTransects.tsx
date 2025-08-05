import React, { useState, useEffect, useContext, useRef } from 'react';
import { GlobalContext } from '../Context';
import { fetchAllPaginatedResults } from '../utils';
import { Form, Spinner, Button } from 'react-bootstrap';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polygon,
  useMap,
  FeatureGroup,
} from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import type {
  Feature as GeoJSONFeature,
  Polygon as GeoJSONPolygon,
  LineString as GeoJSONLineString,
} from 'geojson';
import 'leaflet/dist/leaflet.css';
import { EditControl } from 'react-leaflet-draw';
import 'leaflet-draw/dist/leaflet.draw.css';
import proj4 from 'proj4';

// tolerance in degrees for simplifying the transect line
const SIMPLIFY_TOLERANCE = 0.002;

// Finds the UTM projection for the given coordinates
function getUTMProjection(lon: number, lat: number) {
  const zone = Math.floor((lon + 180) / 6) + 1;
  const hemisphere = lat >= 0 ? 'north' : 'south';
  const projStr = `+proj=utm +zone=${zone} +datum=WGS84 +units=m +no_defs ${
    hemisphere === 'south' ? '+south' : ''
  }`;
  return projStr;
}

// generates the baseline and its length
function getProjectedDirectionalBaseline(
  polygon: GeoJSONFeature<GeoJSONPolygon>,
  bearing: number
): { baseline: GeoJSONFeature<GeoJSONLineString>; length: number } {
  // project everything to UTM to do this accurately
  const center = turf.centerOfMass(polygon).geometry.coordinates;
  const projStr = getUTMProjection(center[0], center[1]);
  const coords = turf.getCoords(polygon)[0] as [number, number][];
  const projected: [number, number][] = coords.map((pt) => {
    const [lon, lat] = pt;
    return proj4('WGS84', projStr, [lon, lat]) as [number, number];
  });

  // generate normal baseline vector
  const angleRad = (bearing * Math.PI) / 180;
  const dir = [Math.cos(angleRad), Math.sin(angleRad)];

  // project all vertices to the baseline and find the two most extreme distance values
  const projections = projected.map(([x, y]) => x * dir[0] + y * dir[1]);
  const minProj = Math.min(...projections);
  const maxProj = Math.max(...projections);

  // project the distances to points on the baseline
  const centerXY = proj4('WGS84', projStr, center);
  const pt1XY = [
    centerXY[0] + minProj * dir[0],
    centerXY[1] + minProj * dir[1],
  ];
  const pt2XY = [
    centerXY[0] + maxProj * dir[0],
    centerXY[1] + maxProj * dir[1],
  ];

  // transform back to coords
  const pt1LL = proj4(projStr, 'WGS84', pt1XY);
  const pt2LL = proj4(projStr, 'WGS84', pt2XY);

  // create a line and measure it
  const baseline = turf.lineString([pt1LL, pt2LL]);
  const length = turf.length(baseline, { units: 'meters' });

  return { baseline, length };
}

// finds the average transect heading and returns the orthogonal baseline heading
function getBaselineBearing(
  transectIds: number[],
  segmentedImages: Array<{
    longitude: number;
    latitude: number;
    transectId: number;
  }>
): number {
  // average transect heading
  const headings: number[] = [];
  transectIds.forEach((id) => {
    const imgs = segmentedImages.filter((si) => si.transectId === id);
    if (imgs.length >= 2) {
      const start = imgs[0];
      const end = imgs[imgs.length - 1];
      headings.push(
        turf.bearing(
          [start.longitude, start.latitude],
          [end.longitude, end.latitude]
        )
      );
    }
  });

  // average the headings - accounting for sign changes
  let avgHeading = 0;
  if (headings.length) {
    let sumX = 0,
      sumY = 0;
    headings.forEach((h) => {
      const rad = (h * Math.PI) / 180;
      sumX += Math.cos(rad);
      sumY += Math.sin(rad);
    });
    const avgRad = Math.atan2(sumY, sumX);
    avgHeading = (avgRad * 180) / Math.PI;
  }

  // baseline is orthogonal to the average
  const baselineBearing = (avgHeading + 90) % 360;

  return baselineBearing;
}

// define transects and strata
export default function DefineTransects({
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
  const [images, setImages] = useState<any[]>([]);
  const [partsLoading, setPartsLoading] = useState<null | number>(0);
  const [saving, setSaving] = useState(false);
  const [polygonCoords, setPolygonCoords] = useState<
    L.LatLngExpression[] | null
  >(null);
  const [segmentedImages, setSegmentedImages] = useState<
    (any & { transectId: number })[]
  >([]);
  const [contextMenu, setContextMenu] = useState<{
    position: L.LatLngExpression;
    img: any;
  } | null>(null);
  const [strataLines, setStrataLines] = useState<L.LatLngExpression[][]>([]);
  const [strataSections, setStrataSections] = useState<
    { coords: L.LatLngExpression[]; id: number }[]
  >([]);

  // Add state to track if existing transect data is present
  const [existingData, setExistingData] = useState<boolean>(false);
  // Add state for shapefile exclusion polygons
  const [exclusionCoords, setExclusionCoords] = useState<
    L.LatLngExpression[][]
  >([]);
  const transectIds = React.useMemo(() => {
    const ids = segmentedImages.map((img) => img.transectId);
    return Array.from(new Set(ids)).sort((a, b) => a - b);
  }, [segmentedImages]);
  const handleMove = (imgId: string, newTransectId: number) => {
    setSegmentedImages((prev) =>
      prev.map((si) =>
        si.id === imgId ? { ...si, transectId: newTransectId } : si
      )
    );
  };
  const clearStrata = () => {
    setExistingData(false);
    setStrataSections([]);
    setStrataLines([]);
  };

  // submit handler: creates strata, transects, and assigns images
  const handleSubmit = React.useCallback(async () => {
    if (!polygonCoords) return;

    // delete all existing strata so we can recreate them fresh
    const existingStrata = await fetchAllPaginatedResults<any, any>(
      client.models.Stratum.strataByProjectId as any,
      { projectId, limit: 1000, selectionSet: ['id'] } as any
    );
    await Promise.all(
      existingStrata.map((st: any) =>
        client.models.Stratum.delete({ id: st.id })
      )
    );

    // generate strata polys
    const stratumPolys: Record<number, GeoJSONFeature<GeoJSONPolygon>> = {};
    const stratumTransects: Record<number, number[]> = {};
    for (const section of strataSections) {
      const secLngLat = section.coords.map((coord) => {
        const [lat, lng] = coord as [number, number];
        return [lng, lat] as [number, number];
      });
      if (
        secLngLat[0][0] !== secLngLat[secLngLat.length - 1][0] ||
        secLngLat[0][1] !== secLngLat[secLngLat.length - 1][1]
      ) {
        secLngLat.push(secLngLat[0]);
      }
      const secPoly = turf.polygon([secLngLat]);
      stratumPolys[section.id] = secPoly;
      stratumTransects[section.id] = [];
    }

    // stratify transects
    for (const tid of transectIds) {
      const imgs = segmentedImages.filter((si) => si.transectId === tid);
      if (!imgs.length) continue;
      const rep = imgs[0];
      const repPt = turf.point([rep.longitude, rep.latitude]);
      let assigned: number | null = null;
      for (const section of strataSections) {
        const secPoly = stratumPolys[section.id];
        if (turf.booleanPointInPolygon(repPt, secPoly)) {
          assigned = section.id;
          break;
        }
      }
      if (assigned === null) continue;
      stratumTransects[assigned].push(tid);
    }

    // create strata
    const stratumMap: Record<number, string> = {};
    for (const section of strataSections) {
      const secPoly = stratumPolys[section.id];

      // calculate raw area of section polygon
      const rawArea = turf.area(secPoly);

      // subtract exclusion polygons entirely if they intersect
      let exclusionAreaSqm = 0;
      exclusionCoords.forEach((coords) => {
        if (coords.length < 3) return;
        const excCoordsLngLat = coords.map(
          ([lat, lng]) => [lng, lat] as [number, number]
        );
        // ensure closure
        if (
          excCoordsLngLat[0][0] !==
            excCoordsLngLat[excCoordsLngLat.length - 1][0] ||
          excCoordsLngLat[0][1] !==
            excCoordsLngLat[excCoordsLngLat.length - 1][1]
        ) {
          excCoordsLngLat.push(excCoordsLngLat[0]);
        }
        const exclusionPoly = turf.polygon([excCoordsLngLat]);
        // if exclusion overlaps this section, subtract full exclusion area
        if (turf.booleanIntersects(secPoly, exclusionPoly)) {
          exclusionAreaSqm += turf.area(exclusionPoly);
        }
      });

      // compute net area and convert to km²
      const netAreaSqm = rawArea - exclusionAreaSqm;
      const rawAreaKm = rawArea / 1e6;
      const exclusionAreaKm = exclusionAreaSqm / 1e6;
      const netAreaKm = netAreaSqm / 1e6;
      const area = netAreaKm;

      // compute baseline length
      const baselineBearing = getBaselineBearing(
        stratumTransects[section.id],
        segmentedImages
      );
      const { baseline, length } = getProjectedDirectionalBaseline(
        secPoly,
        baselineBearing
      );

      // create new stratum with polygon coordinates
      const secName = `Stratum ${section.id}`;
      const flatCoords = section.coords.flatMap(
        (coord) => coord as [number, number]
      );
      const {
        data: { id: newSid },
      } = await client.models.Stratum.create({
        projectId,
        name: secName,
        area,
        baselineLength: length,
        coordinates: flatCoords,
      });
      stratumMap[section.id] = newSid;
    }

    // create transects
    const transectMap: Record<number, string> = {};
    for (const tid of transectIds) {
      let assigned: number | null = null;
      for (const section of strataSections) {
        if (stratumTransects[section.id].includes(tid)) {
          assigned = section.id;
          break;
        }
      }

      if (assigned === null) continue;
      const strId = stratumMap[assigned];
      const {
        data: { id: trId },
      } = await client.models.Transect.create({
        projectId,
        stratumId: strId,
      });
      transectMap[tid] = trId;
    }

    // update images
    await Promise.all(
      segmentedImages.map(async (img) => {
        const trId = transectMap[img.transectId];
        if (trId) {
          await client.models.Image.update({ id: img.id, transectId: trId });
        }
      })
    );
    // cleanup: delete unused transects from the database
    const allTransects = await fetchAllPaginatedResults<any, any>(
      client.models.Transect.transectsByProjectId as any,
      { projectId, limit: 1000, selectionSet: ['id'] } as any
    );
    const usedTransectIds = new Set(Object.values(transectMap));
    await Promise.all(
      allTransects
        .map((t: any) => t.id)
        .filter((id: string) => !usedTransectIds.has(id))
        .map((id: string) => client.models.Transect.delete({ id }))
    );

    //clear jolly results
    const jollyResults = await fetchAllPaginatedResults<any, any>(
      client.models.JollyResult.jollyResultsBySurveyId as any,
      {
        surveyId: projectId,
        limit: 1000,
        selectionSet: [
          'surveyId',
          'stratumId',
          'annotationSetId',
          'categoryId',
        ],
      } as any
    );

    await Promise.all(
      jollyResults.map((jr: any) =>
        client.models.JollyResult.delete({
          surveyId: jr.surveyId,
          stratumId: jr.stratumId,
          annotationSetId: jr.annotationSetId,
          categoryId: jr.categoryId,
        })
      )
    );
  }, [
    polygonCoords,
    strataSections,
    segmentedImages,
    transectIds,
    projectId,
    client,
    exclusionCoords,
  ]);
  // register submit handler
  useEffect(() => {
    setHandleSubmit(() => async () => {
      setSubmitDisabled(true);
      setCloseDisabled(true);
      setSaving(true);

      await handleSubmit();

      setSaving(false);
      setSubmitDisabled(false);
      setCloseDisabled(false);
    });
    setSubmitDisabled(strataSections.length === 0);
  }, [strataSections, handleSubmit, setHandleSubmit, setSubmitDisabled]);

  // fetch images for project
  useEffect(() => {
    async function loadImages() {
      const imgs = (await fetchAllPaginatedResults<any, any>(
        client.models.Image.imagesByProjectId as any,
        {
          projectId,
          limit: 1000,
          selectionSet: [
            'id',
            'timestamp',
            'latitude',
            'longitude',
            'transectId',
          ],
        } as any
      )) as any[];
      // sort chronologically
      imgs.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      setImages(imgs);
      setPartsLoading((l) => (l === null ? 1 : l + 1));
    }
    loadImages();
  }, [client, projectId]);

  // Insert logic to load existing strata and transect assignments
  useEffect(() => {
    async function loadExistingData() {
      const existingStrata = await fetchAllPaginatedResults<any, any>(
        client.models.Stratum.strataByProjectId as any,
        {
          projectId,
          limit: 1000,
          selectionSet: ['id', 'coordinates', 'name'],
        } as any
      );
      if (existingStrata.length > 0) {
        setExistingData(true);
        const imgsWithTx = await fetchAllPaginatedResults<any, any>(
          client.models.Image.imagesByProjectId as any,
          {
            projectId,
            limit: 1000,
            selectionSet: [
              'id',
              'timestamp',
              'latitude',
              'longitude',
              'transectId',
            ],
          } as any
        );
        // build UI segment IDs from DB transect IDs
        const uniqueDbIds = Array.from(
          new Set(
            imgsWithTx
              .map((img) => img.transectId)
              .filter((id): id is string => id != null)
          )
        );
        uniqueDbIds.sort((a, b) => {
          const imgsA = imgsWithTx.filter((img) => img.transectId === a);
          const imgsB = imgsWithTx.filter((img) => img.transectId === b);
          return (
            new Date(imgsA[0].timestamp).getTime() -
            new Date(imgsB[0].timestamp).getTime()
          );
        });
        const dbToUI: Record<string, number> = {};
        uniqueDbIds.forEach((id, idx) => {
          dbToUI[id] = idx;
        });
        const segImgs = imgsWithTx.map((img) => ({
          ...img,
          transectId: img.transectId ? dbToUI[img.transectId] : 0,
        }));
        setSegmentedImages(segImgs);
        // load existing strata polygons into state
        const loadedSections = existingStrata.map((st: any) => {
          const flat = st.coordinates || [];
          const coords: L.LatLngExpression[] = [];
          for (let i = 0; i < flat.length; i += 2) {
            coords.push([flat[i], flat[i + 1]]);
          }
          const match = /^Stratum (\d+)$/.exec(st.name);
          const id = match ? parseInt(match[1], 10) : 0;
          return { coords, id };
        });
        setStrataSections(loadedSections);
      }

      setPartsLoading((l) => (l === null ? 1 : l + 1));
    }
    loadExistingData();
  }, [client, projectId]);

  // Add effect to load shapefile exclusion polygons
  useEffect(() => {
    async function loadExclusions() {
      const result = (await (
        client.models.ShapefileExclusions.shapefileExclusionsByProjectId as any
      )({ projectId })) as any;
      const data = result.data as Array<{ coordinates: (number | null)[] }>;
      const polys: L.LatLngExpression[][] = [];
      data.forEach((ex, idx) => {
        if (ex.coordinates) {
          const coordsArr = ex.coordinates.filter(
            (n): n is number => n != null
          );
          const latlngs: L.LatLngExpression[] = [];
          for (let i = 0; i < coordsArr.length; i += 2) {
            latlngs.push([coordsArr[i], coordsArr[i + 1]]);
          }
          // Log exclusion polygon area
          const excCoordsLngLat = latlngs.map(
            ([lat, lng]) => [lng, lat] as [number, number]
          );
          if (
            excCoordsLngLat[0][0] !==
              excCoordsLngLat[excCoordsLngLat.length - 1][0] ||
            excCoordsLngLat[0][1] !==
              excCoordsLngLat[excCoordsLngLat.length - 1][1]
          ) {
            excCoordsLngLat.push(excCoordsLngLat[0]);
          }
          polys.push(latlngs);
        }
      });
      setExclusionCoords(polys);

      setPartsLoading((l) => (l === null ? 1 : l + 1));
    }
    loadExclusions();
  }, [client, projectId]);

  // fetch existing shapefile polygon
  useEffect(() => {
    async function loadShapefile() {
      const result = (await (
        client.models.Shapefile.shapefilesByProjectId as any
      )({ projectId })) as any;
      const data = result.data as Array<{ coordinates: (number | null)[] }>;
      if (data.length > 0 && data[0].coordinates) {
        const coordsArr = data[0].coordinates.filter(
          (n): n is number => n != null
        );
        const latlngs: L.LatLngExpression[] = [];
        for (let i = 0; i < coordsArr.length; i += 2) {
          latlngs.push([coordsArr[i], coordsArr[i + 1]]);
        }
        // Log shapefile boundary area
        const boundaryLngLat = latlngs.map(
          ([lat, lng]) => [lng, lat] as [number, number]
        );
        if (
          boundaryLngLat[0][0] !==
            boundaryLngLat[boundaryLngLat.length - 1][0] ||
          boundaryLngLat[0][1] !== boundaryLngLat[boundaryLngLat.length - 1][1]
        ) {
          boundaryLngLat.push(boundaryLngLat[0]);
        }
        setPolygonCoords(latlngs);
      }

      setPartsLoading((l) => (l === null ? 1 : l + 1));
    }
    loadShapefile();
  }, [client, projectId]);

  // Modify segmentation to skip calculation if existing data loaded
  useEffect(() => {
    if (existingData) return;
    // only run segmentation once when no segments exist
    if (
      partsLoading === null &&
      images.length > 1 &&
      segmentedImages.length === 0
    ) {
      // build lineString in [lng,lat]
      const coords = images.map(
        (img) => [img.longitude, img.latitude] as [number, number]
      );
      const line = turf.lineString(coords);
      const simplified = turf.simplify(line, { tolerance: SIMPLIFY_TOLERANCE });
      const anchorCoords = simplified.geometry.coordinates as [
        number,
        number
      ][];
      // find original indices of anchor points
      const anchorIndices = anchorCoords
        .map((pt) => coords.findIndex((c) => c[0] === pt[0] && c[1] === pt[1]))
        .filter((idx) => idx >= 0)
        .sort((a, b) => a - b);
      // assign each image to a transect segment
      const segImgs = images.map((img, idx) => {
        let segId = anchorIndices.length - 1;
        for (let i = 0; i < anchorIndices.length - 1; i++) {
          if (idx >= anchorIndices[i] && idx < anchorIndices[i + 1]) {
            segId = i;
            break;
          }
        }
        return { ...img, transectId: segId };
      });
      setSegmentedImages(segImgs);
    }
  }, [images, partsLoading, existingData, segmentedImages]);

  // manual polygon splitting using Sutherland-Hodgman half-plane clipping
  const splitPolygon = (
    poly: L.LatLngExpression[],
    line: L.LatLngExpression[]
  ): [L.LatLngExpression[], L.LatLngExpression[]] => {
    const [p1, p2] = line as [L.LatLngExpression, L.LatLngExpression];
    const x1 = (p1 as [number, number])[1],
      y1 = (p1 as [number, number])[0];
    const x2 = (p2 as [number, number])[1],
      y2 = (p2 as [number, number])[0];
    const dx = x2 - x1,
      dy = y2 - y1;
    const clip = (keepLeft: boolean) => {
      const output: L.LatLngExpression[] = [];
      const sign = (x: number, y: number) =>
        keepLeft
          ? (x - x1) * dy - (y - y1) * dx >= 0
          : (x - x1) * dy - (y - y1) * dx <= 0;
      for (let i = 0; i < poly.length; i++) {
        const curr = poly[i] as [number, number];
        const next = poly[(i + 1) % poly.length] as [number, number];
        const xC = curr[1],
          yC = curr[0];
        const xN = next[1],
          yN = next[0];
        const currInside = sign(xC, yC);
        const nextInside = sign(xN, yN);
        if (currInside) output.push([curr[0], curr[1]]);
        if (currInside !== nextInside) {
          const denom = (xN - xC) * dy - (yN - yC) * dx;
          if (denom !== 0) {
            const t = ((x1 - xC) * dy - (y1 - yC) * dx) / denom;
            const xi = xC + t * (xN - xC);
            const yi = yC + t * (yN - yC);
            output.push([yi, xi]);
          }
        }
      }
      return output;
    };
    return [clip(true), clip(false)];
  };

  // compute strata sections when boundary or lines change
  useEffect(() => {
    if (existingData) return;
    if (!polygonCoords) return;
    let regions: L.LatLngExpression[][] = [polygonCoords];
    strataLines.forEach((line) => {
      const newRegions: L.LatLngExpression[][] = [];
      regions.forEach((region) => {
        const [a, b] = splitPolygon(region, [line[0], line[line.length - 1]]);
        if (a.length >= 3) newRegions.push(a);
        if (b.length >= 3) newRegions.push(b);
      });
      regions = newRegions;
    });
    setStrataSections(regions.map((coords, i) => ({ coords, id: i + 1 })));
  }, [polygonCoords, strataLines, existingData]);

  // component to fit map bounds to points
  const FitBounds: React.FC<{ points: any[] }> = ({ points }) => {
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
    }, [points, map]);
    return null;
  };

  useEffect(() => {
    if (partsLoading === null) return;
    if (partsLoading === 4) {
      setPartsLoading(null);
    }
  }, [partsLoading]);

  // a simple palette for transect colors
  const transectColors = [
    'red',
    'blue',
    'green',
    'orange',
    'purple',
    'brown',
    'pink',
    'cyan',
  ];
  const strataColors = [
    'yellow',
    'cyan',
    'magenta',
    'grey',
    'lightgreen',
    'lightblue',
    'lightcoral',
    'lightpink',
  ];
  // limit displayed transects to three before and after current
  const visibleTransectIds = contextMenu
    ? (() => {
        const current = contextMenu.img.transectId;
        const idx = transectIds.indexOf(current);
        const start = Math.max(0, idx - 2);
        const end = Math.min(transectIds.length, idx + 3);
        return transectIds.slice(start, end);
      })()
    : transectIds;

  return (
    <Form>
      <Form.Group className='d-flex flex-column'>
        <Form.Label className='mb-0'>Define Transects and Strata</Form.Label>
        <span className='text-muted mb-2' style={{ fontSize: '14px' }}>
          <ul className='mb-0'>
            <li>
              Transects are automatically defined based on the GPS data. Right
              click on an image to move it to a new or different transect and
              left click to view its details.
            </li>
            <li>
              Define strata by selecting the polyline tool in the top right
              corner of the map and drawing a line across the boundary.
            </li>
            <li>
              Save your work by clicking the save button at the bottom of the
              page.
            </li>
            {existingData && (
              <li>
                To make changes to strata, clear strata and redraw the strata
                lines.
              </li>
            )}
          </ul>
        </span>
        {existingData && (
          <Button
            variant='outline-primary'
            className='mb-2'
            onClick={clearStrata}
          >
            Clear Strata
          </Button>
        )}
        <div style={{ height: '600px', width: '100%', position: 'relative' }}>
          {partsLoading !== null ? (
            <div className='d-flex justify-content-center align-items-center mt-3'>
              <Spinner animation='border' />
              <span className='ms-2'>Loading data</span>
            </div>
          ) : (
            <MapContainer
              style={{ height: '100%', width: '100%' }}
              center={[0, 0]}
              zoom={2}
            >
              <FitBounds points={images} />
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
              {exclusionCoords.map((coords, idx) => (
                <Polygon
                  key={'exclusion-' + idx}
                  positions={coords}
                  pathOptions={{
                    color: 'red',
                    fillColor: 'red',
                    fillOpacity: 0.2,
                  }}
                />
              ))}
              {!existingData && (
                <FeatureGroup>
                  <EditControl
                    position='topright'
                    draw={{
                      rectangle: false,
                      circle: false,
                      circlemarker: false,
                      marker: false,
                      polygon: false,
                      polyline: {
                        shapeOptions: { color: 'black' },
                        maxPoints: 2,
                      },
                    }}
                    onCreated={(e: any) => {
                      if (e.layerType === 'polyline') {
                        const latlngs = e.layer
                          .getLatLngs()
                          .map(
                            (ll: L.LatLng) =>
                              [ll.lat, ll.lng] as L.LatLngExpression
                          );
                        setStrataLines((prev) => [...prev, latlngs]);
                      }
                    }}
                    onDeleted={(e: any) => {
                      // Remove deleted polylines from state
                      const layers = e.layers;
                      const removed: L.LatLngExpression[][] = [];
                      layers.eachLayer((layer: any) => {
                        const latlngs = layer
                          .getLatLngs()
                          .map(
                            (ll: L.LatLng) =>
                              [ll.lat, ll.lng] as L.LatLngExpression
                          );
                        removed.push(latlngs);
                      });
                      setStrataLines((prev) =>
                        prev.filter(
                          (line) =>
                            !removed.some(
                              (r) =>
                                r.length === line.length &&
                                r.every((pt, idx) => {
                                  const [rLat, rLng] = pt as [number, number];
                                  const [lLat, lLng] = line[idx] as [
                                    number,
                                    number
                                  ];
                                  return rLat === lLat && rLng === lLng;
                                })
                            )
                        )
                      );
                    }}
                    edit={{ remove: true, edit: false }}
                  />
                </FeatureGroup>
              )}
              {strataSections.map((section) => (
                <Polygon
                  key={`stratum-${section.id}`}
                  positions={section.coords}
                  pathOptions={{
                    fillColor: strataColors[section.id % strataColors.length],
                    color: strataColors[section.id % strataColors.length],
                    fillOpacity: 0.3,
                  }}
                >
                  <Popup>
                    <div>
                      <strong>Stratum:</strong> {section.id}
                    </div>
                  </Popup>
                </Polygon>
              ))}
              {partsLoading === null &&
                segmentedImages.map((img, idx) => (
                  <CircleMarker
                    pane='markerPane'
                    key={img.id}
                    center={[img.latitude, img.longitude]}
                    radius={5}
                    pathOptions={{
                      color:
                        transectColors[img.transectId % transectColors.length],
                      fillColor:
                        transectColors[img.transectId % transectColors.length],
                      fillOpacity: 1,
                    }}
                    eventHandlers={{
                      contextmenu: (e) => {
                        setContextMenu({ position: e.latlng, img });
                      },
                    }}
                  >
                    <Popup>
                      <div>
                        <strong>Transect:</strong> {img.transectId}
                      </div>
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
                    </Popup>
                  </CircleMarker>
                ))}
              {contextMenu && (
                <Popup
                  position={contextMenu.position}
                  eventHandlers={{ remove: () => setContextMenu(null) }}
                >
                  <div>
                    <strong>Move to transect:</strong>
                    {visibleTransectIds.map((id) => (
                      <div
                        key={id}
                        style={{
                          cursor: 'pointer',
                          color: transectColors[id % transectColors.length],
                          margin: '4px 0',
                        }}
                        onClick={() => {
                          handleMove(contextMenu.img.id, id);
                          setContextMenu(null);
                        }}
                      >
                        Transect {id}
                      </div>
                    ))}
                    <div
                      style={{
                        cursor: 'pointer',
                        margin: '4px 0',
                        color: 'black',
                        fontStyle: 'italic',
                      }}
                      onClick={() => {
                        const nextId =
                          transectIds.length > 0
                            ? transectIds[transectIds.length - 1] + 1
                            : 0;
                        handleMove(contextMenu.img.id, nextId);
                        setContextMenu(null);
                      }}
                    >
                      + New Transect
                    </div>
                  </div>
                </Popup>
              )}
            </MapContainer>
          )}
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
