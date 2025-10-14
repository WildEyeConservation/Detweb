import React, { useState, useEffect, useContext, useRef } from 'react';
import { GlobalContext } from '../Context';
import { fetchAllPaginatedResults } from '../utils';
import { Form, Spinner, Button } from 'react-bootstrap';
import { Footer } from '../Modal';
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  Polygon,
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

// Utilities: validation and sanitization
function isFiniteNumber(n: any): n is number {
  return typeof n === 'number' && Number.isFinite(n) && !Number.isNaN(n);
}

function isValidLatLng(lat: any, lng: any): lat is number {
  return (
    isFiniteNumber(lat) &&
    isFiniteNumber(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

function toLatLngPairs(
  values: Array<number | null | undefined>
): [number, number][] {
  const pairs: [number, number][] = [];
  for (let i = 0; i + 1 < values.length; i += 2) {
    const lat = values[i] as any;
    const lng = values[i + 1] as any;
    if (isValidLatLng(lat, lng)) {
      pairs.push([lat, lng]);
    }
  }
  return pairs;
}

function filterValidImages<T extends { latitude: any; longitude: any }>(
  imgs: T[]
): T[] {
  return imgs.filter((img) => isValidLatLng(img.latitude, img.longitude));
}

// Impute missing/invalid lat/lng by time-based linear interpolation between
// nearest valid neighbors; falls back to nearest neighbor if only one side exists
function imputeLatLngForImages(
  imgs: Array<{
    id: any;
    timestamp: any;
    latitude: any;
    longitude: any;
  }>
): { filled: any[]; imputedIds: Set<any> } {
  if (!imgs || imgs.length === 0) return { filled: [], imputedIds: new Set() };
  const filled = imgs.map((img) => ({ ...img }));
  const n = filled.length;
  const isValid: boolean[] = filled.map((img) =>
    isValidLatLng(img.latitude, img.longitude)
  );
  const prevValidIdx: number[] = Array(n).fill(-1);
  const nextValidIdx: number[] = Array(n).fill(-1);
  let last = -1;
  for (let i = 0; i < n; i++) {
    if (isValid[i]) last = i;
    prevValidIdx[i] = last;
  }
  last = -1;
  for (let i = n - 1; i >= 0; i--) {
    if (isValid[i]) last = i;
    nextValidIdx[i] = last;
  }
  const imputedIds = new Set<any>();
  for (let i = 0; i < n; i++) {
    if (isValid[i]) continue;
    const p = prevValidIdx[i];
    const q = nextValidIdx[i];
    if (p !== -1 && q !== -1) {
      const t0 = new Date(filled[p].timestamp).getTime();
      const t1 = new Date(filled[q].timestamp).getTime();
      const ti = new Date(filled[i].timestamp).getTime();
      const denom = Math.max(t1 - t0, 1);
      const r = Math.min(Math.max((ti - t0) / denom, 0), 1);
      const lat =
        (filled[p].latitude as number) +
        r * ((filled[q].latitude as number) - (filled[p].latitude as number));
      const lng =
        (filled[p].longitude as number) +
        r * ((filled[q].longitude as number) - (filled[p].longitude as number));
      filled[i].latitude = lat;
      filled[i].longitude = lng;
      (filled[i] as any)._imputed = true;
      imputedIds.add(filled[i].id);
    } else if (p !== -1) {
      filled[i].latitude = filled[p].latitude;
      filled[i].longitude = filled[p].longitude;
      (filled[i] as any)._imputed = true;
      imputedIds.add(filled[i].id);
    } else if (q !== -1) {
      filled[i].latitude = filled[q].latitude;
      filled[i].longitude = filled[q].longitude;
      (filled[i] as any)._imputed = true;
      imputedIds.add(filled[i].id);
    }
  }
  return { filled, imputedIds };
}

// Normalize mixed timestamp units to milliseconds since epoch
function normalizeToMillis(ts: any): number {
  const n = typeof ts === 'string' ? Number(ts) : ts ?? 0;
  // If value looks like seconds (10 digits) convert to ms
  return n > 0 && n < 1e12 ? n * 1000 : n;
}

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
  // because we are going use treat the coords as cartesian coords - which falls apart quickly in normal WGS84
  const center = turf.centerOfMass(polygon).geometry.coordinates;
  const projStr = getUTMProjection(center[0], center[1]);
  const coords = turf.getCoords(polygon)[0] as [number, number][];
  const projected: [number, number][] = coords.map((pt) => {
    const [lon, lat] = pt;
    return proj4('WGS84', projStr, [lon, lat]) as [number, number];
  });
  const centerXY = proj4('WGS84', projStr, center);

  // Rotate all points into bearing-aligned frame
  const theta = (bearing * Math.PI) / 180;
  const rotated = projected.map(([x, y]) => {
    const dx = x - centerXY[0];
    const dy = y - centerXY[1];
    const xRot = dx * Math.cos(theta) - dy * Math.sin(theta);
    const yRot = dx * Math.sin(theta) + dy * Math.cos(theta);
    return [xRot, yRot];
  });

  // Now find min/max along the aligned axis (which is yRot)
  const yVals = rotated.map(([_, y]) => y);
  const minY = Math.min(...yVals);
  const maxY = Math.max(...yVals);

  // Project these max distances along the original baseline
  const pt1XY = [
    centerXY[0] + minY * Math.sin(theta),
    centerXY[1] + minY * Math.cos(theta),
  ];
  const pt2XY = [
    centerXY[0] + maxY * Math.sin(theta),
    centerXY[1] + maxY * Math.cos(theta),
  ];

  //convert back to WGS84 coords
  const pt1LL = proj4(projStr, 'WGS84', pt1XY);
  const pt2LL = proj4(projStr, 'WGS84', pt2XY);

  //create a line and calc its length
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

// merges small segments into closest neighbor based on first/last image GPS
function mergeSmallSegmentsByBoundary(
  segImgs: Array<any & { transectId: number }>,
  threshold: number
): Array<any & { transectId: number }> {
  const counts: Record<number, number> = segImgs.reduce((acc, img) => {
    acc[img.transectId] = (acc[img.transectId] || 0) + 1;
    return acc;
  }, {} as Record<number, number>);
  const segmentGroups: Record<number, typeof segImgs> = {};
  segImgs.forEach((img) => {
    segmentGroups[img.transectId] = segmentGroups[img.transectId] || [];
    segmentGroups[img.transectId].push(img);
  });
  Object.entries(counts).forEach(([key, count]) => {
    const id = Number(key);
    if (count > threshold) return;
    const group = segmentGroups[id];
    if (!group) return;
    const boundary = [group[0], group[group.length - 1]];
    const neighbors = [id - 1, id + 1].filter((nbr) => segmentGroups[nbr]);
    if (neighbors.length === 0) return;
    const neighborDist = (nbr: number): number => {
      let minDist = Infinity;
      segmentGroups[nbr].forEach((nbrImg) => {
        boundary.forEach((b) => {
          const d = turf.distance(
            turf.point([b.longitude, b.latitude]),
            turf.point([nbrImg.longitude, nbrImg.latitude]),
            { units: 'kilometers' }
          );
          if (d < minDist) minDist = d;
        });
      });
      return minDist;
    };
    let bestNeighbor = neighbors.reduce(
      (best, nbr) => (neighborDist(nbr) < neighborDist(best) ? nbr : best),
      neighbors[0]
    );
    segImgs.forEach((img) => {
      if (img.transectId === id) img.transectId = bestNeighbor;
    });
  });
  return segImgs;
}

// define transects and strata
export default function DefineTransects({ projectId }: { projectId: string }) {
  const { client, showModal } = useContext(GlobalContext)!;
  const [images, setImages] = useState<any[]>([]);
  const [partsLoading, setPartsLoading] = useState<null | number>(0);
  const [saving, setSaving] = useState(false);
  const [savingImageCount, setSavingImageCount] = useState(0);
  const [savingProgress, setSavingProgress] = useState(0);
  // disabledClose: only disables Close during active save; saveDisabled: governs Save button enablement
  const [disabledClose, setDisabledClose] = useState(false);
  const [saveDisabled, setSaveDisabled] = useState(false);
  const [polygonCoords, setPolygonCoords] = useState<
    L.LatLngExpression[] | null
  >(null);
  const [segmentedImages, setSegmentedImages] = useState<
    (any & { transectId: number })[]
  >([]);
  const [transectInfo, setTransectInfo] = useState<{
    position: L.LatLngExpression;
    transectId: number;
  } | null>(null);
  const [mergePrompt, setMergePrompt] = useState<{
    position: L.LatLngExpression;
    ids: number[];
  } | null>(null);
  const [selectedTransectIds, setSelectedTransectIds] = useState<Set<number>>(
    new Set()
  );
  const [drawnPolygonLayer, setDrawnPolygonLayer] = useState<L.Layer | null>(
    null
  );
  const [pendingPolygon, setPendingPolygon] = useState<{
    layer: L.Layer;
    enclosedImageIds: Set<any>;
    position: L.LatLngExpression;
  } | null>(null);
  const [strataLines, setStrataLines] = useState<L.LatLngExpression[][]>([]);
  const [strataSections, setStrataSections] = useState<
    { coords: L.LatLngExpression[]; id: number }[]
  >([]);

  // Add ref for map instance
  const mapRef = useRef<L.Map | null>(null);
  // Track if we've already fitted the map bounds
  const [hasFittedBounds, setHasFittedBounds] = useState(false);

  // Add state to track if existing transect data is present
  const [existingData, setExistingData] = useState<boolean>(false);
  // Add state for shapefile exclusion polygons
  const [exclusionCoords, setExclusionCoords] = useState<
    L.LatLngExpression[][]
  >([]);
  const [imputedImageIds, setImputedImageIds] = useState<Set<any>>(new Set());
  const transectIds = React.useMemo(() => {
    const ids = segmentedImages.map((img) => img.transectId);
    return Array.from(new Set(ids)).sort((a, b) => a - b);
  }, [segmentedImages]);

  // Polygon selection actions
  const clearPendingSelection = (removeLayer: boolean) => {
    if (removeLayer) {
      try {
        pendingPolygon?.layer.remove();
      } catch {}
    }
    setDrawnPolygonLayer(null);
    setPendingPolygon(null);
  };

  const assignPendingToNewTransect = () => {
    if (!pendingPolygon) return;
    const currentMax =
      segmentedImages.length > 0
        ? Math.max(...segmentedImages.map((si) => si.transectId))
        : -1;
    const newTransectId = isFiniteNumber(currentMax) ? currentMax + 1 : 0;
    const enclosedIds = pendingPolygon.enclosedImageIds;
    setSegmentedImages((prev) =>
      prev.map((si) =>
        enclosedIds.has(si.id) ? { ...si, transectId: newTransectId } : si
      )
    );
    setSelectedTransectIds(new Set([newTransectId]));
    clearPendingSelection(true);
  };

  // removed merge-into-existing option
  const transectImageCounts = React.useMemo(() => {
    const counts: Record<number, number> = {};
    segmentedImages.forEach((si) => {
      counts[si.transectId] = (counts[si.transectId] || 0) + 1;
    });
    return counts;
  }, [segmentedImages]);

  const handleMergeSelectedInto = (targetTransectId: number) => {
    setSegmentedImages((prev) =>
      prev.map((si) =>
        selectedTransectIds.has(si.transectId)
          ? { ...si, transectId: targetTransectId }
          : si
      )
    );
    setSelectedTransectIds(new Set());
    // Remove the drawn polygon after merging
    if (drawnPolygonLayer) {
      try {
        drawnPolygonLayer.remove();
      } catch {}
      setDrawnPolygonLayer(null);
    }
  };
  const clearStrata = () => {
    setExistingData(false);
    setStrataSections([]);
    setStrataLines([]);
  };

  // Jitter duplicate coordinates slightly so overlapping markers are visible
  const adjustedPositions = React.useMemo(() => {
    const byCoordKey: Record<string, (any & { transectId: number })[]> = {};
    const adjusted: Record<string, { latitude: number; longitude: number }> =
      {};
    const keyFor = (lat: number, lng: number) => `${lat},${lng}`;

    segmentedImages.forEach((img) => {
      const key = keyFor(img.latitude, img.longitude);
      (byCoordKey[key] = byCoordKey[key] || []).push(img);
    });

    Object.values(byCoordKey).forEach((group) => {
      if (group.length === 1) {
        const img = group[0];
        adjusted[img.id] = { latitude: img.latitude, longitude: img.longitude };
        return;
      }

      // Spread duplicates around a small circle (~5m radius)
      group.forEach((img, index) => {
        const latRad = (img.latitude * Math.PI) / 180;
        const radiusDeg = 0.00005; // ~5.5m in latitude
        const angle = (2 * Math.PI * index) / group.length;
        const dLat = radiusDeg * Math.sin(angle);
        const dLng =
          (radiusDeg * Math.cos(angle)) / Math.max(Math.cos(latRad), 1e-6);
        adjusted[img.id] = {
          latitude: img.latitude + dLat,
          longitude: img.longitude + dLng,
        };
      });
    });

    return adjusted;
  }, [segmentedImages]);

  // submit handler: creates strata, transects, and assigns images
  const handleSubmit = async () => {
    if (!polygonCoords) return;
    setDisabledClose(true);
    setSaving(true);

    // Calculate how many images will be linked to transects
    const imagesToUpdate = segmentedImages.filter(
      (img) => img.transectId != null
    );
    const imageCount = imagesToUpdate.length;
    setSavingImageCount(imageCount);
    setSavingProgress(0);

    // delete all existing strata so we can recreate them fresh
    const existingStrata = await fetchAllPaginatedResults(
      client.models.Stratum.strataByProjectId as any,
      { projectId, limit: 1000, selectionSet: ['id'] } as any
    );
    await Promise.all(
      existingStrata.map((st: any) =>
        (client.models.Stratum.delete as any)({ id: st.id })
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
        const excCoordsLngLat = coords.map((pt) => {
          if (Array.isArray(pt)) {
            const t = pt as [number, number];
            return [t[1], t[0]] as [number, number];
          }
          const ll = pt as any;
          return [ll.lng as number, ll.lat as number] as [number, number];
        });
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
      const netAreaKm = netAreaSqm / 1e6;
      const area = netAreaKm;

      // compute baseline length
      const baselineBearing = getBaselineBearing(
        stratumTransects[section.id],
        segmentedImages
      );
      const { length } = getProjectedDirectionalBaseline(
        secPoly,
        baselineBearing
      );

      // create new stratum with polygon coordinates
      const secName = `Stratum ${section.id}`;
      const flatCoords = section.coords.flatMap(
        (coord) => coord as [number, number]
      );
      const createStratumRes = await (client.models.Stratum.create as any)({
        projectId,
        name: secName,
        area,
        baselineLength: length,
        coordinates: flatCoords,
      });
      const newSid = createStratumRes.data.id as string;
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
      const createTransectRes = await (client.models.Transect.create as any)({
        projectId,
        stratumId: strId,
      });
      const trId = createTransectRes.data.id as string;
      transectMap[tid] = trId;
    }

    // update images with progress tracking
    await Promise.all(
      segmentedImages.map(async (img) => {
        const trId = transectMap[img.transectId];
        if (trId) {
          const update: any = {
            id: img.id,
            transectId: trId,
          };
          // if this image had imputed coordinates, persist them back
          if (imputedImageIds.has(img.id)) {
            update.latitude = img.latitude;
            update.longitude = img.longitude;
          }
          await (client.models.Image.update as any)(update);
          setSavingProgress((p) => p + 1);
        }
      })
    );

    // cleanup: delete unused transects from the database
    const allTransects = await fetchAllPaginatedResults(
      client.models.Transect.transectsByProjectId as any,
      { projectId, limit: 1000, selectionSet: ['id'] } as any
    );
    const usedTransectIds = new Set(Object.values(transectMap));
    await Promise.all(
      allTransects
        .map((t: any) => t.id)
        .filter((id: string) => !usedTransectIds.has(id))
        .map((id: string) => (client.models.Transect.delete as any)({ id }))
    );

    //clear jolly results
    const jollyResults = await fetchAllPaginatedResults(
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
        (client.models.JollyResult.delete as any)({
          surveyId: jr.surveyId,
          stratumId: jr.stratumId,
          annotationSetId: jr.annotationSetId,
          categoryId: jr.categoryId,
        })
      )
    );

    setDisabledClose(false);
    setSaving(false);
    setSavingImageCount(0);
    setSavingProgress(0);
  };

  useEffect(() => {
    setSaveDisabled(strataSections.length === 0);
  }, [strataSections]);

  // fetch images for project
  useEffect(() => {
    async function loadImages() {
      const rawImgs = (await fetchAllPaginatedResults(
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
      // normalize timestamp unit and sort chronologically before imputation
      rawImgs.forEach((img) => {
        img.timestamp = normalizeToMillis(img.timestamp);
      });
      rawImgs.sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );
      const { filled, imputedIds } = imputeLatLngForImages(rawImgs);
      setImages(filled);
      setImputedImageIds((prev) => {
        const next = new Set(prev);
        imputedIds.forEach((id) => next.add(id));
        return next;
      });
      setPartsLoading((l) => (l === null ? 1 : l + 1));
    }
    loadImages();
  }, [client, projectId]);

  // Insert logic to load existing strata and transect assignments
  useEffect(() => {
    async function loadExistingData() {
      const existingStrata = await fetchAllPaginatedResults(
        client.models.Stratum.strataByProjectId as any,
        {
          projectId,
          limit: 1000,
          selectionSet: ['id', 'coordinates', 'name'],
        } as any
      );
      if (existingStrata.length > 0) {
        setExistingData(true);
        const rawImgsWithTx = await fetchAllPaginatedResults(
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
        const imgsWithTxRaw = rawImgsWithTx as any[];
        imgsWithTxRaw.forEach((img) => {
          img.timestamp = normalizeToMillis(img.timestamp);
        });
        imgsWithTxRaw.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
        const { filled: imgsWithTx, imputedIds: impIds } =
          imputeLatLngForImages(imgsWithTxRaw);
        setImputedImageIds((prev) => {
          const next = new Set(prev);
          impIds.forEach((id) => next.add(id));
          return next;
        });
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
        const loadedSections = existingStrata
          .map((st: any) => {
            const flat = st.coordinates || [];
            const latlngs = toLatLngPairs(
              (flat as Array<number | null>).filter(
                (n): n is number => n != null
              )
            ) as L.LatLngExpression[];
            if (latlngs.length < 3) return null;
            const match = /^Stratum (\d+)$/.exec(st.name);
            const id = match ? parseInt(match[1], 10) : 0;
            return { coords: latlngs, id };
          })
          .filter(
            (x): x is { coords: L.LatLngExpression[]; id: number } => !!x
          );
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
      data.forEach((ex) => {
        if (ex.coordinates) {
          const coordsArr = ex.coordinates.filter(
            (n): n is number => n != null
          );
          const latlngs = toLatLngPairs(coordsArr) as L.LatLngExpression[];
          if (latlngs.length < 3) return;
          // Log exclusion polygon area
          const excCoordsLngLat = latlngs.map((pt) => {
            if (Array.isArray(pt)) {
              const t = pt as [number, number];
              return [t[1], t[0]] as [number, number];
            }
            const ll = pt as any;
            return [ll.lng as number, ll.lat as number] as [number, number];
          });
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
        const latlngs = toLatLngPairs(coordsArr) as L.LatLngExpression[];
        if (latlngs.length < 3) {
          setPartsLoading((l) => (l === null ? 1 : l + 1));
          return;
        }
        // Log shapefile boundary area
        const boundaryLngLat = latlngs.map((pt) => {
          if (Array.isArray(pt)) {
            const t = pt as [number, number];
            return [t[1], t[0]] as [number, number];
          }
          const ll = pt as any;
          return [ll.lng as number, ll.lat as number] as [number, number];
        });
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
    if (partsLoading === null && segmentedImages.length === 0) {
      const validImgs = images.filter((img) =>
        isValidLatLng(img.latitude, img.longitude)
      );
      if (validImgs.length <= 1) return;
      // build lineString in [lng,lat]
      const coords = validImgs.map(
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
      const segImgs = validImgs.map((img, idx) => {
        let segId = anchorIndices.length - 1;
        for (let i = 0; i < anchorIndices.length - 1; i++) {
          if (idx >= anchorIndices[i] && idx < anchorIndices[i + 1]) {
            segId = i;
            break;
          }
        }
        return { ...img, transectId: segId };
      });
      const mergedSegImgs = mergeSmallSegmentsByBoundary(segImgs, 5);
      // compact transect ids to be sequential
      const uniqueIds: number[] = Array.from(
        new Set(mergedSegImgs.map((img: any) => img.transectId))
      ).sort((a: number, b: number) => a - b);
      const idMap: Record<number, number> = uniqueIds.reduce<
        Record<number, number>
      >((acc, oldId, index) => {
        acc[oldId] = index;
        return acc;
      }, {});
      mergedSegImgs.forEach((img: any) => {
        img.transectId = idMap[img.transectId];
      });
      setSegmentedImages(mergedSegImgs);
    }
  }, [images, partsLoading, existingData, segmentedImages]);

  // Split a polygon by a multi-vertex polyline. Returns 1 or 2 polygons (open rings in [lat,lng]).
  const splitPolygon = (
    poly: L.LatLngExpression[],
    line: L.LatLngExpression[]
  ): L.LatLngExpression[][] => {
    if (poly.length < 3 || line.length < 2) return [poly];

    // Convert to [lng,lat]
    const ringLngLat = ((): [number, number][] => {
      const arr: [number, number][] = [];
      for (let i = 0; i < poly.length; i++) {
        const [lat, lng] = poly[i] as [number, number];
        arr.push([lng, lat]);
      }
      // ensure closure
      if (
        arr[0][0] !== arr[arr.length - 1][0] ||
        arr[0][1] !== arr[arr.length - 1][1]
      ) {
        arr.push([arr[0][0], arr[0][1]]);
      }
      return arr;
    })();
    const lineLngLat: [number, number][] = line.map((pt) => {
      const [lat, lng] = pt as [number, number];
      return [lng, lat];
    });

    const polyFC = turf.polygon([ringLngLat]);
    const lineFC = turf.lineString(lineLngLat);
    const boundary = turf.polygonToLine(polyFC);
    const intersections = turf.lineIntersect(lineFC, boundary);

    // Deduplicate intersections
    const uniqKey = (c: [number, number]) =>
      `${c[0].toFixed(10)},${c[1].toFixed(10)}`;
    const uniquePtsMap: Record<string, any> = {};
    intersections.features.forEach((f) => {
      const c = f.geometry.coordinates as [number, number];
      uniquePtsMap[uniqKey(c)] = f as any;
    });
    const uniquePts = Object.values(uniquePtsMap);

    if (uniquePts.length < 2) {
      // No proper cut; return original
      return [poly];
    }

    // Order intersections along the polyline
    const withLoc = uniquePts
      .map((pt) => {
        const onLine = turf.nearestPointOnLine(lineFC, pt);
        return { pt, location: (onLine.properties as any).location as number };
      })
      .sort((a, b) => a.location - b.location);
    const aPt = withLoc[0].pt;
    const bPt = withLoc[withLoc.length - 1].pt;

    // Find ring segment indices where intersections occur
    const ringLine = turf.lineString(ringLngLat);
    const aOnRing = turf.nearestPointOnLine(ringLine, aPt);
    const bOnRing = turf.nearestPointOnLine(ringLine, bPt);
    const aIdx = (aOnRing.properties as any).index as number;
    const bIdx = (bOnRing.properties as any).index as number;

    // Slice the polyline between a->b
    const lineSlice = turf.lineSlice(aPt, bPt, lineFC);
    const lineSliceCoords = turf.getCoords(lineSlice) as [number, number][];

    // Helper to collect ring path going forward from idxA+1 .. idxB
    const ringNoClose = ringLngLat.slice(0, ringLngLat.length - 1);
    const ringLen = ringNoClose.length;
    const collectRingPath = (
      startIdx: number,
      endIdx: number,
      startCoord: [number, number],
      endCoord: [number, number]
    ): [number, number][] => {
      const path: [number, number][] = [];
      path.push(startCoord);
      let i = (startIdx + 1) % ringLen;
      while (true) {
        path.push(ringNoClose[i]);
        if (i === endIdx) break;
        i = (i + 1) % ringLen;
      }
      // Avoid duplicating end vertex if identical to endCoord
      const last = path[path.length - 1];
      if (last[0] !== endCoord[0] || last[1] !== endCoord[1]) {
        path.push(endCoord);
      }
      return path;
    };

    const aCoord = aPt.geometry.coordinates as [number, number];
    const bCoord = bPt.geometry.coordinates as [number, number];
    const aT = ((aOnRing.properties as any)?.t as number | undefined) ?? 0;
    const bT = ((bOnRing.properties as any)?.t as number | undefined) ?? 1;

    // Build ring paths between intersections, with special handling when both
    // intersections lie on the same edge (aIdx === bIdx)
    let path1: [number, number][]; // A -> ... -> B along ring
    let path2: [number, number][]; // B -> ... -> A along ring
    if (aIdx === bIdx) {
      if (aT <= bT) {
        // Small forward segment along the same edge
        path1 = [aCoord, bCoord];
        // Complement goes the long way around the ring
        path2 = collectRingPath(bIdx, aIdx, bCoord, aCoord);
      } else {
        // Forward path wraps around the ring
        path1 = collectRingPath(aIdx, bIdx, aCoord, bCoord);
        // Complement is the small segment along the same edge (backwards)
        path2 = [bCoord, aCoord];
      }
    } else {
      path1 = collectRingPath(aIdx, bIdx, aCoord, bCoord); // A -> ... -> B (ring)
      path2 = collectRingPath(bIdx, aIdx, bCoord, aCoord); // B -> ... -> A (ring)
    }

    // Compose polygons by adding the polyline segment (nonlinear) to close loops
    const segAtoB = lineSliceCoords; // A -> ... -> B
    const segBtoA = lineSliceCoords.slice().reverse(); // B -> ... -> A

    // Append without duplicating endpoints
    const region1LngLat: [number, number][] = [
      ...path1,
      ...segBtoA.slice(1, -1), // B..A (without duplicating B and A)
    ];
    const region2LngLat: [number, number][] = [
      ...path2,
      ...segAtoB.slice(1, -1), // A..B (without duplicating A and B)
    ];

    // Convert back to [lat,lng] and ensure open rings (no duplicate last == first)
    const toLatLng = (coords: [number, number][]): L.LatLngExpression[] => {
      if (coords.length === 0) return [];
      const out = coords.map(([x, y]) => [y, x] as [number, number]);
      const first = out[0] as [number, number];
      const last = out[out.length - 1] as [number, number];
      if (first[0] === last[0] && first[1] === last[1]) out.pop();
      return out;
    };

    const r1 = toLatLng(region1LngLat);
    const r2 = toLatLng(region2LngLat);

    // Validate minimal polygon
    const results: L.LatLngExpression[][] = [];
    if (r1.length >= 3) results.push(r1);
    if (r2.length >= 3) results.push(r2);
    return results.length ? results : [poly];
  };

  // compute strata sections when boundary or lines change
  useEffect(() => {
    if (existingData) return;
    if (!polygonCoords) return;
    let regions: L.LatLngExpression[][] = [polygonCoords];
    strataLines.forEach((line) => {
      const newRegions: L.LatLngExpression[][] = [];
      regions.forEach((region) => {
        const parts = splitPolygon(region, line);
        parts.forEach((p) => {
          if (p.length >= 3) newRegions.push(p);
        });
      });
      regions = newRegions;
    });
    setStrataSections(regions.map((coords, i) => ({ coords, id: i + 1 })));
  }, [polygonCoords, strataLines, existingData]);

  useEffect(() => {
    if (partsLoading === null) return;
    if (partsLoading === 4) {
      setPartsLoading(null);
    }
  }, [partsLoading]);

  // Fit map to image points on initial load
  useEffect(() => {
    if (segmentedImages.length > 0 && !hasFittedBounds) {
      // Use a timeout to ensure map is fully rendered
      const timeoutId = setTimeout(() => {
        if (mapRef.current) {
          try {
            const points = segmentedImages
              .map((img) => {
                const pos = adjustedPositions[img.id] || {
                  latitude: img.latitude,
                  longitude: img.longitude,
                };
                return [pos.latitude, pos.longitude] as [number, number];
              })
              .filter(([lat, lng]) => {
                // Filter out invalid coordinates
                return (
                  lat >= -90 &&
                  lat <= 90 &&
                  lng >= -180 &&
                  lng <= 180 &&
                  !isNaN(lat) &&
                  !isNaN(lng)
                );
              });

            if (points.length > 0) {
              const bounds = L.latLngBounds(points);
              console.log(
                'Fitting map bounds to',
                points.length,
                'points:',
                bounds
              );

              // Add some padding to the bounds
              mapRef.current.fitBounds(bounds, { padding: [20, 20] });
              setHasFittedBounds(true);
            } else {
              console.warn('No valid points found for fitting bounds');
            }
          } catch (error) {
            console.error('Error fitting map bounds:', error);
          }
        } else {
          console.warn('Map reference not available for fitting bounds');
        }
      }, 100); // Small delay to ensure map is rendered

      return () => clearTimeout(timeoutId);
    }
  }, [segmentedImages, adjustedPositions, hasFittedBounds]);

  // Reset fit bounds flag when project changes
  useEffect(() => {
    setHasFittedBounds(false);
  }, [projectId]);

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
  // right-click popup shows transect info only

  return (
    <>
      <Form className="p-3">
        <Form.Group className="d-flex flex-column">
          <Form.Label className="mb-0">Define Transects and Strata</Form.Label>
          <span className="text-muted mb-2" style={{ fontSize: '14px' }}>
            <ul className="mb-0">
              <li>
                Single-click a point to select its transect (Ctrl-click for
                multi-select). Clicking a selected transect will deselect it.
              </li>
              <li>
                Right-click a point to view that transect's info (name/number
                and image count). If multiple transects are selected,
                right-click to merge them, or use the "Merge Selected Transects"
                button that appears at the bottom of the map.
              </li>
              <li>
                Use the polygon tool (top-right) to draw around points, then
                click "Merge points" to put only the enclosed points into a new
                transect.
              </li>
              <li>
                Define strata by selecting the polyline tool in the top right
                corner of the map and drawing a line across the boundary. Start
                and end points should be outside the boundary.
              </li>
              <li>
                Save your work by clicking the save button at the bottom of the
                page (even if you haven't made any changes).
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
              variant="outline-primary"
              className="mb-2"
              onClick={clearStrata}
            >
              Clear Strata
            </Button>
          )}
          <div style={{ height: '600px', width: '100%', position: 'relative' }}>
            {partsLoading !== null ? (
              <div className="d-flex justify-content-center align-items-center mt-3">
                <Spinner animation="border" />
                <span className="ms-2">Loading data</span>
              </div>
            ) : (
              <MapContainer
                ref={mapRef}
                style={{ height: '100%', width: '100%' }}
                center={[0, 0]}
                zoom={2}
                doubleClickZoom={false}
                preferCanvas={false}
              >
                <TileLayer
                  attribution="&copy; OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {polygonCoords && (
                  <Polygon
                    positions={polygonCoords}
                    pathOptions={{ fill: false, color: '#97009c' }}
                  />
                )}
                {/* Polygon selection tool - always available */}
                <FeatureGroup>
                  <EditControl
                    position="topright"
                    draw={{
                      rectangle: false,
                      circle: false,
                      circlemarker: false,
                      marker: false,
                      polyline: false,
                      polygon: {
                        shapeOptions: { color: 'black' },
                      },
                    }}
                    edit={{ edit: false, remove: false }}
                    onCreated={(e: any) => {
                      if (e.layerType === 'polygon') {
                        const latlngs = e.layer.getLatLngs();
                        // Support simple polygon (first ring)
                        const ring: L.LatLng[] = Array.isArray(latlngs[0])
                          ? latlngs[0]
                          : latlngs;
                        const polyLngLat: [number, number][] = (
                          ring as any[]
                        ).map((ll: any) => [
                          ll.lng as number,
                          ll.lat as number,
                        ]);
                        if (
                          polyLngLat[0][0] !==
                            polyLngLat[polyLngLat.length - 1][0] ||
                          polyLngLat[0][1] !==
                            polyLngLat[polyLngLat.length - 1][1]
                        ) {
                          polyLngLat.push(polyLngLat[0]);
                        }
                        const poly = turf.polygon([polyLngLat]);
                        // Find enclosed images using displayed positions
                        const enclosedImgs = segmentedImages.filter((img) => {
                          const pos = adjustedPositions[img.id] || {
                            latitude: img.latitude,
                            longitude: img.longitude,
                          };
                          const pt = turf.point([pos.longitude, pos.latitude]);
                          return turf.booleanPointInPolygon(pt, poly);
                        });
                        if (enclosedImgs.length) {
                          const enclosedIds = new Set(
                            enclosedImgs.map((img) => img.id)
                          );
                          // Keep polygon visible and present options
                          setDrawnPolygonLayer(e.layer);
                          // position popup at polygon center
                          const center = e.layer.getBounds().getCenter();
                          const pos: [number, number] = [
                            center.lat,
                            center.lng,
                          ];
                          setPendingPolygon({
                            layer: e.layer,
                            enclosedImageIds: enclosedIds,
                            position: pos,
                          });
                        } else {
                          // No points found, remove the polygon immediately
                          try {
                            e.layer.remove();
                          } catch {}
                        }
                      }
                    }}
                  />
                </FeatureGroup>
                {exclusionCoords.map((coords, idx) => (
                  <Polygon
                    key={'exclusion-' + idx}
                    positions={coords}
                    pathOptions={{
                      color: 'red',
                      fill: false,
                    }}
                  />
                ))}
                {!existingData && (
                  <FeatureGroup>
                    <EditControl
                      position="topright"
                      draw={{
                        rectangle: false,
                        circle: false,
                        circlemarker: false,
                        marker: false,
                        polygon: false,
                        polyline: {
                          shapeOptions: { color: 'black' },
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
                      fillOpacity: 0.1,
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
                  segmentedImages.map((img) => {
                    const isSelected = selectedTransectIds.has(img.transectId);
                    return (
                      <CircleMarker
                        pane="markerPane"
                        key={img.id}
                        center={[
                          adjustedPositions[img.id]?.latitude ?? img.latitude,
                          adjustedPositions[img.id]?.longitude ?? img.longitude,
                        ]}
                        radius={5}
                        pathOptions={{
                          color: isSelected
                            ? 'black'
                            : transectColors[
                                img.transectId % transectColors.length
                              ],
                          weight: isSelected ? 2 : 1,
                          fillColor:
                            transectColors[
                              img.transectId % transectColors.length
                            ],
                          fillOpacity: 1,
                        }}
                        eventHandlers={{
                          click: (e: any) => {
                            const ctrl = !!(
                              e?.originalEvent?.ctrlKey ||
                              e?.originalEvent?.metaKey
                            );
                            setSelectedTransectIds((prev) => {
                              const next = new Set(prev);
                              if (ctrl) {
                                if (next.has(img.transectId))
                                  next.delete(img.transectId);
                                else next.add(img.transectId);
                              } else {
                                if (
                                  next.size === 1 &&
                                  next.has(img.transectId)
                                ) {
                                  next.clear();
                                } else {
                                  next.clear();
                                  next.add(img.transectId);
                                }
                              }
                              return next;
                            });
                          },
                          contextmenu: (e: any) => {
                            const selected = Array.from(selectedTransectIds);
                            if (selected.length >= 2) {
                              setTransectInfo(null);
                              setMergePrompt({
                                position: e.latlng,
                                ids: selected.sort((a, b) => a - b),
                              });
                            } else {
                              setMergePrompt(null);
                              setTransectInfo({
                                position: e.latlng,
                                transectId: img.transectId,
                              });
                            }
                          },
                        }}
                      />
                    );
                  })}
                {transectInfo && (
                  <Popup
                    position={transectInfo.position}
                    eventHandlers={{ remove: () => setTransectInfo(null) }}
                  >
                    <div>
                      <div>
                        <strong>Transect:</strong> {transectInfo.transectId}
                      </div>
                      <div>
                        <strong>Images:</strong>{' '}
                        {transectImageCounts[transectInfo.transectId] || 0}
                      </div>
                    </div>
                  </Popup>
                )}
                {mergePrompt && (
                  <Popup
                    position={mergePrompt.position}
                    eventHandlers={{ remove: () => setMergePrompt(null) }}
                  >
                    {(() => {
                      const ids = mergePrompt.ids;
                      const primary = Math.min(...ids);
                      const label =
                        ids.length === 2
                          ? `Merge transect ${ids[0]} and ${ids[1]}`
                          : `Merge ${ids.length} selected transects`;
                      return (
                        <div
                          style={{ cursor: 'pointer' }}
                          onClick={() => {
                            handleMergeSelectedInto(primary);
                            setMergePrompt(null);
                          }}
                        >
                          {label}
                        </div>
                      );
                    })()}
                  </Popup>
                )}
                {pendingPolygon && (
                  <Popup
                    position={pendingPolygon.position}
                    eventHandlers={{
                      remove: () => clearPendingSelection(false),
                    }}
                  >
                    <div className="d-flex flex-column gap-2">
                      <div className="mb-1">
                        <strong>{pendingPolygon.enclosedImageIds.size}</strong>{' '}
                        points selected
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={assignPendingToNewTransect}
                      >
                        Merge points
                      </Button>
                    </div>
                  </Popup>
                )}
                {/* Merge Selected Transects Button */}
                {selectedTransectIds.size >= 2 && (
                  <div
                    className="d-flex flex-row gap-2 p-2"
                    style={{
                      position: 'absolute',
                      bottom: '10px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 1000,
                      backgroundColor: 'rgba(255,255,255,0.9)',
                      border: '2px solid rgba(0, 0, 0, 0.28)',
                      borderRadius: '4px',
                    }}
                  >
                    <Button
                      variant="primary"
                      onClick={() => {
                        const selected = Array.from(selectedTransectIds);
                        const primary = Math.min(...selected);
                        handleMergeSelectedInto(primary);
                        // Remove the drawn polygon after merging
                        if (drawnPolygonLayer) {
                          try {
                            drawnPolygonLayer.remove();
                          } catch {}
                          setDrawnPolygonLayer(null);
                        }
                      }}
                    >
                      Merge Selected Transects ({selectedTransectIds.size})
                    </Button>
                  </div>
                )}
              </MapContainer>
            )}
          </div>
          {saving && (
            <div className="d-flex justify-content-center align-items-center mt-3">
              <Spinner animation="border" size="sm" />
              <span className="ms-2">
                Saving images to transects:{' '}
                {savingImageCount > 0
                  ? Math.round((savingProgress / savingImageCount) * 100)
                  : 0}
                %
              </span>
            </div>
          )}
        </Form.Group>
      </Form>
      <Footer>
        <Button variant="primary" onClick={handleSubmit} disabled={saveDisabled || saving}>
          Save Transects and Strata
        </Button>
        <Button
          variant="dark"
          onClick={() => showModal(null)}
          disabled={disabledClose}
        >
          Close
        </Button>
      </Footer>
    </>
  );
}
