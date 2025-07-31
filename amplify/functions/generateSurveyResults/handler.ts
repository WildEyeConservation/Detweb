import { env } from '$amplify/env/deleteProject';
import { Amplify } from 'aws-amplify';
import type { Schema } from '../../data/resource';
import {
  camerasByProjectId,
  strataByProjectId,
  transectsByProjectId,
  imagesByProjectId,
  annotationsByAnnotationSetId,
} from './graphql/queries';
import { createJollyResult } from './graphql/mutations';
import { generateClient, GraphQLResult } from 'aws-amplify/data';
import { jStat } from 'jstat';

Amplify.configure(
  {
    API: {
      GraphQL: {
        endpoint: env.AMPLIFY_DATA_GRAPHQL_ENDPOINT,
        region: env.AWS_REGION,
        defaultAuthMode: 'iam',
      },
    },
  },
  {
    Auth: {
      credentialsProvider: {
        getCredentialsAndIdentityId: async () => ({
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
            sessionToken: env.AWS_SESSION_TOKEN,
          },
        }),
        clearCredentialsAndIdentityId: () => {
          /* noop */
        },
      },
    },
  }
);

const client = generateClient({
  authMode: 'iam',
});

// Helper to handle pagination for GraphQL queries
async function fetchAllPages<T>(
  queryFn: (nextToken?: string) => Promise<GraphQLResult<any>>,
  queryName: string
): Promise<T[]> {
  const allItems: T[] = [];
  let nextToken: string | undefined;
  do {
    const response = await queryFn(nextToken);
    const page = response.data?.[queryName];
    const items: T[] = page?.items ?? [];
    allItems.push(...items);
    nextToken = page?.nextToken;
  } while (nextToken);
  return allItems;
}

// Helper to compute transect width
function transect_width(
  agl_m: number,
  sensor_width_mm: number,
  focal_length_mm: number,
  tilt_degrees: number
) {
  const tilt_rad = (tilt_degrees * Math.PI) / 180;
  const fov_rad = 2 * Math.atan(sensor_width_mm / (2 * focal_length_mm));
  const angle_a = tilt_rad - fov_rad / 2;
  const angle_b = tilt_rad + fov_rad / 2;
  return agl_m * (Math.tan(angle_b) - Math.tan(angle_a));
}

// Haversine distance (meters)
function haversineDistance(
  [lat1, lon1]: [number, number],
  [lat2, lon2]: [number, number]
) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

// sample covariance
function covariance(x: number[], y: number[]) {
  const n = x.length;
  if (n < 2) return 0;
  const meanX = x.reduce((s, v) => s + v, 0) / n;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let cov = 0;
  for (let i = 0; i < n; i++) cov += (x[i] - meanX) * (y[i] - meanY);
  return cov / (n - 1);
}

