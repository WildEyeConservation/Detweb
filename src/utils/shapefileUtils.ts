import shp from 'shpjs';
import * as turf from '@turf/turf';

export type LatLngTuple = [number, number];

// Adaptive simplification: keep vertices between minPoints and maxPoints
export function simplifyPolygonToRange(
  rawLonLat: [number, number][],
  minPoints = 1000,
  maxPoints = 1500
): [number, number][] {
  if (rawLonLat.length <= minPoints) return rawLonLat;
  let tolerance = 1e-6;
  let coords: [number, number][] = rawLonLat;
  while (true) {
    const simplified = turf.simplify(turf.polygon([coords]), { tolerance });
    const simplifiedCoords = simplified.geometry.coordinates[0] as [
      number,
      number
    ][];
    coords = simplifiedCoords;
    if (coords.length <= maxPoints || tolerance > 1) {
      break;
    }
    tolerance *= 2;
  }
  return coords;
}

// Ensure the linear ring is closed (first equals last)
export function ensureClosedRing(
  coords: [number, number][]
): [number, number][] {
  if (
    coords.length &&
    (coords[0][0] !== coords[coords.length - 1][0] ||
      coords[0][1] !== coords[coords.length - 1][1])
  ) {
    return [...coords, coords[0]];
  }
  return coords;
}

// Parse a zipped shapefile ArrayBuffer and return simplified [lat, lng] tuples
export async function parseShapefileToLatLngs(
  shapefileBuffer: ArrayBuffer
): Promise<LatLngTuple[] | null> {
  const geojson: any = await shp(shapefileBuffer);
  const features =
    geojson.features || (geojson.type === 'Feature' ? [geojson] : []);
  const poly = features.find(
    (f: any) =>
      f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon'
  );
  if (!poly) return null;

  // Extract raw [lng, lat] pairs
  let coordsList: [number, number][] = [];
  if (poly.geometry.type === 'Polygon') {
    coordsList = poly.geometry.coordinates[0];
  } else {
    coordsList = poly.geometry.coordinates[0][0];
  }

  const closed = ensureClosedRing(coordsList);
  const simplifiedLonLat = simplifyPolygonToRange(closed);
  const latLngs: LatLngTuple[] = simplifiedLonLat.map(([lng, lat]) => [
    lat,
    lng,
  ]);
  return latLngs;
}

// Create or update the shapefile for a project using [lat, lng] tuples
export async function saveShapefileForProject(
  client: any,
  projectId: string,
  latLngs: LatLngTuple[]
): Promise<void> {
  if (!latLngs || latLngs.length === 0) return;

  // Convert [lat,lng] -> [lng,lat]
  const lonLat: [number, number][] = latLngs.map(([lat, lng]) => [lng, lat]);
  const closed = ensureClosedRing(lonLat);
  const simplifiedLonLat = simplifyPolygonToRange(closed);

  // Flatten back to [lat, lng] numeric array for storage
  const flattened: number[] = [];
  simplifiedLonLat.forEach(([lng, lat]) => {
    flattened.push(lat, lng);
  });

  // create vs update
  const updateResult = (await client.models.Shapefile.shapefilesByProjectId({
    projectId,
  })) as any;
  const existing = updateResult.data as Array<{ id: string }>;
  if (existing && existing.length > 0) {
    await client.models.Shapefile.update({
      id: existing[0].id,
      coordinates: flattened,
    });
  } else {
    await client.models.Shapefile.create({ projectId, coordinates: flattened });
  }
}
