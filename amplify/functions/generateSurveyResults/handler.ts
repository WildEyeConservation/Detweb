import { env } from '$amplify/env/deleteProject';
import { Amplify } from 'aws-amplify';
import type { Schema } from '../../data/resource';
import {
  camerasByProjectId,
  strataByProjectId,
  transectsByProjectId,
  imagesByProjectId,
  annotationsByAnnotationSetId
} from './graphql/queries';
import { createJollyResult } from './graphql/mutations';
import { generateClient, GraphQLResult } from 'aws-amplify/data';

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
      // only keep primary annotations (objectId === id)
      const primaryAnnotations = annotations.filter((a) => a.id === a.objectId);
      // count annotations per image per category
      const annotCountByImageByCategory: Record<string, Record<string, number>> = {};
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

      // process each transect
      const transectResults: any[] = [];
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
          if (i === 0) sections[i] = 0;
          else
            sections[i] =
              sections[i - 1] + (deltas[i - 1] > 3 * meanDelta ? 1 : 0);
        }
        let distance = 0;
        for (const sid of Array.from(new Set(sections))) {
          const sec = imgs.filter((_, i) => sections[i] === sid);
          const start = sec[0],
            end = sec[sec.length - 1];
          distance += haversineDistance(
            [start.latitude!, start.longitude!],
            [end.latitude!, end.longitude!]
          );
        }
        const stratumId = transectMap.get(tid)!;
        const stratum = stratumMap.get(stratumId)!;
        const animals = imgs.reduce((s, i) => s + (i.animals || 0), 0);
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
        const aglAvg =
          imgs.reduce((s, i) => s + (i.altitude_agl || 0), 0) / imgs.length;
        const area_km2 = (distance * widthAvg) / 1e6;
        // group transect results by category
        const categories = Array.from(
          new Set(imgs.flatMap((img) => Object.keys(img.categoryCounts)))
        );
        for (const categoryId of categories) {
          const animals = imgs.reduce(
            (s, img) => s + (img.categoryCounts[categoryId] || 0),
            0
          );
          transectResults.push({
            transectId: tid,
            stratumId,
            categoryId,
            baselineLength: stratum.baselineLength!,
            stratumArea: stratum.area!,
            distance,
            aglAvg,
            animals,
            widthAvg,
            area_km2,
          });
        }
      }

      // group by stratum and category
      const byStratumCategory: Record<string, Record<string, typeof transectResults>> = {};
      for (const tr of transectResults) {
        (byStratumCategory[tr.stratumId] ||= {})[tr.categoryId] ||= [];
        byStratumCategory[tr.stratumId][tr.categoryId].push(tr);
      }
      const results: any[] = [];
      for (const [sid, categoryMap] of Object.entries(byStratumCategory)) {
        const stratum = stratumMap.get(sid)!;
        for (const [categoryId, trs] of Object.entries(categoryMap)) {
          const areaSurveyed = trs.reduce((s, t) => s + t.area_km2, 0);
          const animals = trs.reduce((s, t) => s + t.animals, 0);
          const n = trs.length;
          const density = animals / areaSurveyed;
          const xArr = trs.map((t) => t.animals);
          const yArr = trs.map((t) => t.area_km2);
          const covAA = covariance(xArr, xArr);
          const covAB = covariance(xArr, yArr);
          const covBB = covariance(yArr, yArr);
          const N = stratum.baselineLength! / trs[0].widthAvg;
          const popVar =
            n < 2
              ? 0
              : ((N * (N - n)) / n) *
                (covAA - 2 * density * covAB + density * density * covBB);
          const popSE = Math.sqrt(popVar);
          const tcrit = 1.96;
          const popEst = density * stratum.area!;
          const lower95 = Math.round(popEst - tcrit * popSE);
          const upper95 = Math.round(popEst + tcrit * popSE);
          const estimate = Math.round(popEst);
          // persist via GraphQL mutation including categoryId
          // @ts-ignore: include categoryId even though API input type isn't updated yet
          await client.graphql({
            query: createJollyResult,
            variables: {
              input: {
                surveyId,
                stratumId: sid,
                annotationSetId,
                // @ts-ignore: include categoryId even though API input type isn't updated yet
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