export const handler: Schema['generateSurveyResults']['functionHandler'] =
  async (event, context) => {
    const surveyId = event.arguments.surveyId;
    const projectId = surveyId;
    const annotationSetId = event.arguments.annotationSetId;
    const categoryIds = event.arguments.categoryIds;

    try {
      // fetch project cameras
      const cameras = await fetchAllPages<any>(
        (nextToken) =>
          client.graphql({
            query: camerasByProjectId,
            variables: { projectId, limit: 100, nextToken },
          }),
        'camerasByProjectId'
      );
      const cameraMap = new Map(cameras.map((cam) => [cam.id, cam]));

      // fetch strata
      const strataList = await fetchAllPages<any>(
        (nextToken) =>
          client.graphql({
            query: strataByProjectId,
            variables: { projectId, limit: 100, nextToken },
          }),
        'strataByProjectId'
      );
      const stratumMap = new Map(strataList.map((st) => [st.id, st]));

      // fetch transects
      const transectsList = await fetchAllPages<any>(
        (nextToken) =>
          client.graphql({
            query: transectsByProjectId,
            variables: { projectId, limit: 100, nextToken },
          }),
        'transectsByProjectId'
      );
      const transectMap = new Map(
        transectsList.map((tr) => [tr.id, tr.stratumId])
      );

      // fetch images
      const images = await fetchAllPages<any>(
        (nextToken) =>
          client.graphql({
            query: imagesByProjectId,
            variables: { projectId, limit: 100, nextToken },
          }),
        'imagesByProjectId'
      );

      // fetch annotations for project
      const annotations = await fetchAllPages<any>(
        (nextToken) =>
          client.graphql({
            query: annotationsByAnnotationSetId,
            variables: {
              setId: annotationSetId,
              limit: 100,
              nextToken,
            },
          }),
        'annotationsByAnnotationSetId'
      );

      // validate input
      if (cameras.length === 0) {
        throw new Error('No cameras found for survey');
      }
      if (strataList.length === 0) {
        throw new Error('No strata found for survey');
      }
      if (transectsList.length === 0) {
        throw new Error('No transects found for survey');
      }
      if (images.length === 0) {
        throw new Error('No images found for survey');
      }
      if (
        images.some(
          (img) =>
            !img.transectId ||
            !img.cameraId ||
            !img.latitude ||
            !img.longitude ||
            !img.altitude_agl ||
            !img.width ||
            !img.height
        )
      ) {
        throw new Error('Image data is missing required fields');
      }
      if (annotations.length === 0) {
        throw new Error('No annotations found for survey');
      }

      // only keep primary annotations (objectId === id) and filter to only include those in the categoryIds list
      const primaryAnnotations = annotations.filter(
        (a) => a.id === a.objectId && categoryIds.includes(a.categoryId)
      );
      // count annotations per image per category
      const annotCountByImageByCategory: Record<
        string,
        Record<string, number>
      > = {};
      for (const a of primaryAnnotations) {
        (annotCountByImageByCategory[a.imageId] ||= {})[a.categoryId] =
          (annotCountByImageByCategory[a.imageId][a.categoryId] || 0) + 1;
      }
      // enrich images with per-category counts
      const imagesWithCounts = images.map((img) => ({
        ...img,
        categoryCounts: annotCountByImageByCategory[img.id] || {},
      }));

      // group by transect
      const byTransect: Record<string, typeof imagesWithCounts> = {};
      for (const img of imagesWithCounts) {
        if (!img.transectId) continue;
        (byTransect[img.transectId] ||= []).push(img);
      }

      // compute survey-wide categories list
      const allCategoryIds = Array.from(
        new Set(primaryAnnotations.map((a) => a.categoryId))
      );

      // compute per-transect metrics
      type TransMetrics = {
        stratumId: string;
        transectId: string;
        distance: number;
        widthAvg: number;
        area_km2: number;
        animalCounts: Record<string, number>;
      };
      const transMetricsList: TransMetrics[] = [];
      for (const [tid, imgs] of Object.entries(byTransect)) {
        imgs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        const deltas = imgs
          .map((_, i) =>
            i > 0 ? imgs[i].timestamp! - imgs[i - 1].timestamp! : 0
          )
          .slice(1);
        const valid = deltas.filter((d) => d > 0);
        const meanDelta = valid.reduce((s, d) => s + d, 0) / valid.length;
        const sections: number[] = [];
        for (let i = 0; i < imgs.length; i++) {
          sections[i] =
            i === 0
              ? 0
              : sections[i - 1] + (deltas[i - 1] > 3 * meanDelta ? 1 : 0);
        }
        let distance = 0;
        for (const secId of Array.from(new Set(sections))) {
          const secImgs = imgs.filter((_, i) => sections[i] === secId);
          const start = secImgs[0],
            end = secImgs[secImgs.length - 1];
          distance += haversineDistance(
            [start.latitude!, start.longitude!],
            [end.latitude!, end.longitude!]
          );
        }
        const stratumId = transectMap.get(tid)!;
        const widths = imgs.map((i) => {
          const cam = cameraMap.get(i.cameraId!);
          return transect_width(
            i.altitude_agl!,
            cam.sensorWidthMm!,
            cam.focalLengthMm!,
            cam.tiltDegrees!
          );
        });
        const widthAvg = widths.reduce((s, w) => s + w, 0) / widths.length;
        const area_km2 = (distance * widthAvg) / 1e6;
        const animalCounts: Record<string, number> = {};
        for (const categoryId of allCategoryIds) {
          animalCounts[categoryId] = imgs.reduce(
            (s, img) => s + (img.categoryCounts[categoryId] || 0),
            0
          );
        }
        transMetricsList.push({
          stratumId,
          transectId: tid,
          distance,
          widthAvg,
          area_km2,
          animalCounts,
        });
      }

      // group per stratum
      const metricsByStratum: Record<string, TransMetrics[]> = {};
      for (const m of transMetricsList) {
        (metricsByStratum[m.stratumId] ||= []).push(m);
      }

      const results: any[] = [];
      for (const [sid, metrics] of Object.entries(metricsByStratum)) {
        const stratum = stratumMap.get(sid)!;
        const n = metrics.length;
        const areaSurveyed = metrics.reduce((s, m) => s + m.area_km2, 0);
        const yArr = metrics.map((m) => m.area_km2);
        const avgWidthAvg = metrics.reduce((s, m) => s + m.widthAvg, 0) / n;
        const N = stratum.baselineLength! / avgWidthAvg;
        for (const categoryId of allCategoryIds) {
          const xArr = metrics.map((m) => m.animalCounts[categoryId] || 0);
          const animals = xArr.reduce((s, a) => s + a, 0);
          const density = animals / areaSurveyed;
          const covAA = covariance(xArr, xArr);
          const covAB = covariance(xArr, yArr);
          const covBB = covariance(yArr, yArr);
          const popVar =
            n < 2
              ? 0
              : ((N * (N - n)) / n) *
                (covAA - 2 * density * covAB + density * density * covBB);
          const popSE = Math.sqrt(popVar);
          const df = n - 1;
          const tcrit = jStat.studentt.inv(0.975, df);
          const popEst = density * stratum.area!;
          const lower95 = Math.round(popEst - tcrit * popSE);
          const upper95 = Math.round(popEst + tcrit * popSE);
          const estimate = Math.round(popEst);
          // persist via GraphQL mutation including categoryId
          await client.graphql({
            query: createJollyResult,
            variables: {
              input: {
                surveyId,
                stratumId: sid,
                annotationSetId,
                categoryId,
                animals,
                areaSurveyed,
                density,
                variance: popVar,
                standardError: popSE,
                numSamples: n,
                estimate,
                lowerBound95: lower95,
                upperBound95: upper95,
              },
            },
          });
          results.push({
            stratumId: sid,
            categoryId,
            annotationSetId,
            animals,
            areaSurveyed,
            density,
            variance: popVar,
            standardError: popSE,
            numSamples: n,
            estimate,
            lowerBound95: lower95,
            upperBound95: upper95,
          });
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: 'Survey results generated successfully',
        }),
      };
    } catch (error: any) {
      console.error('Error details:', error);

      return {
        statusCode: 500,
        body: JSON.stringify({
          message: 'Error generating survey results',
          error: error.message,
        }),
      };
    }
  };
