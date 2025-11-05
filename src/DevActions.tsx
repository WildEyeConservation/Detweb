// @ts-nocheck
import { Button, Modal, Spinner } from 'react-bootstrap';
import { GlobalContext, ManagementContext } from './Context';
import { useContext, useEffect, useMemo, useState } from 'react';
import { list } from 'aws-amplify/storage';
import { remove } from 'aws-amplify/storage';
import { fetchAllPaginatedResults } from './utils';
import { ProjectContext, UserContext } from './Context';
import UserStats from './UserStats';
import { useUpdateProgress } from './useUpdateProgress';
import { makeTransform, array2Matrix } from './utils';
import { inv } from 'mathjs';
import exportFromJSON from 'export-from-json';
import exifr from 'exifr';
import Papa from 'papaparse';
import {
  MapContainer,
  LayersControl,
  LayerGroup,
  Rectangle,
  CircleMarker,
  Popup,
} from 'react-leaflet';
import L from 'leaflet';
import { StorageLayer } from './StorageLayer';
import {
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  ReceiveMessageCommand,
  SendMessageBatchCommand,
  DeleteMessageBatchCommand,
} from '@aws-sdk/client-sqs';
import { getUrl } from 'aws-amplify/storage';

export function DevActions() {
  const { client, backend } = useContext(GlobalContext)!;
  const { getSqsClient } = useContext(UserContext)!;
  const [imageModalId, setImageModalId] = useState<string | null>(null);
  const [imageModalAnnotationSetId, setImageModalAnnotationSetId] = useState<
    string | null
  >(null);
  const [concurrencyTest, setConcurrencyTest] = useState({
    running: false,
    total: 0,
    started: 0,
    completed: 0,
    errors: 0,
  });
  // const { project } = useContext(ProjectContext)!;
  // const { user: currentUser } = useContext(UserContext)!;
  // const { allUsers } = useContext(ManagementContext)
  // const [setStepsCompleted, setTotalSteps] = useUpdateProgress({
  //     taskId: `Deleting ImageNeighbour entries`,
  //     indeterminateTaskName: `Loading entries`,
  //     determinateTaskName: "Deleting entries",
  //     stepFormatter: (count)=>`${count} entries`,
  //   });

  // const deleteOrphans = async () => {
  //     const prefix = prompt('Provide the prefix to scan (omit images/)');
  //     if (!prefix) return;
  //     const {items} = await list({
  //         path: `images/${prefix}`,
  //         options:{bucket:'inputs',listAll:true}
  //       });
  //     await Promise.all(items.map(async (item, idx) => {
  //         const { data } = await client.models.ImageFile.imagesByPath({ path: item.path.slice('images/'.length) })
  //         if (data.length == 0) {
  //             console.log(`Deleting ${item.path}`);
  //             await remove({path:item.path,options:{bucket:'inputs'}});
  //         }
  //         if (idx % 100 == 0) {
  //             console.log(`${idx}/${items.length}`)
  //         }
  //     }));
  // }
  // const deleteImages = async () => {
  //     const images = await fetchAllPaginatedResults(client.models.Image.list,
  //         { selectionSet: ['id'] as const });
  //     const imageFiles = await fetchAllPaginatedResults(client.models.ImageFile.list,
  //         { selectionSet: ['imageId'] as const });
  //     // Now compute the set difference between images and imageFiles
  //     const imageIds1 = [...images.map(i => i.id)];
  //     const imageIds2 = new Set([...imageFiles.map(i => i.imageId).filter(id => id != null) as string[]]);
  //     const orphanedImageIds = imageIds1.filter(id => !imageIds2.has(id));
  //     for (const id of orphanorphanedImageIds) {
  //         const { data: image } = await client.models.Image.get({ id });
  //         const sets=await image.memberships();
  //         for (const set of sets) {
  //             console.log(`Deleting image ${id} from set ${set.id}`);
  //             await client.models.ImageSetMembership.delete({ imageId: id, imageSetId: set.id });
  //         }
  //         console.log(`Deleting image ${id}`);
  //         await client.models.Image.delete({ id });
  //     }
  // }

  // const findImages = async () => {
  //     const name = prompt('Provide the imageset to scan');
  //     const { data: sets } = await client.models.ImageSet.list();
  //     const set = sets.find(s => s.name == name);
  //     const result = await fetchAllPaginatedResults(client.models.ImageSetMembership.imageSetMembershipsByImageSetId,
  //         { imageSetId: set.id, selectionSet: ['image.id', 'image.latitude', 'image.longitude'] as const });
  //     result.forEach(async item => {
  //         if (!item.image.latitude || !item.image.longitude) {
  //             const { data: files } = await client.models.ImageFile.imagesByimageId({ imageId: item.image.id })
  //             const file = files.find(f => f.type == 'image/jpeg');
  //             console.log(file.path)
  //         }
  //     });
  // }

  // const fixupImageSets = async () => {
  //     // images = [
  //     // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraA/Sango_R_A__05078_D2_03092024.JPG",
  //     // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraB/Sango_L_B__03440_D2_03092024.JPG"
  //     // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraB/Sango_L_B__03441_D2_03092024.JPG",
  //     // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraB/Sango_L_B__03442_D2_03092024.JPG",
  //     // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraB/Sango_L_B__03443_D2_03092024.JPG",
  //     // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraB/Sango_L_B__03444_D2_03092024.JPG",
  //     // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraB/Sango_L_B__03445_D2_03092024.JPG",
  //     // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraB/Sango_L_B__03446_D2_03092024.JPG",
  //     // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraB/Sango_L_B__03447_D2_03092024.JPG",
  //     // "Sango_PhotoCount_2024/Day2_03.09.2024/CameraB/Sango_L_B__04298_D2_03092024.JPG",
  //     // "Sango_PhotoCount_2024/Day3_04.09.2024/CameraA/Sango_R_A__05938_D3_04092024.JPG",
  //     // "Sango_PhotoCount_2024/Day3_04.09.2024/CameraA/Sango_R_A__07238_D3_04092024.JPG",
  //     // "Sango_PhotoCount_2024/Day3_04.09.2024/CameraB/Sango_L_B__05893_D3_04092024.JPG",
  //     // "Sango_PhotoCount_2024/Day3_04.09.2024/CameraB/Sango_L_B__07131_D3_04092024.JPG"
  //     // ]
  //     // for (const image of images) {
  //     //     const cam= image.split('/')[2];
  //     //     const { data: files } = await client.models.ImageFile.imagesByPath({ path: image }, { selectionSet: ['image.timestamp'] })
  //     //     if (cam == 'CameraA') {

  //     //     const file = files.find(f => f.type == 'image/jpeg');
  //     //     console.log(file.path)
  //     // }
  // }

  // const getUserStats =
  // "query MyQuery($userId: ID! , $projectId: ID! ) {\
  //     getUserObservationStats(projectId: $projectId, userId: $userId) {\
  //         count\
  //         updatedAt\
  //         activeTime\
  //     }\
  // }"

  // const updateUserStats =
  // "mutation MyMutation($count: Int!, $activeTime: Int!, $projectId: ID!, $userId: ID!) {\
  //     updateUserObservationStats(input: {projectId: $projectId, userId: $userId, count: $count, activeTime: $activeTime}) {\
  //         updatedAt\
  //     }\
  // }"

  // const createUserStats = "\
  // mutation MyMutation2($projectId: ID!, $userId: ID!) {\
  //     createUserObservationStats(input: {activeTime: 0, count: 1, projectId: $projectId, userId: $userId}) {\
  //         updatedAt\
  //     }\
  // }"

  // async function updateStats(input: string) {
  //     const parsed=JSON.parse(input);
  //     const result = await client.graphql({
  //         query: getUserStats,
  //         variables: {
  //             userId: parsed.owner.S.split('::')[1],
  //             projectId: parsed.projectId.S
  //         }
  //     })
  //     const stats = result.data?.getUserObservationStats;
  //     if (stats) {
  //         console.log(stats)
  //         const elapsed = (new Date().getTime() - new Date(stats.updatedAt).getTime()) / 1000;
  //         await client.graphql({
  //             // Calculate the number of seconds elapsed since stats.updatedAt which is an ISO string
  //             query: updateUserStats,
  //             variables: {
  //                 userId: parsed.owner.S.split('::')[1],
  //                 projectId: parsed.projectId.S,
  //                 count: stats.count + 1,
  //                 activeTime: (elapsed<120) ? Math.round(stats.activeTime + elapsed) : stats.activeTime
  //             }
  //         })
  //     } else {
  //         await client.graphql({
  //             query: createUserStats,
  //             variables: {
  //                 projectId: parsed.projectId.S,
  //                 userId: parsed.owner.S.split('::')[1]
  //             }
  //         })
  //     }
  // }

  // function createInput() {
  //     //Print the current time in the following format 2024-10-30T10:04:09.423Z
  //     return `{\"owner\":{\"S\":\"${currentUser.userId}::${currentUser.userId}\"},\
  //     \"annotationSetId\":{\"S\":\"50bbfaa2-788c-4b84-b919-e98c7adc019d\"},\
  //     \"createdAt\":{\"S\":\"${new Date().toISOString()}\"},\"locationId\":{\"S\":\"a62f54f2-500b-4bc4-b7a8-f299cc48c476\"},\
  //     \"__typename\":{\"S\":\"Observation\"},\"id\":{\"S\":\"1c9905c6-82ea-4c01-8704-e3478187cd53\"},\
  //     \"projectId\":{\"S\":\"${project.id}\"},\
  //     \"updatedAt\":{\"S\":\"${new Date().toISOString()}\"}}`
  // }

  // async function recomputeUserStats() {
  //     let records = {}
  //     const allObservations = await fetchAllPaginatedResults(client.models.Observation.list)
  //     const allAnnotations = await fetchAllPaginatedResults(client.models.Annotation.list)
  //     //const { data: allObservations } = await client.models.Observation.list()
  //     //Sort the observations by createdAt
  //     //Combine the observations and annotations
  //     const allEvents = [...allObservations, ...allAnnotations]
  //     allEvents.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
  //     for (const event of allEvents) {
  //         let projectrecords = records?.[event.projectId];
  //         if (!projectrecords) {
  //             projectrecords = {}
  //             records[event.projectId] = projectrecords
  //         }
  //         // Extract the date of the observation from the createdAt field
  //         const observationDate = new Date(event.createdAt).toISOString().split('T')[0];
  //         let daterecords = projectrecords[observationDate];
  //         if (!daterecords) {
  //             daterecords = {}
  //             projectrecords[observationDate] = daterecords
  //         }
  //         const setId = event.annotationSetId ?? event.setId;
  //         let setrecords = daterecords[setId];
  //         if (!setrecords) {
  //             setrecords = {}
  //             daterecords[setId] = setrecords
  //         }
  //         let userrecords = setrecords[event.owner];
  //         if (!userrecords) {
  //             userrecords = { observationCount: 0, annotationCount: 0, activeTime: 0, lastUpdated: event.createdAt }
  //             setrecords[event.owner] = userrecords
  //         }
  //         if (event.x) {//Event is an annotation
  //             userrecords.annotationCount+=1
  //         } else{ // Event is an observation
  //             userrecords.observationCount+=1
  //         }
  //         const elapsed = (new Date(event.createdAt).getTime() - new Date(userrecords.lastUpdated).getTime()) / 1000;
  //         userrecords.activeTime += (elapsed < 120) ? elapsed : 0
  //         userrecords.lastUpdated = event.createdAt
  //     }
  //     // Now iterate over the records and update the UserObservationStats
  //     for (const projectId in records) {
  //         for (const date in records[projectId]) {
  //             for (const setId in records[projectId][date]) {
  //                 for (const userId in records[projectId][date][setId]) {
  //                     const record=records[projectId][date][setId][userId];
  //                     try {
  //                         await client.models.UserStats.create({
  //                             userId: userId,
  //                             projectId: projectId,
  //                             setId: setId,
  //                             date: date,
  //                             annotationCount: record.annotationCount,
  //                             observationCount: record.observationCount,
  //                             activeTime: record.activeTime
  //                         })
  //                     } catch (e) {
  //                         await client.models.UserStats.update({
  //                             userId: userId,
  //                             projectId: projectId,
  //                             setId: setId,
  //                             date: date,
  //                             annotationCount: record.annotationCount,
  //                             observationCount: record.observationCount,
  //                             activeTime: record.activeTime
  //                         })
  //                     }
  //                 }
  //             }
  //         }
  //     }
  //     console.log(records)
  // }

  // async function createUserStatsTable() {
  //     const { data: allUserStats } = await client.models.UserObservationStats.list()
  //     const table = allUserStats.filter(s => s.projectId == project.id)
  //                               .map(s => {
  //         return [allUsers.find(u => u.id == s.userId)?.name,s.count,s.activeTime,s.activeTime/s.count]
  //     })
  //     console.log(table)
  // }

  // async function deleteImageNeighbours() {
  //     setStepsCompleted(0)
  //     setTotalSteps(0)
  //     const allImageNeighbours = await fetchAllPaginatedResults(client.models.ImageNeighbour.list,{},setStepsCompleted)
  //     setTotalSteps(allImageNeighbours.length)
  //     setStepsCompleted(0)
  //     await Promise.all(allImageNeighbours.map(async (i) => {
  //         await client.models.ImageNeighbour.delete({ image1Id: i.image1Id, image2Id: i.image2Id })
  //         setStepsCompleted((i)=>i+1)
  //     }))
  // }

  // async function backfillObjectID() {
  //     const name = prompt('Provide the annotationSet to scan');
  //     const annotationSets = await fetchAllPaginatedResults(client.models.AnnotationSet.list);
  //     const set = annotationSets.find(s => s.name == name);
  //     if (!set) {
  //         console.log(`Annotation set ${name} not found`);
  //         return;
  //     }
  //     const annotations = await fetchAllPaginatedResults(client.models.Annotation.annotationsByAnnotationSetId,
  //        { setId: set.id })
  //     // const { data: annotations } = await client.models.Annotation.annotationsByAnnotationSetId({ setId: set.id })
  //     // Group the annotations by imageId
  //     // const { data: annotations } = await client.models.Annotation.annotationsByImageIdAndSetId({ imageId: '715cc7c0-34b6-44e6-992e-3a9238ab8aeb', setId: { eq : '7cac128f-1072-4b64-97be-072cd56955fc'} })
  //     const imageAnnotations = annotations.reduce((acc, annotation) => {
  //         acc[annotation.imageId] = (acc[annotation.imageId] || []).concat(annotation);
  //         return acc;
  //     }, {});
  //     //Loop over the imageAnnotations and read the ImageNeighbour entries
  //     for (const imageId in imageAnnotations) {
  //         const { data: image } = await client.models.Image.get({ id: imageId })
  //         const neighbours = await client.models.ImageNeighbour.imageNeighboursByImage2key({ image2Id: imageId })
  //         if (neighbours?.data[0]?.homography) {
  //             const f = makeTransform(inv(array2Matrix(neighbours.data[0].homography)));
  //             const annotations = imageAnnotations[imageId];
  //             for (const annotation of annotations) {
  //                 const point = [annotation.x, annotation.y];
  //                 const transformedPoint = f(point);
  //                 if (transformedPoint[0] >= 0 && transformedPoint[0] <= image.width && transformedPoint[1] >= 0 && transformedPoint[1] <= image.height) {
  //                     continue
  //                 }
  //                 client.models.Annotation.update({
  //                     id: annotation.id,
  //                     objectId: annotation.id
  //                 })
  //             }
  //         }
  //     }
  // }

  // const { items } = await list({ path: 'images', options: { bucket: 'inputs', listAll: true } });
  // await Promise.all(items.map(async (item, idx) => {
  //     await updateStats(item.path);
  // }));

  async function drainQueueToDLQ(
    queueUrl: string,
    opts?: {
      workers?: number;
      visibilityTimeout?: number;
      waitTimeSeconds?: number;
    }
  ) {
    try {
      const sqs = await getSqsClient();
      const workers = Math.max(1, Math.min(100, Number(opts?.workers) || 20));
      const visibilityTimeout = Math.max(
        1,
        Math.min(43200, Number(opts?.visibilityTimeout) || 60)
      );
      const waitTimeSeconds = Math.max(
        0,
        Math.min(20, Number(opts?.waitTimeSeconds) || 10)
      );

      // Fetch redrive policy to locate DLQ
      const attrs = await sqs.send(
        new GetQueueAttributesCommand({
          QueueUrl: queueUrl,
          AttributeNames: ['RedrivePolicy'],
        })
      );
      const policyRaw = attrs.Attributes?.RedrivePolicy;
      if (!policyRaw) {
        console.error('Queue has no RedrivePolicy (no DLQ configured).');
        alert('Queue has no RedrivePolicy (no DLQ configured).');
        return;
      }
      const policy = JSON.parse(policyRaw);
      const dlqArn: string = policy.deadLetterTargetArn;
      if (!dlqArn) {
        console.error('Dead letter queue ARN not found in RedrivePolicy.');
        alert('Dead letter queue ARN not found in RedrivePolicy.');
        return;
      }
      const dlqName = dlqArn.split(':').pop() as string;
      const { QueueUrl: dlqUrl } = await sqs.send(
        new GetQueueUrlCommand({ QueueName: dlqName })
      );
      if (!dlqUrl) {
        console.error('Could not resolve DLQ URL.');
        alert('Could not resolve DLQ URL.');
        return;
      }
      const fifo = dlqUrl.endsWith('.fifo');
      console.log('Draining queue to DLQ (concurrent)', {
        queueUrl,
        dlqUrl,
        workers,
        visibilityTimeout,
        waitTimeSeconds,
      });

      let totalMoved = 0;
      let totalReceived = 0;
      let totalSendFailures = 0;
      const startTs = Date.now();

      const workerFn = async (workerId: number) => {
        let emptyStreak = 0;
        while (true) {
          try {
            const recv = await sqs.send(
              new ReceiveMessageCommand({
                QueueUrl: queueUrl,
                MaxNumberOfMessages: 10,
                WaitTimeSeconds: waitTimeSeconds,
                MessageAttributeNames: ['All'],
                AttributeNames: ['All'],
                VisibilityTimeout: visibilityTimeout,
              })
            );
            const messages = recv.Messages || [];
            if (messages.length === 0) {
              emptyStreak += 1;
              if (emptyStreak >= 3) break; // tolerate temporary gaps
              continue;
            }
            emptyStreak = 0;
            totalReceived += messages.length;

            const entries = messages.map((m, idx) => ({
              Id: (m.MessageId || `${workerId}-${idx}`).slice(0, 80),
              MessageBody: m.Body || '',
              MessageAttributes: m.MessageAttributes,
              ...(fifo
                ? {
                    MessageGroupId: 'drain',
                    MessageDeduplicationId: (
                      m.MessageId ||
                      `${Date.now()}-${workerId}-${idx}-${Math.random()}`
                    ).slice(0, 128),
                  }
                : {}),
            }));

            const sendResp = await sqs.send(
              new SendMessageBatchCommand({
                QueueUrl: dlqUrl,
                Entries: entries,
              })
            );

            const successIds = new Set(
              (sendResp.Successful || []).map((s) => s.Id)
            );
            const failedCount = (sendResp.Failed || []).length;
            totalSendFailures += failedCount;

            const deleteEntries = messages
              .map((m, idx) => ({
                Id: (m.MessageId || `${workerId}-${idx}`).slice(0, 80),
                ReceiptHandle: m.ReceiptHandle!,
              }))
              .filter((e) => successIds.has(e.Id));

            if (deleteEntries.length > 0) {
              await sqs.send(
                new DeleteMessageBatchCommand({
                  QueueUrl: queueUrl,
                  Entries: deleteEntries,
                })
              );
              totalMoved += deleteEntries.length;
            }

            if (failedCount > 0) {
              console.warn(
                `Worker ${workerId}: ${failedCount} DLQ send failures in batch`
              );
            }
          } catch (err) {
            console.warn(`Worker ${workerId} error; backing off`, err);
            await new Promise((r) => setTimeout(r, 250));
          }
        }
      };

      await Promise.all(Array.from({ length: workers }, (_, i) => workerFn(i)));

      const secs = Math.max(1, (Date.now() - startTs) / 1000);
      const rate = Math.round(totalMoved / secs);
      console.log(
        `Drain complete. Moved=${totalMoved}, received=${totalReceived}, sendFailures=${totalSendFailures}, elapsed=${secs.toFixed(
          1
        )}s, rate≈${rate}/s`
      );
      alert(`Drain complete. Moved ${totalMoved} msgs at ~${rate}/s`);
    } catch (e) {
      console.error('Failed to drain queue to DLQ', e);
      alert('Failed to drain queue to DLQ. See console for details.');
    }
  }

  async function summarizeCameraTimestampRanges() {
    try {
      const projectId = prompt(
        'Enter the projectId to summarize camera timestamp ranges'
      );
      if (!projectId) return;

      const images = (await (fetchAllPaginatedResults as any)(
        (client as any).models.Image.imagesByProjectId,
        {
          projectId,
          selectionSet: ['id', 'cameraId', 'timestamp'] as const,
          limit: 1000,
        }
      )) as Array<{
        id: string;
        cameraId?: string | null;
        timestamp?: number | null;
      }>;

      if (!images || images.length === 0) {
        alert('No images found for this project.');
        return;
      }

      // Build cameraId -> timestamps map
      const byCamera = new Map<string, number[]>();
      for (const img of images) {
        const cam = img.cameraId || 'UNKNOWN';
        const ts = Number(img.timestamp);
        if (!Number.isFinite(ts)) continue;
        if (!byCamera.has(cam)) byCamera.set(cam, []);
        byCamera.get(cam)!.push(ts);
      }

      if (byCamera.size === 0) {
        alert('No images with valid timestamps were found.');
        return;
      }

      // Resolve camera names
      const cameraIdToName = new Map<string, string>();
      try {
        const camResp = await (client as any).models.Camera.camerasByProjectId({
          projectId,
          selectionSet: ['id', 'name'] as const,
          limit: 1000,
        });
        for (const c of (camResp?.data || []) as any[]) {
          if (c?.id) cameraIdToName.set(c.id, c?.name ?? c.id);
        }
      } catch {}

      const rows = Array.from(byCamera.entries()).map(([cameraId, tsList]) => {
        tsList.sort((a, b) => a - b);
        const minTs = tsList[0];
        const maxTs = tsList[tsList.length - 1];
        return {
          cameraId,
          cameraName: cameraIdToName.get(cameraId) || cameraId,
          imageCount: tsList.length,
          minTimestamp: minTs,
          maxTimestamp: maxTs,
          minISO: new Date(minTs * 1000).toISOString(),
          maxISO: new Date(maxTs * 1000).toISOString(),
        };
      });

      rows.sort((a, b) =>
        (a.cameraName || a.cameraId).localeCompare(b.cameraName || b.cameraId)
      );

      console.group(`Camera timestamp ranges for project ${projectId}`);
      console.table(rows);
      console.groupEnd();
      alert(
        `Computed timestamp ranges for ${rows.length} camera(s). See console for details.`
      );
    } catch (e) {
      console.error('summarizeCameraTimestampRanges failed', e);
      alert(
        'Failed to summarize camera timestamp ranges. See console for details.'
      );
    }
  }

  async function adjustCameraTimestamps() {
    try {
      const cameraId = prompt('Enter the cameraId to adjust timestamps');
      if (!cameraId) return;

      // Fetch camera to get projectId
      const { data: camera } = await (client as any).models.Camera.get({
        id: cameraId,
        selectionSet: ['id', 'name', 'projectId'] as const,
      });

      if (!camera) {
        alert('Camera not found.');
        return;
      }

      const projectId = camera.projectId;
      console.log(
        `Found camera: ${camera.name} (${cameraId}) in project: ${projectId}`
      );

      // Fetch all images for this camera in the project
      const images = (await (fetchAllPaginatedResults as any)(
        (client as any).models.Image.imagesByProjectId,
        {
          projectId,
          selectionSet: ['id', 'cameraId', 'timestamp'] as const,
          limit: 1000,
        }
      )) as Array<{
        id: string;
        cameraId?: string | null;
        timestamp?: number | null;
      }>;

      // Filter to only images with this cameraId
      const cameraImages = images.filter((img) => img.cameraId === cameraId);

      if (cameraImages.length === 0) {
        alert(
          `No images found for camera ${camera.name} (${cameraId}) in project ${projectId}.`
        );
        return;
      }

      console.log(
        `Found ${cameraImages.length} images for camera ${camera.name}`
      );

      // Show current timestamp range
      const timestamps = cameraImages
        .map((img) => Number(img.timestamp))
        .filter((ts) => Number.isFinite(ts))
        .sort((a, b) => a - b);

      if (timestamps.length === 0) {
        alert('No images with valid timestamps found.');
        return;
      }

      const minTs = timestamps[0];
      const maxTs = timestamps[timestamps.length - 1];
      console.log(`Current timestamp range: ${minTs} - ${maxTs}`);
      console.log(
        `Current ISO range: ${new Date(
          minTs * 1000
        ).toISOString()} - ${new Date(maxTs * 1000).toISOString()}`
      );

      // Prompt for adjustment
      const adjustmentStr = prompt(
        `Enter timestamp adjustment in seconds (positive to add, negative to subtract):\n\n` +
          `Camera: ${camera.name} (${cameraId})\n` +
          `Images: ${cameraImages.length}\n` +
          `Current range: ${new Date(minTs * 1000).toISOString()} to ${new Date(
            maxTs * 1000
          ).toISOString()}`
      );

      if (!adjustmentStr) return;

      const adjustment = Number(adjustmentStr);
      if (!Number.isFinite(adjustment)) {
        alert('Invalid adjustment value. Please enter a number.');
        return;
      }

      // Confirm before proceeding
      const newMinTs = minTs + adjustment;
      const newMaxTs = maxTs + adjustment;
      const proceed = confirm(
        `Adjust timestamps by ${adjustment} seconds?\n\n` +
          `This will update ${cameraImages.length} images.\n\n` +
          `New range: ${new Date(newMinTs * 1000).toISOString()} to ${new Date(
            newMaxTs * 1000
          ).toISOString()}\n\n` +
          `Proceed?`
      );

      if (!proceed) return;

      // Update all images using Promise.all
      console.log(`Updating ${cameraImages.length} images...`);
      const updatePromises = cameraImages.map(async (img) => {
        const currentTs = Number(img.timestamp);
        if (!Number.isFinite(currentTs)) return null;

        const newTs = currentTs + adjustment;
        return (client as any).models.Image.update({
          id: img.id,
          timestamp: newTs,
        });
      });

      const results = await Promise.all(updatePromises);
      const successCount = results.filter((r) => r !== null).length;

      console.log(`Successfully updated ${successCount} images`);
      alert(
        `Successfully adjusted timestamps for ${successCount} images in camera ${camera.name}.`
      );
    } catch (e) {
      console.error('adjustCameraTimestamps failed', e);
      alert('Failed to adjust camera timestamps. See console for details.');
    }
  }

  const promptDrainQueue = async () => {
    const url = prompt('Enter the Queue URL to drain to its DLQ');
    if (!url) return;
    const workersStr =
      prompt('Number of parallel workers? (default 20)') || '20';
    const workers = Math.max(1, Number(workersStr) || 20);
    const visStr = prompt('Visibility timeout (seconds, default 60)') || '60';
    const visibilityTimeout = Math.max(1, Number(visStr) || 60);
    const waitStr =
      prompt('Receive long-poll seconds (0-20, default 10)') || '10';
    const waitTimeSeconds = Math.max(0, Math.min(20, Number(waitStr) || 10));
    await drainQueueToDLQ(url, { workers, visibilityTimeout, waitTimeSeconds });
  };

  async function exportQueueMessagesAsJSON() {
    const queueUrl = prompt(
      'Enter the Queue URL to export messages (non-destructive)'
    );
    if (!queueUrl) return;

    const maxStr =
      prompt('Max messages to fetch? (enter a number, default 200)') || '200';
    const maxToFetch = Math.max(1, Number(maxStr) || 200);

    const visStr =
      prompt('Temporary visibility timeout in seconds (default 30)') || '30';
    const visibilityTimeout = Math.max(1, Number(visStr) || 30);

    try {
      const sqs = await getSqsClient();
      const collected: any[] = [];

      while (collected.length < maxToFetch) {
        const recv = await sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: Math.min(10, maxToFetch - collected.length),
            WaitTimeSeconds: 0,
            MessageAttributeNames: ['All'],
            AttributeNames: ['All'],
            VisibilityTimeout: visibilityTimeout,
          })
        );
        const messages = recv.Messages || [];
        if (messages.length === 0) break;

        for (const m of messages) {
          let parsedBody: any = null;
          if (m.Body) {
            try {
              parsedBody = JSON.parse(m.Body);
            } catch (_e) {
              parsedBody = null;
            }
          }
          const entry: any = {
            messageId: m.MessageId,
            attributes: m.Attributes,
            messageAttributes: m.MessageAttributes,
            md5OfBody: m.MD5OfBody,
          };
          if (parsedBody !== null) {
            entry.body = parsedBody; // fully parsed JSON
            entry.rawBody = m.Body; // keep original for reference
          } else {
            entry.body = m.Body; // non-JSON body, keep as string
          }
          collected.push(entry);
        }
      }

      const queueName = (queueUrl.split('/').pop() || 'queue').replace(
        /\W+/g,
        '-'
      );
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `sqs-export-${queueName}-${ts}.json`;

      const blob = new Blob([JSON.stringify(collected, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      alert(`Exported ${collected.length} messages to ${fileName}`);
    } catch (e) {
      console.error('Failed to export queue messages', e);
      alert('Failed to export queue messages. See console for details.');
    }
  }

  async function summarizeExportedQueueFile() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';

    input.onchange = async () => {
      const files = input.files;
      if (!files || files.length === 0) {
        alert('No file selected.');
        return;
      }
      try {
        const text = await files[0].text();
        const data = JSON.parse(text);
        if (!Array.isArray(data)) {
          alert('Invalid export format: expected an array of messages.');
          return;
        }

        // orgId -> (projectId -> Set<imageKey>)
        const byOrg = new Map<string, Map<string, Set<string>>>();

        for (const entry of data) {
          const rawBody = entry?.body;
          let body: any = rawBody;
          if (typeof rawBody === 'string') {
            try {
              body = JSON.parse(rawBody);
            } catch {
              body = null;
            }
          }
          if (!body || !Array.isArray(body?.images)) continue;

          // Prefer explicit body.projectId; fall back to deriving from key
          const declaredProjectId: string | undefined = body.projectId;

          for (const img of body.images) {
            const key: string | undefined = img?.key;
            if (!key) continue;
            const parts = key.split('/');
            const idx =
              parts.indexOf('images') >= 0
                ? parts.indexOf('images')
                : parts.indexOf('image');
            if (idx === -1 || parts.length < idx + 3) continue;
            const orgId = parts[idx + 1];
            const projectIdFromKey = parts[idx + 2];
            const projectId = declaredProjectId || projectIdFromKey;

            let projMap = byOrg.get(orgId);
            if (!projMap) {
              projMap = new Map<string, Set<string>>();
              byOrg.set(orgId, projMap);
            }
            let set = projMap.get(projectId);
            if (!set) {
              set = new Set<string>();
              projMap.set(projectId, set);
            }
            set.add(key);
          }
        }

        // Resolve names for organizations and projects
        const orgIds = Array.from(byOrg.keys());
        const projectIds = Array.from(byOrg.values()).flatMap((m) =>
          Array.from(m.keys())
        );

        const orgIdToName = new Map<string, string>();
        const projectIdToName = new Map<string, string>();

        try {
          await Promise.all(
            orgIds.map(async (id) => {
              try {
                const resp = await (client as any).models.Organization?.get?.({
                  id,
                  selectionSet: ['id', 'name'] as const,
                });
                const name = resp?.data?.name || id;
                orgIdToName.set(id, name);
              } catch {
                orgIdToName.set(id, id);
              }
            })
          );
        } catch {}

        try {
          await Promise.all(
            projectIds.map(async (id) => {
              try {
                const resp = await (client as any).models.Project.get({
                  id,
                  selectionSet: ['id', 'name'] as const,
                });
                const name = resp?.data?.name || id;
                projectIdToName.set(id, name);
              } catch {
                projectIdToName.set(id, id);
              }
            })
          );
        } catch {}

        // Log summary (with names)
        console.group(
          'SQS Export Summary (unique images per project grouped by organization)'
        );
        let grandTotal = 0;
        for (const [orgId, projMap] of byOrg) {
          const orgName = orgIdToName.get(orgId) || orgId;
          let orgTotal = 0;
          console.group(`Organization ${orgName} (${orgId})`);
          for (const [projectId, keySet] of projMap) {
            const projectName = projectIdToName.get(projectId) || projectId;
            console.log(
              `Project ${projectName} (${projectId}): ${keySet.size} images`
            );
            orgTotal += keySet.size;
          }
          console.log(`Organization total: ${orgTotal}`);
          console.groupEnd();
          grandTotal += orgTotal;
        }
        console.log(`Grand total images: ${grandTotal}`);
        console.groupEnd();
        alert('Summary logged to console.');
      } catch (e) {
        console.error('Failed to summarize file', e);
        alert('Failed to summarize file. See console for details.');
      }
    };

    input.click();
  }

  async function exportImageIdsAndKeysFromQueueJson() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';

    input.onchange = async () => {
      const files = input.files;
      if (!files || files.length === 0) {
        alert('No file selected.');
        return;
      }
      try {
        const text = await files[0].text();
        const data = JSON.parse(text);
        if (!Array.isArray(data)) {
          alert('Invalid export format: expected an array of messages.');
          return;
        }

        const csvRows: Array<{
          imageId: string;
          key: string;
          projectId?: string;
          setId?: string;
        }> = [];

        for (const entry of data) {
          const rawBody = entry?.body;
          let body: any = rawBody;

          // Handle both parsed and raw body formats
          if (typeof rawBody === 'string') {
            try {
              body = JSON.parse(rawBody);
            } catch {
              body = null;
            }
          }

          if (!body || !Array.isArray(body?.images)) continue;

          const projectId: string | undefined = body.projectId;
          const setId: string | undefined = body.setId;

          for (const img of body.images) {
            const imageId = img?.imageId;
            const key = img?.key;

            if (!imageId || !key) continue;

            csvRows.push({
              imageId,
              key,
              ...(projectId && { projectId }),
              ...(setId && { setId }),
            });
          }
        }

        if (csvRows.length === 0) {
          alert('No images found in the JSON file.');
          return;
        }

        const fileName = `queue-images-export-${new Date()
          .toISOString()
          .replace(/[:.]/g, '-')}`;
        exportFromJSON({
          data: csvRows,
          fileName,
          exportType: exportFromJSON.types.csv,
        });

        console.log(`Exported ${csvRows.length} images to ${fileName}.csv`);
        alert(
          `Successfully exported ${csvRows.length} images to ${fileName}.csv`
        );
      } catch (e) {
        console.error('Failed to export images from queue JSON', e);
        alert('Failed to export images. See console for details.');
      }
    };

    input.click();
  }

  const openImageLocations = async () => {
    const id = prompt('Enter the imageId');
    if (!id) return;
    const setId = prompt('Enter the annotationSetId (optional)') || '';
    setImageModalId(id);
    setImageModalAnnotationSetId(setId.trim() ? setId.trim() : null);
  };

  async function testUpstreamConcurrency() {
    const projectId = prompt('Enter the projectId to load (heavy query)');
    if (!projectId) return;
    const countStr = prompt('How many parallel requests? (default 50)') || '50';
    const count = Math.max(1, Number(countStr) || 50);

    setConcurrencyTest({
      running: true,
      total: count,
      started: 0,
      completed: 0,
      errors: 0,
    });

    const makeCall = async (i: number) => {
      setConcurrencyTest((s) => ({ ...s, started: s.started + 1 }));
      console.time(`concurrency-req-${i}`);
      try {
        // Intentionally heavy selectionSet to increase per-call latency and show batching
        await (client as any).models.Image.imagesByProjectId({
          projectId,
          selectionSet: ['id', 'leftNeighbours.*', 'rightNeighbours.*'],
          limit: 1000,
        });
      } catch (e) {
        setConcurrencyTest((s) => ({ ...s, errors: s.errors + 1 }));
        console.warn(`concurrency-req-${i} failed`, e);
      } finally {
        setConcurrencyTest((s) => ({ ...s, completed: s.completed + 1 }));
        console.timeEnd(`concurrency-req-${i}`);
      }
    };

    await Promise.all(Array.from({ length: count }, (_, i) => makeCall(i)));

    setConcurrencyTest((s) => ({ ...s, running: false }));
  }

  async function updateProjectwithTestPresets() {
    const { data: projects } = await client.models.Project.list();

    for (const project of projects) {
      const { data: config } = await (
        client as any
      ).models.ProjectTestConfig.get({
        projectId: project.id,
      });
      if (!config) {
        await (client as any).models.ProjectTestConfig.create({
          projectId: project.id,
          testType: 'interval',
          interval: 50,
          accuracy: 50,
          postTestConfirmation: false,
        });

        const testPresetResp = await (client as any).models.TestPreset.create({
          name: project.name,
          organizationId: project.organizationId,
        });
        const testPreset = testPresetResp.data!;

        await (client as any).models.TestPresetProject.create({
          testPresetId: testPreset.id,
          projectId: project.id,
        });
      }
    }
  }

  async function summarizeCameraOverlaps() {
    const projectId = prompt(
      'Enter the projectId to summarize camera overlaps'
    );
    if (!projectId) {
      return;
    }

    try {
      const [images, cameraResp, cameraOverlapResp] = await Promise.all([
        (fetchAllPaginatedResults as any)(
          (client as any).models.Image.imagesByProjectId,
          {
            projectId,
            selectionSet: [
              'id',
              'cameraId',
              'leftNeighbours.*',
              'rightNeighbours.*',
            ] as const,
            limit: 1000,
          }
        ),
        (client as any).models.Camera.camerasByProjectId({
          projectId,
          selectionSet: ['id', 'name'] as const,
          limit: 1000,
        }),
        (client as any).models.CameraOverlap?.cameraOverlapsByProjectId?.({
          projectId,
          selectionSet: ['cameraAId', 'cameraBId'] as const,
          limit: 1000,
        }),
      ]);

      const cameraData = (cameraResp?.data || []) as any[];
      const cameraIdToName = new Map<string, string>();
      for (const cam of cameraData) {
        if (cam?.id) {
          cameraIdToName.set(cam.id, cam?.name ?? cam.id);
        }
      }

      const imageIdToCameraId = new Map<string, string>();
      const cameraImageCounts = new Map<string, number>();
      const imagesMissingCamera: string[] = [];

      for (const image of images as any[]) {
        if (!image?.id) continue;
        const camId = image.cameraId as string | undefined;
        if (camId) {
          imageIdToCameraId.set(image.id, camId);
          cameraImageCounts.set(camId, (cameraImageCounts.get(camId) || 0) + 1);
        } else {
          imagesMissingCamera.push(image.id);
        }
      }

      const definedOverlapPairs = new Map<
        string,
        { cameraAId: string; cameraBId: string }
      >();
      const cameraOverlapItems = (cameraOverlapResp?.data || []) as any[];
      for (const item of cameraOverlapItems) {
        const camA = item?.cameraAId as string | undefined;
        const camB = item?.cameraBId as string | undefined;
        if (!camA || !camB) continue;
        const [camera1Id, camera2Id] =
          camA < camB ? [camA, camB] : [camB, camA];
        const key = `${camera1Id}::${camera2Id}`;
        definedOverlapPairs.set(key, {
          cameraAId: camera1Id,
          cameraBId: camera2Id,
        });
      }

      const seenNeighbourKeys = new Set<string>();
      const cameraPairStats = new Map<
        string,
        {
          camera1Id: string;
          camera2Id: string;
          camera1Name: string;
          camera2Name: string;
          edgeCount: number;
          imagePairs: Set<string>;
        }
      >();
      const neighboursMissingCamera = new Set<string>();

      for (const image of images as any[]) {
        const leftNeighbours = ((image?.leftNeighbours as any[]) ||
          []) as any[];
        const rightNeighbours = ((image?.rightNeighbours as any[]) ||
          []) as any[];
        for (const neighbour of [...leftNeighbours, ...rightNeighbours]) {
          if (!neighbour) continue;
          const image1Id = neighbour.image1Id as string | undefined;
          const image2Id = neighbour.image2Id as string | undefined;
          if (!image1Id || !image2Id) {
            continue;
          }
          const uniqueNeighbourKey = neighbour.id
            ? String(neighbour.id)
            : image1Id < image2Id
            ? `${image1Id}::${image2Id}`
            : `${image2Id}::${image1Id}`;
          if (seenNeighbourKeys.has(uniqueNeighbourKey)) {
            continue;
          }
          seenNeighbourKeys.add(uniqueNeighbourKey);

          const cam1 = imageIdToCameraId.get(image1Id);
          const cam2 = imageIdToCameraId.get(image2Id);
          if (!cam1 || !cam2) {
            neighboursMissingCamera.add(uniqueNeighbourKey);
            continue;
          }
          if (cam1 === cam2) {
            continue;
          }

          const [camera1Id, camera2Id] =
            cam1 < cam2 ? [cam1, cam2] : [cam2, cam1];
          const cameraPairKey = `${camera1Id}::${camera2Id}`;
          let stats = cameraPairStats.get(cameraPairKey);
          if (!stats) {
            stats = {
              camera1Id,
              camera2Id,
              camera1Name: cameraIdToName.get(camera1Id) ?? camera1Id,
              camera2Name: cameraIdToName.get(camera2Id) ?? camera2Id,
              edgeCount: 0,
              imagePairs: new Set<string>(),
            };
            cameraPairStats.set(cameraPairKey, stats);
          }

          stats.edgeCount += 1;
          const imagePairKey =
            image1Id < image2Id
              ? `${image1Id}::${image2Id}`
              : `${image2Id}::${image1Id}`;
          stats.imagePairs.add(imagePairKey);
        }
      }

      const cameraSummary = cameraData.map((cam) => ({
        cameraId: cam?.id,
        cameraName: cam?.name ?? cam?.id,
        imageCount: cameraImageCounts.get(cam?.id) || 0,
      }));

      cameraSummary.sort((a, b) => (b.imageCount || 0) - (a.imageCount || 0));

      const overlapSummary = Array.from(cameraPairStats.values())
        .map((stats) => ({
          camera1: `${stats.camera1Name} (${stats.camera1Id})`,
          camera2: `${stats.camera2Name} (${stats.camera2Id})`,
          neighbourEdges: stats.edgeCount,
          uniqueImagePairs: stats.imagePairs.size,
          definedOverlap: definedOverlapPairs.has(
            `${stats.camera1Id}::${stats.camera2Id}`
          ),
        }))
        .sort((a, b) => b.neighbourEdges - a.neighbourEdges);

      const observedPairKeys = new Set(Array.from(cameraPairStats.keys()));
      const definedButUnobserved = Array.from(
        definedOverlapPairs.keys()
      ).filter((key) => !observedPairKeys.has(key));

      console.group(`Camera overlap summary for project ${projectId} (survey)`);
      if (cameraSummary.length > 0) {
        console.group('Cameras');
        console.table(cameraSummary);
        console.groupEnd();
      } else {
        console.info('No cameras found for this project.');
      }

      if (imagesMissingCamera.length > 0) {
        console.warn(
          `Images missing cameraId: ${imagesMissingCamera.length}`,
          imagesMissingCamera
        );
      }

      if (overlapSummary.length > 0) {
        console.group('Overlapping camera pairs');
        console.table(overlapSummary);
        const missingDefinitions = overlapSummary.filter(
          (entry) => !entry.definedOverlap
        );
        if (missingDefinitions.length > 0) {
          console.warn(
            `${missingDefinitions.length} overlapping camera pair(s) do not have a CameraOverlap record:`,
            missingDefinitions.map(
              (entry) => `${entry.camera1} <-> ${entry.camera2}`
            )
          );
        }
        console.groupEnd();
      } else {
        console.info('No overlapping camera neighbours found.');
      }

      if (definedOverlapPairs.size > 0) {
        console.group('Defined camera overlaps');
        console.table(
          Array.from(definedOverlapPairs.entries()).map(([key, value]) => ({
            key,
            camera1: `${
              cameraIdToName.get(value.cameraAId) ?? value.cameraAId
            } (${value.cameraAId})`,
            camera2: `${
              cameraIdToName.get(value.cameraBId) ?? value.cameraBId
            } (${value.cameraBId})`,
            observedInNeighbours: observedPairKeys.has(key),
          }))
        );
        if (definedButUnobserved.length > 0) {
          console.warn(
            `${definedButUnobserved.length} CameraOverlap record(s) were defined but no neighbouring images were detected for those camera pairs.`
          );
        }
        console.groupEnd();
      } else {
        console.info('No CameraOverlap records defined for this project.');
      }

      if (neighboursMissingCamera.size > 0) {
        console.warn(
          `Skipped ${neighboursMissingCamera.size} neighbour(s) due to missing camera assignments.`
        );
      }
      console.groupEnd();

      alert(
        overlapSummary.length > 0
          ? `Found ${overlapSummary.length} overlapping camera pair${
              overlapSummary.length === 1 ? '' : 's'
            }. See console for details.`
          : 'No overlapping cameras found. See console for details.'
      );
    } catch (e) {
      console.error('Failed to summarize camera overlaps', e);
      alert('Failed to summarize camera overlaps. See console for details.');
    }
  }

  async function getNeighboursWithoutHomography() {
    //prompt for projectId
    const projectId = prompt('Enter the projectId');
    if (!projectId) {
      return;
    }
    const images = await fetchAllPaginatedResults(
      client.models.Image.imagesByProjectId,
      {
        projectId: projectId,
        selectionSet: ['id', 'leftNeighbours.*', 'rightNeighbours.*'] as const,
        limit: 1000,
      }
    );

    // export images that don't have either left or right neighbours
    const imagesWithoutNeighbours = images.filter(
      (i) => !i.leftNeighbours.length || !i.rightNeighbours.length
    );

    if (imagesWithoutNeighbours.length > 0) {
      exportFromJSON({
        data: imagesWithoutNeighbours,
        fileName: 'imagesWithoutNeighbours',
        exportType: exportFromJSON.types.csv,
      });
    }

    const neighbours = images.flatMap((i) => [
      ...i.leftNeighbours,
      ...i.rightNeighbours,
    ]);

    //dedupe neigbours by using image1Id and Image2Id as the composite key
    const uniqueNeighbours = neighbours.filter(
      (n, index, self) =>
        index ===
        self.findIndex(
          (t) => t.image1Id === n.image1Id && t.image2Id === n.image2Id
        )
    );

    const neighboursWithoutHomography = uniqueNeighbours.filter(
      (n) => !n.homography
    );

    exportFromJSON({
      data: neighboursWithoutHomography,
      fileName: 'neighboursWithoutHomography',
      exportType: exportFromJSON.types.csv,
    });
  }

  async function getCrossCameraNeighboursWithoutHomography() {
    const projectId = prompt(
      'Enter the projectId to scan for cross-camera neighbours without homography'
    );
    if (!projectId) {
      return;
    }

    const images = (await (fetchAllPaginatedResults as any)(
      (client as any).models.Image.imagesByProjectId,
      {
        projectId,
        selectionSet: [
          'id',
          'cameraId',
          'leftNeighbours.*',
          'rightNeighbours.*',
        ] as const,
        limit: 1000,
      }
    )) as any[];

    const cameraResp = await (client as any).models.Camera.camerasByProjectId({
      projectId,
      selectionSet: ['id', 'name'] as const,
      limit: 1000,
    });
    const cameraIdToName = new Map<string, string>();
    for (const cam of (cameraResp.data || []) as any[]) {
      if (cam?.id) {
        cameraIdToName.set(cam.id, cam?.name ?? cam.id);
      }
    }

    const imageMap = new Map<string, any>();
    for (const img of images) {
      imageMap.set(img.id, img);
    }

    const resultsMap = new Map<
      string,
      {
        pairKey: string;
        image1Id: string;
        image2Id: string;
        image1CameraId: string;
        image2CameraId: string;
        directions: Set<string>;
        observedFrom: Set<string>;
      }
    >();
    const missingCameraIds = new Set<string>();

    const addResult = (
      neighbour: any,
      direction: 'left' | 'right',
      observedFrom: string
    ) => {
      if (!neighbour || neighbour.homography) {
        return;
      }
      const img1 = imageMap.get(neighbour.image1Id);
      const img2 = imageMap.get(neighbour.image2Id);
      if (!img1 || !img2) {
        return;
      }

      const cam1 = img1.cameraId ?? null;
      const cam2 = img2.cameraId ?? null;

      if (!cam1 || !cam2) {
        if (!cam1) missingCameraIds.add(neighbour.image1Id);
        if (!cam2) missingCameraIds.add(neighbour.image2Id);
        return;
      }

      if (cam1 === cam2) {
        return;
      }

      const pairKey =
        neighbour.image1Id < neighbour.image2Id
          ? `${neighbour.image1Id}::${neighbour.image2Id}`
          : `${neighbour.image2Id}::${neighbour.image1Id}`;

      let record = resultsMap.get(pairKey);
      if (!record) {
        record = {
          pairKey,
          image1Id: neighbour.image1Id,
          image2Id: neighbour.image2Id,
          image1CameraId: cam1,
          image2CameraId: cam2,
          directions: new Set<string>(),
          observedFrom: new Set<string>(),
        };
        resultsMap.set(pairKey, record);
      }

      record.directions.add(direction);
      record.observedFrom.add(observedFrom);
    };

    for (const image of images) {
      for (const neighbour of (image.leftNeighbours ?? []) as any[]) {
        addResult(neighbour, 'left', image.id);
      }
      for (const neighbour of (image.rightNeighbours ?? []) as any[]) {
        addResult(neighbour, 'right', image.id);
      }
    }

    const results = Array.from(resultsMap.values()).map((item) => ({
      pairKey: item.pairKey,
      image1Id: item.image1Id,
      image1CameraId: item.image1CameraId,
      image1CameraName:
        cameraIdToName.get(item.image1CameraId) ?? item.image1CameraId,
      image2Id: item.image2Id,
      image2CameraId: item.image2CameraId,
      image2CameraName:
        cameraIdToName.get(item.image2CameraId) ?? item.image2CameraId,
      directions: Array.from(item.directions).sort().join('|'),
      observedFrom: Array.from(item.observedFrom).sort().join('|'),
    }));

    results.sort((a, b) => a.pairKey.localeCompare(b.pairKey));

    const resultsByCameraPair = new Map<
      string,
      {
        camera1Id: string;
        camera2Id: string;
        neighbours: typeof results;
      }
    >();

    for (const entry of results) {
      const [camA, camB] = [entry.image1CameraId, entry.image2CameraId].sort();
      const cameraPairKey = `${camA}::${camB}`;
      let bucket = resultsByCameraPair.get(cameraPairKey);
      if (!bucket) {
        bucket = {
          camera1Id: camA,
          camera2Id: camB,
          neighbours: [],
        };
        resultsByCameraPair.set(cameraPairKey, bucket);
      }
      bucket.neighbours.push(entry);
    }

    const overlappingCameraIds = new Set<string>();
    for (const { camera1Id, camera2Id } of resultsByCameraPair.values()) {
      overlappingCameraIds.add(camera1Id);
      overlappingCameraIds.add(camera2Id);
    }

    if (results.length === 0) {
      console.log(
        `No cross-camera neighbours without homography found for project ${projectId}.`
      );
      if (missingCameraIds.size > 0) {
        console.warn(
          'Skipped neighbour pairs due to missing cameraId on images:',
          Array.from(missingCameraIds)
        );
      }
      alert('No cross-camera neighbours without homography found.');
      return;
    }

    console.group(
      `Cross-camera neighbours without homography for project ${projectId}`
    );
    console.info(
      `Found ${results.length} neighbour${
        results.length === 1 ? '' : 's'
      } spanning ${resultsByCameraPair.size} camera pair${
        resultsByCameraPair.size === 1 ? '' : 's'
      }.`
    );
    if (overlappingCameraIds.size > 0) {
      const overlappingCameraList = Array.from(overlappingCameraIds).map(
        (id) => ({
          cameraId: id,
          cameraName: cameraIdToName.get(id) ?? id,
        })
      );
      console.info('Cameras involved in overlaps:', overlappingCameraList);
    }
    console.table(results);
    if (resultsByCameraPair.size > 0) {
      console.group('Camera pair breakdown');
      for (const [
        pairKey,
        { camera1Id, camera2Id, neighbours },
      ] of resultsByCameraPair) {
        const cam1Name = cameraIdToName.get(camera1Id) ?? camera1Id;
        const cam2Name = cameraIdToName.get(camera2Id) ?? camera2Id;
        console.group(
          `Camera pair ${cam1Name} (${camera1Id}) <-> ${cam2Name} (${camera2Id}) (${neighbours.length} neighbours)`
        );
        console.table(neighbours);
        console.groupEnd();
      }
      console.groupEnd();
    }
    if (missingCameraIds.size > 0) {
      console.warn(
        'Skipped neighbour pairs due to missing cameraId on images:',
        Array.from(missingCameraIds)
      );
    }
    console.groupEnd();

    const safeId = projectId.replace(/[^a-zA-Z0-9_-]+/g, '-');
    exportFromJSON({
      data: results,
      fileName: `cross-camera-neighbours-no-homography-${safeId}`,
      exportType: exportFromJSON.types.csv,
    });

    alert(
      `Found ${results.length} cross-camera neighbour${
        results.length === 1 ? '' : 's'
      } without homography across ${resultsByCameraPair.size} camera pair${
        resultsByCameraPair.size === 1 ? '' : 's'
      }. Exported CSV file.`
    );
  }

  async function summarizeCrossCameraNeighbourHomographies() {
    const projectId = prompt(
      'Enter the projectId to summarize cross-camera neighbour homographies'
    );
    if (!projectId) {
      return;
    }

    try {
      const images = (await (fetchAllPaginatedResults as any)(
        (client as any).models.Image.imagesByProjectId,
        {
          projectId,
          selectionSet: [
            'id',
            'cameraId',
            'width',
            'height',
            'leftNeighbours.*',
            'rightNeighbours.*',
          ] as const,
          limit: 1000,
        }
      )) as any[];

      const imageIdToCameraId = new Map<string, string>();
      for (const img of images) {
        if (img?.id && img?.cameraId)
          imageIdToCameraId.set(img.id, img.cameraId);
      }

      const pairKey = (a: string, b: string) =>
        a < b ? `${a}::${b}` : `${b}::${a}`;
      const neighbourInfo = new Map<
        string,
        { image1Id: string; image2Id: string; hasHomography: boolean }
      >();
      const imageById = new Map<string, any>();
      for (const img of images) imageById.set(img.id, img);

      for (const img of images) {
        const allN = [
          ...(((img as any).leftNeighbours as any[]) || []),
          ...(((img as any).rightNeighbours as any[]) || []),
        ];
        for (const n of allN) {
          if (!n?.image1Id || !n?.image2Id) continue;
          const key = pairKey(n.image1Id, n.image2Id);
          const prev = neighbourInfo.get(key);
          const hasHom = !!n.homography;
          if (!prev) {
            neighbourInfo.set(key, {
              image1Id: n.image1Id,
              image2Id: n.image2Id,
              hasHomography: hasHom,
            });
          } else if (hasHom && !prev.hasHomography) {
            neighbourInfo.set(key, { ...prev, hasHomography: true });
          }
        }
      }

      let totalCross = 0;
      let withHomography = 0;
      let withoutHomography = 0;
      let skippedMissingCamera = 0;
      const withHomographyRecords: Array<{
        image1Id: string;
        image2Id: string;
        camera1Id: string;
        camera2Id: string;
      }> = [];

      // Dimension comparison counters
      let withHomSameDims = 0;
      let withHomSwappedDims = 0;
      let withHomOtherMismatch = 0;
      let withHomUnknownDims = 0;
      let withoutHomSameDims = 0;
      let withoutHomSwappedDims = 0;
      let withoutHomOtherMismatch = 0;
      let withoutHomUnknownDims = 0;

      const getDims = (id: string) => {
        const im = imageById.get(id);
        const w = Number(im?.width);
        const h = Number(im?.height);
        const has = Number.isFinite(w) && Number.isFinite(h);
        return { w: has ? w : undefined, h: has ? h : undefined, has } as const;
      };

      for (const {
        image1Id,
        image2Id,
        hasHomography,
      } of neighbourInfo.values()) {
        const c1 = imageIdToCameraId.get(image1Id) || null;
        const c2 = imageIdToCameraId.get(image2Id) || null;
        if (!c1 || !c2) {
          skippedMissingCamera += 1;
          continue;
        }
        if (c1 === c2) continue;
        totalCross += 1;

        // Compare dimensions
        const d1 = getDims(image1Id);
        const d2 = getDims(image2Id);
        const comparable = d1.has && d2.has;
        const same = comparable && d1.w === d2.w && d1.h === d2.h;
        const swapped = comparable && d1.w === d2.h && d1.h === d2.w;

        if (hasHomography) {
          withHomography += 1;
          withHomographyRecords.push({
            image1Id,
            image2Id,
            camera1Id: c1,
            camera2Id: c2,
          });
          if (!comparable) withHomUnknownDims += 1;
          else if (same) withHomSameDims += 1;
          else if (swapped) withHomSwappedDims += 1;
          else withHomOtherMismatch += 1;
        } else {
          withoutHomography += 1;
          if (!comparable) withoutHomUnknownDims += 1;
          else if (same) withoutHomSameDims += 1;
          else if (swapped) withoutHomSwappedDims += 1;
          else withoutHomOtherMismatch += 1;
        }
      }

      if (withHomographyRecords.length > 0) {
        const safeId = projectId.replace(/[^a-zA-Z0-9_-]+/g, '-');
        exportFromJSON({
          data: withHomographyRecords,
          fileName: `cross-camera-neighbours-with-homography-${safeId}`,
          exportType: exportFromJSON.types.csv,
        });
      }

      console.group(
        `Cross-camera neighbour homography summary for project ${projectId}`
      );
      console.log('Total unique neighbours (all cameras):', neighbourInfo.size);
      console.log(
        'Skipped due to missing camera assignment:',
        skippedMissingCamera
      );
      console.log('Cross-camera neighbours:', totalCross);
      console.log('With homography:', withHomography);
      console.log('Without homography:', withoutHomography);
      if (withHomography > 0) {
        console.group('With homography - dimension comparison');
        console.log('Same W×H:', withHomSameDims);
        console.log(
          'Swapped W×H (indicative of 90° rotation):',
          withHomSwappedDims
        );
        console.log('Other mismatch:', withHomOtherMismatch);
        console.log('Unknown (missing dims):', withHomUnknownDims);
        console.groupEnd();
      }
      if (withoutHomography > 0) {
        console.group('Without homography - dimension comparison');
        console.log('Same W×H:', withoutHomSameDims);
        console.log(
          'Swapped W×H (indicative of 90° rotation):',
          withoutHomSwappedDims
        );
        console.log('Other mismatch:', withoutHomOtherMismatch);
        console.log('Unknown (missing dims):', withoutHomUnknownDims);
        console.groupEnd();
      }
      if (totalCross > 0) {
        const pct = Math.round((withHomography / totalCross) * 100);
        console.log(
          `Coverage: ${withHomography}/${totalCross} (${pct}%) have homographies`
        );
      }
      console.groupEnd();

      alert(
        totalCross > 0
          ? `Cross-camera neighbours: ${totalCross}. With homography: ${withHomography}. Without: ${withoutHomography}.`
          : 'No cross-camera neighbours found.'
      );
    } catch (e) {
      console.error('summarizeCrossCameraNeighbourHomographies failed', e);
      alert(
        'Failed to summarize cross-camera neighbours. See console for details.'
      );
    }
  }

  async function removeCameraWithChecks() {
    try {
      const cameraId = prompt('Enter the cameraId to remove');
      if (!cameraId) return;

      let projectId =
        prompt('Enter the projectId (leave blank to auto-detect)') || '';

      const camResp = await (client as any).models.Camera.get({
        id: cameraId,
        selectionSet: ['id', 'name', 'projectId'] as const,
      });
      const camera = camResp?.data;
      if (!camera) {
        alert('Camera not found.');
        return;
      }

      if (!projectId) projectId = camera.projectId as string;
      if (camera.projectId !== projectId) {
        alert('Provided projectId does not match camera.projectId. Aborting.');
        return;
      }

      const images = (await (fetchAllPaginatedResults as any)(
        (client as any).models.Image.imagesByProjectId,
        {
          projectId,
          selectionSet: ['id', 'cameraId'] as const,
          limit: 1000,
        }
      )) as Array<{ id: string; cameraId?: string | null }>;

      const imageIdsReferencing = images
        .filter((img) => (img.cameraId || null) === cameraId)
        .map((img) => img.id);

      const overlapResp = await (
        client as any
      ).models.CameraOverlap?.cameraOverlapsByProjectId?.({
        projectId,
        selectionSet: ['cameraAId', 'cameraBId'] as const,
        limit: 1000,
      });
      const overlaps = (
        (overlapResp?.data || []) as Array<{
          cameraAId: string;
          cameraBId: string;
        }>
      ).filter((o) => o.cameraAId === cameraId || o.cameraBId === cameraId);

      const summaryLines = [
        `Camera: ${camera?.name || cameraId}`,
        `Project: ${projectId}`,
        `Images referencing this camera: ${imageIdsReferencing.length}`,
        `CameraOverlap entries to delete: ${overlaps.length}`,
      ];

      console.group('Remove Camera - Preflight');
      console.log(summaryLines.join('\n'));
      if (imageIdsReferencing.length > 0) {
        console.warn(
          'Sample imageIds referencing camera (up to 20):',
          imageIdsReferencing.slice(0, 20)
        );
      }
      if (overlaps.length > 0) {
        console.info(
          'Overlaps involving this camera (first 20):',
          overlaps.slice(0, 20)
        );
      }
      console.groupEnd();

      if (imageIdsReferencing.length > 0) {
        alert(
          `Cannot remove camera; ${imageIdsReferencing.length} image(s) still reference it. Reassign or clear Image.cameraId first. See console for details.`
        );
        return;
      }

      const proceed = confirm(
        `Safe to remove camera. This will delete ${overlaps.length} CameraOverlap entries and then the camera. Proceed?`
      );
      if (!proceed) return;

      if (overlaps.length > 0) {
        // Delete overlaps referencing this camera
        const concurrency = 10;
        for (let i = 0; i < overlaps.length; i += concurrency) {
          const batch = overlaps.slice(i, i + concurrency);
          await Promise.all(
            batch.map(({ cameraAId, cameraBId }) =>
              (client as any).models.CameraOverlap.delete({
                cameraAId,
                cameraBId,
              })
            )
          );
        }
      }

      await (client as any).models.Camera.delete({ id: cameraId });
      alert('Camera removed successfully.');
    } catch (e) {
      console.error('removeCameraWithChecks failed', e);
      alert('Failed to remove camera. See console for details.');
    }
  }

  async function logImagesWithoutCameraId() {
    const projectId = prompt('Enter the projectId');
    if (!projectId) {
      return;
    }

    const images = await fetchAllPaginatedResults(
      client.models.Image.imagesByProjectId,
      {
        projectId: projectId,
        selectionSet: ['id', 'cameraId'],
      }
    );

    const imagesWithoutCameraId = images.filter((i) => !i.cameraId);

    console.log(imagesWithoutCameraId);
  }

  async function linkImagesToCamera() {
    const projects = (await (fetchAllPaginatedResults as any)(
      (client as any).models.Project.list,
      {
        selectionSet: ['id', 'name'] as const,
      }
    )) as any[];

    for (const project of projects) {
      console.log(`Processing project ${project.name}`);

      // Fetch cameras for this project and build a name -> id map
      const camResp = await (client as any).models.Camera.camerasByProjectId({
        projectId: project.id,
      });
      const existingCameras = (camResp.data || []) as any[];
      const cameraNameToId: Record<string, string> = {};
      (existingCameras || []).forEach((cam: any) => {
        if (cam?.name && cam?.id) cameraNameToId[cam.name] = cam.id;
      });
      const knownCameraNames = Object.keys(cameraNameToId);

      if (existingCameras.length === 0) {
        console.log(`No cameras found for project ${project.name}`);
        continue;
      }

      const images = (await (fetchAllPaginatedResults as any)(
        (client as any).models.Image.imagesByProjectId,
        {
          projectId: project.id,
          selectionSet: ['id', 'cameraId', 'originalPath'] as const,
          limit: 1000,
        }
      )) as any[];

      const extractCameraNameFromPath = (path: string): string | null => {
        const parts = path.split('/');
        if (parts.length > 1) parts.pop(); // remove filename
        for (let i = parts.length - 1; i >= 0; i--) {
          const seg = parts[i];
          if (knownCameraNames.includes(seg)) return seg;
        }
        return null;
      };

      const imagesWithoutCameraId = images.filter((i) => !i.cameraId);
      console.warn(
        `Found ${imagesWithoutCameraId.length} images without cameraId`
      );

      const updatePromises = imagesWithoutCameraId.map(async (image) => {
        const cameraName =
          existingCameras.length === 1
            ? 'Survey Camera'
            : extractCameraNameFromPath((image as any).originalPath ?? '');

        if (cameraName) {
          return client.models.Image.update({
            id: image.id,
            cameraId: cameraNameToId[cameraName],
          });
        }
      });

      await Promise.all(updatePromises);
      console.log(`Updated ${updatePromises.length} images`);
    }

    console.log('Done');
  }

  async function listImageNeighbours() {
    const projectId = prompt('Enter the projectId');
    if (!projectId) {
      return;
    }

    const images = (await (fetchAllPaginatedResults as any)(
      (client as any).models.Image.imagesByProjectId,
      {
        projectId: projectId,
        selectionSet: ['id', 'leftNeighbours.*', 'rightNeighbours.*'] as const,
        limit: 1000,
      }
    )) as any[];

    const imagesWithoutNeighbours = images.filter(
      (i) => !i.leftNeighbours.length || !i.rightNeighbours.length
    );

    console.log(imagesWithoutNeighbours);
  }

  async function listNeighboursWithNullHomography() {
    const projectId = prompt('Enter the projectId');
    if (!projectId) {
      return;
    }

    const images = await fetchAllPaginatedResults(
      client.models.Image.imagesByProjectId,
      {
        projectId: projectId,
        selectionSet: ['id', 'leftNeighbours.*', 'rightNeighbours.*'],
        limit: 1000,
      }
    );

    const imagesWithNullHomography = images.filter(
      (i: any) =>
        (i.leftNeighbours as any[]).some((n: any) => !n.homography) ||
        (i.rightNeighbours as any[]).some((n: any) => !n.homography)
    );

    console.log(imagesWithNullHomography);
  }

  async function runImageRegistration() {
    // const projects = await fetchAllPaginatedResults(
    //   client.models.Project.list,
    //   {
    //     selectionSet: ['id', 'name'],
    //   }
    // );

    const projectId = prompt('Enter the projectId');
    if (!projectId) {
      return;
    }

    const { data: project } = await client.models.Project.get({
      id: projectId,
    });

    if (!project) {
      console.error('Project not found');
      return;
    }

    const projects = [project];

    for (const project of projects) {
      console.log(`Processing project ${project.name}`);

      const images = (await (fetchAllPaginatedResults as any)(
        (client as any).models.Image.imagesByProjectId,
        {
          projectId: project.id,
          selectionSet: [
            'id',
            'leftNeighbours.*',
            'rightNeighbours.*',
          ] as const,
          limit: 1000,
        }
      )) as any[];

      // const imagesWithoutNeighbours = images.filter(
      //   (i) => !i.leftNeighbours.length || !i.rightNeighbours.length
      // );

      // // If more than 50% of the images don't have neighbours, run the registration
      // const runRegistration =
      //   imagesWithoutNeighbours.length / images.length > 0.5;

      // if (runRegistration) {
      console.warn(`Running registration for project ${project.name}`);

      client.mutations.runImageRegistration({
        projectId: project.id,
        metadata: JSON.stringify({
          masks: [],
        }),
        queueUrl: backend.custom.lightglueTaskQueueUrl,
      });
    }
    // }
    console.log('Done');
  }

  async function batchRunImageRegistrationForProject() {
    try {
      const projectId = prompt(
        'Enter the projectId to batch-run image registration'
      );
      if (!projectId) return;

      // Fetch all images for the project with required fields
      const images = (await (fetchAllPaginatedResults as any)(
        (client as any).models.Image.imagesByProjectId,
        {
          projectId,
          selectionSet: [
            'id',
            'originalPath',
            'timestamp',
            'cameraId',
          ] as const,
          limit: 1000,
        }
      )) as Array<{
        id: string;
        originalPath?: string | null;
        timestamp?: number | null;
        cameraId?: string | null;
      }>;

      if (!images || images.length === 0) {
        alert('No images found for this project.');
        return;
      }

      // Sort by timestamp ascending (same as UploadManager batching)
      images.sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));

      const BATCH_SIZE = 500;
      const overlapCount = 10;
      let invocationCount = 0;
      let totalPayloadImages = 0;

      for (let i = 0; i < images.length; i += BATCH_SIZE) {
        const batch = images.slice(i, i + BATCH_SIZE);
        const overlapStart = Math.max(0, i - overlapCount);
        const overlap = i > 0 ? images.slice(overlapStart, i) : [];
        const payload = overlap.concat(batch).map((img) => ({
          id: img.id,
          originalPath: img.originalPath ?? '',
          timestamp: typeof img.timestamp === 'number' ? img.timestamp : 0,
          cameraId: img.cameraId ?? undefined,
        }));

        await (client as any).mutations.runImageRegistration({
          projectId,
          metadata: JSON.stringify({ masks: [], images: payload }),
          queueUrl: backend.custom.lightglueTaskQueueUrl,
        });

        invocationCount += 1;
        totalPayloadImages += payload.length;
      }

      alert(
        `Dispatched ${invocationCount} invocation(s) with ${totalPayloadImages} payload image entries (including overlaps).`
      );
    } catch (e) {
      console.error('batchRunImageRegistrationForProject failed', e);
      alert('Failed to batch-run image registration. See console for details.');
    }
  }

  async function updateImageSetImageCount() {
    // const { data: projects } = await client.models.Project.list();

    //prompt for project id
    const projectId = prompt('Enter the projectId');
    if (!projectId) {
      return;
    }

    const { data: project } = await client.models.Project.get({
      id: projectId,
    });

    const projects = [project];

    for (const project of projects) {
      console.log(`Processing project ${project.name}`);
      const {
        data: [imageSet],
      } = await client.models.ImageSet.imageSetsByProjectId({
        projectId: project.id,
      });

      const images = (await (fetchAllPaginatedResults as any)(
        (client as any).models.Image.imagesByProjectId,
        {
          projectId: project.id,
          selectionSet: ['id'] as const,
          limit: 1000,
        }
      )) as any[];

      await client.models.ImageSet.update({
        id: imageSet.id,
        imageCount: images.length,
      });

      console.log(`Project ${project.name} has ${images.length} images`);
    }

    console.log('Done');
  }

  async function createMissingImageFiles() {
    try {
      // Ask user if they want to process all projects or just one
      const processAll = confirm(
        'Do you want to process ALL projects?\n\n' +
          'Click OK to process all projects, or Cancel to process just one specific project.'
      );

      let projectsToProcess: { id: string; name: string }[] = [];

      if (processAll) {
        // Get all projects
        const { data: allProjects } = await client.models.Project.list({
          selectionSet: ['id', 'name'] as const,
        });
        projectsToProcess = allProjects || [];
        console.log(`Found ${projectsToProcess.length} projects to process`);
      } else {
        // Get single project
        const projectId = prompt(
          'Enter the projectId to fix missing ImageFile records'
        );
        if (!projectId) {
          console.log('No project ID provided');
          return;
        }

        const { data: project } = await client.models.Project.get(
          { id: projectId },
          { selectionSet: ['id', 'name'] as const }
        );

        if (!project) {
          console.error('Project not found');
          return;
        }

        projectsToProcess = [{ id: project.id, name: project.name }];
      }

      let totalCreated = 0;
      let totalErrors = 0;
      let totalSkipped = 0;
      const projectResults: {
        projectId: string;
        projectName: string;
        created: number;
        errors: number;
        skipped: number;
      }[] = [];

      for (const project of projectsToProcess) {
        console.log(
          `\n=== Processing project: ${project.name} (${project.id}) ===`
        );

        try {
          // Get project details to determine key structure
          const { data: projectDetails } = await client.models.Project.get(
            { id: project.id },
            { selectionSet: ['id', 'organizationId', 'tags'] as const }
          );

          if (!projectDetails) {
            console.error(`Project details not found for ${project.id}`);
            continue;
          }

          const projRecord = projectDetails as Record<string, unknown>;
          const organizationId: string | undefined =
            typeof projRecord['organizationId'] === 'string'
              ? (projRecord['organizationId'] as string)
              : undefined;
          const tagsVal = projRecord['tags'];
          const isLegacyProject: boolean = Array.isArray(tagsVal)
            ? (tagsVal as unknown[]).some((t) => t === 'legacy')
            : false;

          const makeKey = (orig: string): string =>
            !isLegacyProject && organizationId
              ? `${organizationId}/${project.id}/${orig}`
              : orig;

          // Fetch all images for the project with their files
          const images = (await fetchAllPaginatedResults(
            client.models.Image.imagesByProjectId,
            {
              projectId: project.id,
              selectionSet: ['id', 'originalPath', 'files.*'] as const,
              limit: 1000,
            }
          )) as {
            id: string;
            originalPath: string;
            files?: { id: string; key: string; path: string; type: string }[];
          }[];

          console.log(
            `Found ${images.length} images in project ${project.name}`
          );

          let missingCount = 0;
          let skippedCount = 0;
          const missingImages: {
            id: string;
            originalPath: string;
            key: string;
            type: string;
          }[] = [];

          for (const image of images) {
            // Check if ImageFile already exists
            if (image.files && image.files.length > 0) {
              skippedCount++;
              continue;
            }

            // Prepare ImageFile data
            const finalKey = makeKey(image.originalPath);

            // Determine file type based on file extension
            const fileExtension = image.originalPath
              .split('.')
              .pop()
              ?.toLowerCase();
            let fileType = 'application/octet-stream';

            if (fileExtension) {
              switch (fileExtension) {
                case 'jpg':
                case 'jpeg':
                  fileType = 'image/jpeg';
                  break;
                case 'png':
                  fileType = 'image/png';
                  break;
                case 'tiff':
                case 'tif':
                  fileType = 'image/tiff';
                  break;
                case 'bmp':
                  fileType = 'image/bmp';
                  break;
                case 'gif':
                  fileType = 'image/gif';
                  break;
                case 'webp':
                  fileType = 'image/webp';
                  break;
                default:
                  fileType = 'application/octet-stream';
              }
            }

            missingCount++;
            missingImages.push({
              id: image.id,
              originalPath: image.originalPath,
              key: finalKey,
              type: fileType,
            });
          }

          // Show dry run results for this project
          console.log(`Dry run results for ${project.name}:`);
          console.log(`- Total images: ${images.length}`);
          console.log(
            `- Images with existing ImageFile records: ${skippedCount}`
          );
          console.log(`- Images missing ImageFile records: ${missingCount}`);

          if (missingCount > 0) {
            console.log(`Missing ImageFile records for:`);
            missingImages.forEach((img, index) => {
              console.log(
                `${index + 1}. Image ${img.id} (${img.originalPath}) -> Key: ${
                  img.key
                }, Type: ${img.type}`
              );
            });
          }

          // If processing all projects, ask for confirmation before proceeding
          if (processAll && missingCount > 0) {
            const proceed = confirm(
              `Project: ${project.name}\n` +
                `Found ${missingCount} images missing ImageFile records out of ${images.length} total images.\n\n` +
                `Do you want to create the missing ImageFile records for this project?\n\n` +
                `This will create ${missingCount} new ImageFile records.`
            );

            if (!proceed) {
              console.log(`Skipping project ${project.name} - user cancelled`);
              projectResults.push({
                projectId: project.id,
                projectName: project.name,
                created: 0,
                errors: 0,
                skipped: skippedCount,
              });
              continue;
            }
          } else if (!processAll) {
            // Single project mode - show confirmation
            const proceed = confirm(
              `Found ${missingCount} images missing ImageFile records out of ${images.length} total images.\n\n` +
                `Do you want to create the missing ImageFile records?\n\n` +
                `This will create ${missingCount} new ImageFile records.`
            );

            if (!proceed) {
              console.log('Operation cancelled by user');
              return;
            }
          }

          // Create the missing ImageFile records
          let createdCount = 0;
          let errorCount = 0;

          for (const img of missingImages) {
            try {
              await client.models.ImageFile.create({
                projectId: project.id,
                imageId: img.id,
                key: img.key,
                path: img.key,
                type: img.type,
              });

              createdCount++;
              console.log(
                `Created ImageFile for image ${img.id} (${img.originalPath})`
              );
            } catch (error) {
              errorCount++;
              console.error(
                `Failed to create ImageFile for image ${img.id}:`,
                error
              );
            }
          }

          console.log(
            `Completed ${project.name}: ${createdCount} ImageFile records created, ${errorCount} errors, ${skippedCount} already existed`
          );

          totalCreated += createdCount;
          totalErrors += errorCount;
          totalSkipped += skippedCount;

          projectResults.push({
            projectId: project.id,
            projectName: project.name,
            created: createdCount,
            errors: errorCount,
            skipped: skippedCount,
          });
        } catch (error) {
          console.error(`Failed to process project ${project.name}:`, error);
          projectResults.push({
            projectId: project.id,
            projectName: project.name,
            created: 0,
            errors: 1,
            skipped: 0,
          });
        }
      }

      // Show final summary
      console.log(`\n=== FINAL SUMMARY ===`);
      console.log(`Total projects processed: ${projectsToProcess.length}`);
      console.log(`Total ImageFile records created: ${totalCreated}`);
      console.log(`Total errors: ${totalErrors}`);
      console.log(`Total already existed: ${totalSkipped}`);

      console.log(`\nPer-project results:`);
      projectResults.forEach((result) => {
        console.log(
          `${result.projectName}: ${result.created} created, ${result.errors} errors, ${result.skipped} already existed`
        );
      });

      alert(
        `Completed processing ${projectsToProcess.length} projects.\n\n` +
          `Total created: ${totalCreated} ImageFile records\n` +
          `Total errors: ${totalErrors}\n` +
          `Total already existed: ${totalSkipped}`
      );
    } catch (error) {
      console.error('createMissingImageFiles failed:', error);
      alert(
        'Failed to create missing ImageFile records. See console for details.'
      );
    }
  }

  async function registerOverlapKInterval() {
    try {
      const projectId = prompt(
        'Enter the projectId for K-interval registration'
      );
      if (!projectId) return;

      const defaultQueue = backend?.custom?.lightglueTaskQueueUrl || '';
      const queueUrl = (
        prompt(
          'Enter the SQS Queue URL (leave blank for default)',
          defaultQueue
        ) || defaultQueue
      ).trim();
      if (!queueUrl) {
        alert('Queue URL is required.');
        return;
      }

      const kStr = prompt('Enter K interval count (default 3)', '3') || '3';
      const K = Math.max(1, Number(kStr) || 3);

      const dryRun = confirm('Dry run? OK = Yes (no writes), Cancel = No');

      // Fetch project to mirror key-prefixing rules
      const { data: project } = await (client as any).models.Project.get({
        id: projectId,
        selectionSet: ['id', 'organizationId', 'tags'] as const,
      });
      if (!project) {
        alert('Project not found');
        return;
      }

      const tags = Array.isArray(project.tags) ? project.tags : [];
      const isLegacy = tags.includes('legacy');
      const orgId = project.organizationId;
      const computeKey = (orig) =>
        !isLegacy && orgId ? `${orgId}/${projectId}/${orig}` : orig;

      // Fetch all images for project with neighbours
      const images = (await (fetchAllPaginatedResults as any)(
        (client as any).models.Image.imagesByProjectId,
        {
          projectId,
          selectionSet: [
            'id',
            'timestamp',
            'cameraId',
            'originalPath',
            'leftNeighbours.*',
            'rightNeighbours.*',
          ] as const,
          limit: 1000,
        }
      )) as any[];

      // Group images by camera and sort by timestamp
      const imagesByCamera = new Map();
      for (const img of images) {
        const cam = img.cameraId;
        if (!cam) continue;
        if (!imagesByCamera.has(cam)) imagesByCamera.set(cam, []);
        imagesByCamera.get(cam).push(img);
      }
      for (const arr of imagesByCamera.values()) {
        arr.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
      }

      // Build neighbour index from all images' left/right neighbours
      const pairKeySorted = (a, b) => (a < b ? `${a}::${b}` : `${b}::${a}`);
      const neighbourInfo = new Map();
      for (const img of images) {
        const neighs = [
          ...((img.leftNeighbours as any[]) || []),
          ...((img.rightNeighbours as any[]) || []),
        ];
        for (const n of neighs) {
          if (!n?.image1Id || !n?.image2Id) continue;
          const key = pairKeySorted(n.image1Id, n.image2Id);
          const prev = neighbourInfo.get(key);
          const hasHom = !!n.homography;
          neighbourInfo.set(key, {
            exists: true,
            hasHomography: prev ? prev.hasHomography || hasHom : hasHom,
          });
        }
      }

      // Fetch camera overlaps
      const overlapResp = await (
        client as any
      ).models.CameraOverlap?.cameraOverlapsByProjectId?.({
        projectId,
        selectionSet: ['cameraAId', 'cameraBId'] as const,
        limit: 1000,
      });
      const overlaps = (overlapResp?.data || []) as any[];
      if (!overlaps.length) {
        alert('No camera overlaps found for this project.');
        return;
      }

      const orientedPairs = [] as any[]; // [{ a, b }]
      const orientedPairSet = new Set<string>();

      // Time-based floor K-interval pairing per overlap
      for (const overlap of overlaps) {
        const c1 = overlap?.cameraAId;
        const c2 = overlap?.cameraBId;
        if (!c1 || !c2) continue;

        const choice = prompt(
          `Overlap cameras:\n${c1} and ${c2}\nEnter the cameraId to treat as A (leave blank to skip this overlap)`
        );
        if (!choice) continue;
        const A = choice === c1 || choice === c2 ? choice : null;
        if (!A) {
          console.warn('Invalid camera choice for overlap; skipping.', {
            overlap,
            choice,
          });
          continue;
        }
        const B = A === c1 ? c2 : c1;

        const arrA = imagesByCamera.get(A) || [];
        const arrB = imagesByCamera.get(B) || [];
        if (!arrA.length || !arrB.length) continue;

        let j = 0; // index into B such that B[j].timestamp >= A[i].timestamp
        for (const a of arrA) {
          const tA = a.timestamp || 0;
          while (j < arrB.length && (arrB[j].timestamp || 0) < tA) j++;
          if (j < arrB.length) {
            for (let k = 0; k < K && j + k < arrB.length; k++) {
              const b = arrB[j + k];
              const orientedKey = `${a.id}::${b.id}`;
              if (orientedPairSet.has(orientedKey)) continue;
              orientedPairSet.add(orientedKey);
              orientedPairs.push({ a, b });
            }
          }
        }
      }

      if (!orientedPairs.length) {
        alert('No candidate pairs generated.');
        return;
      }

      // Filter by neighbour state: drop if homography exists
      const selectedPairs = [] as any[];
      const needsNeighbourKeys = new Set<string>(); // sorted pair keys
      const skippedHomography = [] as any[];
      const missingOriginalPath = [] as any[];

      for (const { a, b } of orientedPairs) {
        const keySorted = pairKeySorted(a.id, b.id);
        const info = neighbourInfo.get(keySorted);
        if (info?.hasHomography) {
          skippedHomography.push({ aId: a.id, bId: b.id });
          continue; // already solved
        }
        if (!info?.exists) needsNeighbourKeys.add(keySorted);
        selectedPairs.push({ a, b });
        if (!a.originalPath || !b.originalPath) {
          missingOriginalPath.push({ aId: a.id, bId: b.id });
        }
      }

      // Prepare SQS entries (skip those lacking originalPath)
      const fifo = queueUrl.endsWith('.fifo');
      const entries = selectedPairs
        .filter(({ a, b }) => a.originalPath && b.originalPath)
        .map(({ a, b }, idx) => {
          const idStr = `${a.id}-${b.id}`.slice(0, 80);
          const body = {
            image1Id: a.id,
            image2Id: b.id,
            keys: [computeKey(a.originalPath), computeKey(b.originalPath)],
            action: 'register',
          };
          const entry = {
            Id: idStr,
            MessageBody: JSON.stringify(body),
          } as any;
          if (fifo) {
            entry.MessageGroupId = 'register';
            entry.MessageDeduplicationId = (
              idStr || `${Date.now()}-${idx}`
            ).slice(0, 128);
          }
          return entry;
        });

      if (dryRun) {
        console.group('K-interval registration (dry-run)');
        console.info('Project:', projectId);
        console.info('Queue URL:', queueUrl);
        console.info('K interval:', K);
        console.info('Overlaps:', overlaps.length);
        console.info('Generated oriented pairs:', orientedPairs.length);
        console.info(
          'Selected pairs (post neighbour filter):',
          selectedPairs.length
        );
        console.info(
          'Pairs needing neighbour creation:',
          needsNeighbourKeys.size
        );
        console.info(
          'Pairs skipped due to existing homography:',
          skippedHomography.length
        );
        if (missingOriginalPath.length) {
          console.warn(
            'Pairs missing originalPath (no message will be sent):',
            missingOriginalPath.length
          );
        }
        console.info('Entries to send:', entries.length);
        console.table(
          selectedPairs.slice(0, 20).map(({ a, b }) => ({
            aId: a.id,
            bId: b.id,
            aTs: a.timestamp,
            bTs: b.timestamp,
          }))
        );
        console.groupEnd();
        alert(
          `Dry-run complete. Candidates: ${orientedPairs.length}, post-filter: ${selectedPairs.length}, to-create neighbours: ${needsNeighbourKeys.size}, messages: ${entries.length}`
        );
        return;
      }

      // Live run: create missing neighbours then send SQS entries
      // Create neighbours (dedup by sorted key)
      if (needsNeighbourKeys.size > 0) {
        const tasks = Array.from(needsNeighbourKeys).map((key) => {
          const [i1, i2] = key.split('::');
          return async () => {
            try {
              await (client as any).models.ImageNeighbour.create({
                image1Id: i1,
                image2Id: i2,
              });
            } catch (e) {
              // Ignore conditional failures (already created)
              const msg = String(
                e?.errors?.[0]?.errorType || e?.toString?.() || ''
              );
              if (!msg.includes('ConditionalCheckFailed')) {
                console.warn('Failed to create neighbour', { key, e });
              }
            }
          };
        });
        const concurrency = 10;
        for (let i = 0; i < tasks.length; i += concurrency) {
          await Promise.all(tasks.slice(i, i + concurrency).map((t) => t()));
        }
      }

      // Send SQS messages: concurrent batches with retries and progress logging
      if (entries.length > 0) {
        const sqs = await getSqsClient();

        // Chunk into batches of up to 10 (SQS limit)
        const batches = [] as any[];
        for (let i = 0; i < entries.length; i += 10) {
          batches.push(entries.slice(i, i + 10));
        }

        let successCount = 0;
        let failedCount = 0;
        let nextIndex = 0;
        const totalMsgs = entries.length;
        const totalBatches = batches.length;
        const startTs = Date.now();

        const sendBatchWithRetry = async (
          batch: any[],
          attempt = 1
        ): Promise<void> => {
          try {
            const resp = await sqs.send(
              new SendMessageBatchCommand({
                QueueUrl: queueUrl,
                Entries: batch,
              })
            );
            const ok = (resp.Successful || []).length;
            const failed = resp.Failed || [];
            successCount += ok;

            if (failed.length > 0 && attempt < 3) {
              // Retry only failed entries
              const failedIds = new Set(failed.map((f: any) => f.Id));
              const retryEntries = batch.filter((e) => failedIds.has(e.Id));
              await new Promise((r) => setTimeout(r, 100 * attempt));
              await sendBatchWithRetry(retryEntries, attempt + 1);
            } else {
              failedCount += failed.length;
            }
          } catch (e) {
            if (attempt < 3) {
              await new Promise((r) => setTimeout(r, 200 * attempt));
              await sendBatchWithRetry(batch, attempt + 1);
            } else {
              failedCount += batch.length;
              console.error('SQS batch send failed after retries', e);
            }
          } finally {
            const remaining = Math.max(0, totalMsgs - successCount);
            console.log(
              `[SQS] Progress: success=${successCount}, failed=${failedCount}, remaining=${remaining}`
            );
          }
        };

        // Choose concurrency based on total batches, capped for browser env
        const concurrency = Math.min(
          16,
          Math.max(4, Math.ceil(totalBatches / 8))
        );
        console.log(
          `[SQS] Sending ${totalMsgs} messages in ${totalBatches} batches with concurrency ${concurrency}`
        );

        const workers = Array.from(
          { length: concurrency },
          async (_, workerId) => {
            for (;;) {
              const idx = nextIndex++;
              if (idx >= totalBatches) break;
              const batch = batches[idx];
              try {
                await sendBatchWithRetry(batch);
              } catch (e) {
                console.warn(`Worker ${workerId} encountered error`, e);
              }
            }
          }
        );

        await Promise.all(workers);

        const secs = Math.max(1, (Date.now() - startTs) / 1000);
        const rate = Math.round(successCount / secs);
        console.log(
          `[SQS] Completed sending. success=${successCount}, failed=${failedCount}, elapsed=${secs.toFixed(
            1
          )}s, rate≈${rate}/s`
        );
      }

      alert(
        `Done. Post-filter pairs: ${selectedPairs.length}. Neighbours created: ${needsNeighbourKeys.size}. Messages sent: ${entries.length}. Skipped (homography): ${skippedHomography.length}.`
      );
    } catch (e) {
      console.error('registerOverlapKInterval failed', e);
      alert('Failed to run K-interval registration. See console for details.');
    }
  }

  async function deleteDuplicateImages() {
    const projectId = prompt('Enter the projectId');
    if (!projectId) {
      return;
    }

    const images = (await (fetchAllPaginatedResults as any)(
      (client as any).models.Image.imagesByProjectId,
      {
        projectId: projectId,
        selectionSet: ['id'] as const,
        limit: 1000,
      }
    )) as any[];

    const unique = new Map<string, string>();
    const duplicates: any[] = [];

    for (const img of images) {
      const key = `${img.id}`;
      if (unique.has(key)) {
        duplicates.push(img);
      } else {
        unique.set(key, img.id);
      }
    }

    console.log(`Found ${duplicates.length} duplicate images`);
    if (duplicates.length === 0) {
      alert('No duplicate images found.');
      return;
    }

    const proceed = confirm(`Delete ${duplicates.length} duplicate images?`);
    if (!proceed) return;

    const {
      data: [imageSet],
    } = await client.models.ImageSet.imageSetsByProjectId({
      projectId: projectId,
    });

    const imageSetMemberships = (await (fetchAllPaginatedResults as any)(
      (client as any).models.ImageSetMembership.imageSetMembershipsByImageSetId,
      {
        imageSetId: imageSet.id,
        limit: 1000,
      }
    )) as any[];

    await Promise.all(
      duplicates.map(async (img) => {
        await client.models.Image.delete({ id: img.id });
        const imageSetMembership = (imageSetMemberships as any[]).find(
          (ism: any) => ism.imageId === img.id
        );
        if (imageSetMembership) {
          await client.models.ImageSetMembership.delete({
            id: imageSetMembership.id,
          });
        }
      })
    );

    alert(`Deleted ${duplicates.length} duplicate images.`);
  }

  async function deleteImagesByOriginalPathPhrase() {
    try {
      const projectId = prompt('Enter the projectId to scan for deletions');
      if (!projectId) return;

      const phrase = prompt(
        'Enter the CASE-SENSITIVE phrase to match in originalPath'
      );
      if (!phrase) return;

      const images = (await (fetchAllPaginatedResults as any)(
        (client as any).models.Image.imagesByProjectId,
        {
          projectId,
          selectionSet: [
            'id',
            'originalPath',
            'memberships.id',
            'files.id',
            'files.key',
            'files.path',
            'files.type',
          ] as const,
          limit: 1000,
        }
      )) as Array<{
        id: string;
        originalPath?: string | null;
        memberships?: Array<{ id: string }>;
        files?: Array<{ id: string; key: string; path: string; type: string }>;
      }>;

      const toDelete = images.filter((img) =>
        String(img.originalPath || '').includes(phrase)
      );

      if (toDelete.length === 0) {
        alert('No images matched the phrase.');
        return;
      }

      const withDetails = toDelete.map((img) => ({
        id: img.id,
        originalPath: img.originalPath || '',
        membershipIds: (img.memberships || []).map((m) => m.id),
        files: img.files || [],
      }));

      console.group(
        `Images matching phrase "${phrase}" in project ${projectId} (${withDetails.length})`
      );
      console.table(
        withDetails.map((d) => ({
          id: d.id,
          originalPath: d.originalPath,
          membershipCount: d.membershipIds.length,
          fileCount: d.files.length,
        }))
      );
      console.log('Full details:', withDetails);
      console.groupEnd();

      const proceed = confirm(
        `Delete ${withDetails.length} image(s) that match "${phrase}"? This will remove their ImageSetMemberships then delete the Image.`
      );
      if (!proceed) return;

      let success = 0;
      let failure = 0;
      for (const d of withDetails) {
        try {
          // Best-effort: delete memberships first
          for (const memId of d.membershipIds) {
            try {
              await (client as any).models.ImageSetMembership.delete({
                id: memId,
              });
            } catch (e) {
              console.warn('Failed to delete membership', memId, e);
            }
          }
          // Delete ImageFile records linked to this image
          for (const f of d.files) {
            try {
              await (client as any).models.ImageFile.delete({ id: f.id });
            } catch (e) {
              console.warn('Failed to delete image file record', f.id, e);
            }
          }
          await (client as any).models.Image.delete({ id: d.id });
          success += 1;
        } catch (e) {
          console.warn('Failed to delete image', d.id, e);
          failure += 1;
        }
      }

      alert(`Deletion complete. Success: ${success}. Failures: ${failure}.`);
    } catch (e) {
      console.error('deleteImagesByOriginalPathPhrase failed', e);
      alert('Failed to delete images. See console for details.');
    }
  }

  async function deleteDuplicateLocations() {
    const projectId = prompt('Enter the projectId');
    if (!projectId) {
      return;
    }

    // Fetch all locations for the project
    const locations = await fetchAllPaginatedResults(
      client.models.Location.locationsByProjectIdAndSource,
      {
        // @ts-ignore
        projectId: projectId,
        selectionSet: ['id', 'imageId', 'setId', 'height', 'width', 'x', 'y'],
        limit: 1000,
      } as any
    );

    const unique = new Map<string, string>();
    const duplicates: any[] = [];

    for (const loc of locations) {
      if (!loc?.imageId || !loc?.setId) continue;
      const key = `${loc.imageId}-${loc.setId}-${loc.height ?? ''}-${
        loc.width ?? ''
      }-${loc.x}-${loc.y}`;
      if (unique.has(key)) {
        duplicates.push(loc);
      } else {
        unique.set(key, loc.id);
      }
    }

    console.log(`Found ${duplicates.length} duplicate locations`);
    if (duplicates.length === 0) {
      alert('No duplicate locations found.');
      return;
    }

    const proceed = confirm(`Delete ${duplicates.length} duplicate locations?`);
    if (!proceed) return;

    await Promise.all(
      duplicates.map(async (loc) => {
        try {
          await client.models.Location.delete({ id: loc.id } as any);
        } catch (e) {
          console.error('Failed to delete duplicate location', loc.id, e);
        }
      })
    );

    alert(`Deleted ${duplicates.length} duplicate locations.`);
  }

  async function countProjectImages() {
    const projectId = prompt('Project id');

    const images = await fetchAllPaginatedResults(
      client.models.Image.imagesByProjectId,
      {
        projectId,
        selectionSet: ['id'] as const,
        limit: 1000,
      }
    );

    console.log(images.length);
  }

  async function deleteCrossCameraNeighbours() {
    try {
      const projectId = prompt(
        'Enter the projectId to delete cross-camera neighbours'
      );
      if (!projectId) return;

      const dryRun = confirm('Dry run? OK = Yes (no deletes), Cancel = No');

      // Fetch all project images with cameraId and neighbours
      const images = (await (fetchAllPaginatedResults as any)(
        (client as any).models.Image.imagesByProjectId,
        {
          projectId,
          selectionSet: [
            'id',
            'cameraId',
            'leftNeighbours.*',
            'rightNeighbours.*',
          ] as const,
          limit: 1000,
        }
      )) as any[];

      const imageIdToCameraId = new Map<string, string>();
      for (const img of images) {
        if (img?.id && img?.cameraId)
          imageIdToCameraId.set(img.id, img.cameraId);
      }

      // Collect unique neighbours from all images
      const pairKey = (a: string, b: string) =>
        a < b ? `${a}::${b}` : `${b}::${a}`;
      const uniqueNeighbours = new Map<
        string,
        { image1Id: string; image2Id: string }
      >();
      for (const img of images) {
        const allN = [
          ...(((img as any).leftNeighbours as any[]) || []),
          ...(((img as any).rightNeighbours as any[]) || []),
        ];
        for (const n of allN) {
          if (!n?.image1Id || !n?.image2Id) continue;
          const key = pairKey(n.image1Id, n.image2Id);
          if (!uniqueNeighbours.has(key)) {
            // Preserve the orientation as stored in this neighbour record
            uniqueNeighbours.set(key, {
              image1Id: n.image1Id,
              image2Id: n.image2Id,
            });
          }
        }
      }

      // Filter to neighbours spanning two different cameras
      const toDelete: Array<{ image1Id: string; image2Id: string }> = [];
      const skippedMissingCamera: Array<{
        image1Id: string;
        image2Id: string;
      }> = [];
      for (const { image1Id, image2Id } of uniqueNeighbours.values()) {
        const c1 = imageIdToCameraId.get(image1Id) || null;
        const c2 = imageIdToCameraId.get(image2Id) || null;
        if (!c1 || !c2) {
          skippedMissingCamera.push({ image1Id, image2Id });
          continue;
        }
        if (c1 !== c2) {
          toDelete.push({ image1Id, image2Id });
        }
      }

      if (toDelete.length === 0) {
        console.log('No cross-camera neighbours found for deletion.');
        alert('No cross-camera neighbours found.');
        return;
      }

      if (dryRun) {
        console.group('Delete cross-camera neighbours (dry-run)');
        console.info('Project:', projectId);
        console.info('Unique neighbours total:', uniqueNeighbours.size);
        console.info(
          'Missing camera assignments (skipped):',
          skippedMissingCamera.length
        );
        console.info('Cross-camera neighbours to delete:', toDelete.length);
        console.table(toDelete.slice(0, 50));
        console.groupEnd();
        alert(
          `Dry-run: ${toDelete.length} cross-camera neighbours would be deleted. See console for details.`
        );
        return;
      }

      const proceed = confirm(
        `Delete ${toDelete.length} cross-camera neighbours?`
      );
      if (!proceed) return;

      // Delete with limited concurrency
      let success = 0;
      let failure = 0;
      const concurrency = 10;
      for (let i = 0; i < toDelete.length; i += concurrency) {
        const batch = toDelete.slice(i, i + concurrency);
        await Promise.all(
          batch.map(async ({ image1Id, image2Id }) => {
            try {
              await (client as any).models.ImageNeighbour.delete({
                image1Id,
                image2Id,
              });
              success += 1;
            } catch (e) {
              console.warn('Failed to delete neighbour', {
                image1Id,
                image2Id,
                e,
              });
              failure += 1;
            }
          })
        );
        // brief delay to avoid hammering
        await new Promise((r) => setTimeout(r, 100));
      }

      alert(
        `Deleted ${success} cross-camera neighbours. Failures: ${failure}.`
      );
    } catch (e) {
      console.error('deleteCrossCameraNeighbours failed', e);
      alert(
        'Failed to delete cross-camera neighbours. See console for details.'
      );
    }
  }

  async function updateProjectTags() {
    const { data: projects } = await client.models.Project.list();

    for (const project of projects) {
      if (project.tags?.includes('legacy')) continue;
      await client.models.Project.update({
        id: project.id,
        tags: ['legacy'],
      });
    }
  }

  // Delete a project and best-effort clean up related data (replicates backend handler)
  async function deleteProjectReplicated() {
    try {
      const projectId = prompt('Enter the projectId to delete');
      if (!projectId) return;

      const confirmDelete = confirm(
        `This will delete the Project record and attempt to remove related records (best-effort).\n\nProject ID: ${projectId}\n\nProceed?`
      );
      if (!confirmDelete) return;

      // Ensure project exists (fetch minimal data)
      const { data: project } = await (client as any).models.Project.get(
        { id: projectId },
        { selectionSet: ['id', 'name', 'organizationId'] as const }
      );
      if (!project) {
        alert('Project not found.');
        return;
      }

      const counts = {
        membershipsDeleted: 0,
        categoriesDeleted: 0,
        locationSetsDeleted: 0,
        annotationSetsDeleted: 0,
        imagesDeleted: 0,
        imageSetMembershipsDeleted: 0,
        imageFilesDeleted: 0,
        objectsDeleted: 0,
        annotationsDeleted: 0,
        locationsDeleted: 0,
        projectDeleted: 0,
        failures: 0,
      };

      const safeListAll = async <T,>(
        listFn: any,
        variables?: Record<string, any>
      ): Promise<T[]> => {
        try {
          return (await (fetchAllPaginatedResults as any)(listFn, {
            ...variables,
            limit: 1000,
          })) as T[];
        } catch (e) {
          console.warn('List failed', { variables, e });
          return [] as T[];
        }
      };

      // Delete the project record first (as in the handler)
      try {
        await (client as any).models.Project.delete({ id: projectId });
        counts.projectDeleted += 1;
      } catch (e) {
        counts.failures += 1;
        console.warn('Failed to delete Project (continuing with cleanup):', e);
      }

      // Best-effort: delete user project memberships
      try {
        const memberships = await safeListAll<any>(
          (client as any).models.UserProjectMembership.list,
          {
            filter: { projectId: { eq: projectId } },
            selectionSet: ['id'] as const,
          }
        );
        await Promise.all(
          memberships.map(async (m) => {
            try {
              await (client as any).models.UserProjectMembership.delete({
                id: m.id,
              });
              counts.membershipsDeleted += 1;
            } catch (e) {
              counts.failures += 1;
              console.warn('Failed to delete membership', m.id, e);
            }
          })
        );
      } catch (e) {
        counts.failures += 1;
        console.warn('Membership cleanup failed', e);
      }

      // Categories
      try {
        const categories = await safeListAll<any>(
          (client as any).models.Category.list,
          {
            filter: { projectId: { eq: projectId } },
            selectionSet: ['id'] as const,
          }
        );
        await Promise.all(
          categories.map(async (c) => {
            try {
              await (client as any).models.Category.delete({ id: c.id });
              counts.categoriesDeleted += 1;
            } catch (e) {
              counts.failures += 1;
              console.warn('Failed to delete category', c.id, e);
            }
          })
        );
      } catch (e) {
        counts.failures += 1;
      }

      // Location sets
      let locationSets: any[] = [];
      try {
        locationSets = await safeListAll<any>(
          (client as any).models.LocationSet.list,
          {
            filter: { projectId: { eq: projectId } },
            selectionSet: ['id'] as const,
          }
        );
        await Promise.all(
          locationSets.map(async (ls) => {
            try {
              await (client as any).models.LocationSet.delete({ id: ls.id });
              counts.locationSetsDeleted += 1;
            } catch (e) {
              counts.failures += 1;
              console.warn('Failed to delete location set', ls.id, e);
            }
          })
        );
      } catch (e) {
        counts.failures += 1;
      }

      // Annotation sets (and their tasks/annotations where possible)
      let annotationSets: any[] = [];
      try {
        annotationSets = await safeListAll<any>(
          (client as any).models.AnnotationSet.list,
          {
            filter: { projectId: { eq: projectId } },
            selectionSet: ['id'] as const,
          }
        );
        // Delete annotations in each annotation set (best-effort)
        for (const as of annotationSets) {
          const annos = await safeListAll<any>(
            (client as any).models.Annotation.annotationsByAnnotationSetId,
            { setId: as.id, selectionSet: ['id'] as const, limit: 1000 }
          );
          await Promise.all(
            annos.map(async (a) => {
              try {
                await (client as any).models.Annotation.delete({ id: a.id });
                counts.annotationsDeleted += 1;
              } catch (e) {
                counts.failures += 1;
              }
            })
          );
          try {
            await (client as any).models.AnnotationSet.delete({ id: as.id });
            counts.annotationSetsDeleted += 1;
          } catch (e) {
            counts.failures += 1;
          }
        }
      } catch (e) {
        counts.failures += 1;
      }

      // Images
      let images: any[] = [];
      try {
        images = await safeListAll<any>(
          (client as any).models.Image.imagesByProjectId,
          { projectId, selectionSet: ['id'] as const, limit: 1000 }
        );
        await Promise.all(
          images.map(async (img) => {
            try {
              await (client as any).models.Image.delete({ id: img.id });
              counts.imagesDeleted += 1;
            } catch (e) {
              counts.failures += 1;
              console.warn('Failed to delete image', img.id, e);
            }
          })
        );
      } catch (e) {
        counts.failures += 1;
      }

      // Image files (by projectId)
      try {
        const imageFiles = await safeListAll<any>(
          (client as any).models.ImageFile.list,
          {
            filter: { projectId: { eq: projectId } },
            selectionSet: ['id'] as const,
          }
        );
        await Promise.all(
          imageFiles.map(async (f) => {
            try {
              await (client as any).models.ImageFile.delete({ id: f.id });
              counts.imageFilesDeleted += 1;
            } catch (e) {
              counts.failures += 1;
            }
          })
        );
      } catch (e) {
        counts.failures += 1;
      }

      // Image set (there should typically be 1)
      try {
        const imageSets = await safeListAll<any>(
          (client as any).models.ImageSet.imageSetsByProjectId,
          { projectId, selectionSet: ['id'] as const }
        );
        for (const iset of imageSets) {
          try {
            // Delete memberships for this image set
            const memberships = await safeListAll<any>(
              (client as any).models.ImageSetMembership
                .imageSetMembershipsByImageSetId,
              {
                imageSetId: iset.id,
                selectionSet: ['id'] as const,
                limit: 1000,
              }
            );
            await Promise.all(
              memberships.map(async (m) => {
                try {
                  await (client as any).models.ImageSetMembership.delete({
                    id: m.id,
                  });
                  counts.imageSetMembershipsDeleted += 1;
                } catch (e) {
                  counts.failures += 1;
                }
              })
            );
          } catch (e) {
            counts.failures += 1;
          }
          try {
            await (client as any).models.ImageSet.delete({ id: iset.id });
          } catch (e) {
            counts.failures += 1;
          }
        }
      } catch (e) {
        counts.failures += 1;
      }

      // Objects (by projectId)
      try {
        const objects = await safeListAll<any>(
          (client as any).models.Object.list,
          {
            filter: { projectId: { eq: projectId } },
            selectionSet: ['id'] as const,
          }
        );
        await Promise.all(
          objects.map(async (o) => {
            try {
              await (client as any).models.Object.delete({ id: o.id });
              counts.objectsDeleted += 1;
            } catch (e) {
              counts.failures += 1;
            }
          })
        );
      } catch (e) {
        counts.failures += 1;
      }

      // Locations (by projectId)
      try {
        const locations = await safeListAll<any>(
          (client as any).models.Location.list,
          {
            filter: { projectId: { eq: projectId } },
            selectionSet: ['id'] as const,
          }
        );
        await Promise.all(
          locations.map(async (loc) => {
            try {
              await (client as any).models.Location.delete({ id: loc.id });
              counts.locationsDeleted += 1;
            } catch (e) {
              counts.failures += 1;
            }
          })
        );
      } catch (e) {
        counts.failures += 1;
      }

      console.group('Delete Project (replicated) summary');
      console.log('Project ID:', projectId);
      console.table(counts as any);
      console.groupEnd();
      alert(
        `Deletion attempt finished. Project deleted: ${counts.projectDeleted}. Memberships deleted: ${counts.membershipsDeleted}. Failures: ${counts.failures}. See console for details.`
      );
    } catch (e) {
      console.error('deleteProjectReplicated failed', e);
      alert('Failed to delete project. See console for details.');
    }
  }

  async function removeLoctionsForProject() {
    const projectId = prompt('Enter the projectId');
    if (!projectId) {
      return;
    }

    const locationSets = await fetchAllPaginatedResults(
      client.models.LocationSet.locationSetsByProjectId,
      {
        projectId: projectId,
        limit: 1000,
      }
    );

    // Delete all tiled location sets
    const tiledLocationSets = locationSets.filter(
      (locationSet) =>
        !locationSet.name.includes('scoutbot') &&
        !locationSet.name.includes('mad') &&
        !locationSet.name.includes('elephant')
    );

    for (const locationSet of tiledLocationSets) {
      console.log(`Deleting location set ${locationSet.name}`);

      await client.models.LocationSet.delete({ id: locationSet.id });

      console.log(`Deleting locations for location set ${locationSet.name}`);

      const locations = await fetchAllPaginatedResults(
        client.models.Location.locationsBySetIdAndConfidence,
        {
          setId: locationSet.id,
          limit: 1000,
        }
      );

      await Promise.all(
        locations.map(async (location) => {
          await client.models.Location.delete({ id: location.id });
        })
      );
    }

    console.log('Done');
  }

  async function logSurveyImages() {
    const surveyId = prompt('Enter the surveyId');
    if (!surveyId) {
      return;
    }

    const images = await fetchAllPaginatedResults(
      client.models.Image.imagesByProjectId,
      {
        projectId: surveyId,
        selectionSet: [
          'id',
          'originalPath',
          'timestamp',
          'latitude',
          'longitude',
          'cameraId',
        ],
        limit: 1000,
      }
    );

    const imagesWithoutGPS = images.filter(
      (image) => !image.latitude || !image.longitude
    );

    images.sort((a, b) => a.timestamp - b.timestamp);

    console.log(images);
    // console.log(images.length, imagesWithoutGPS.length);
  }

  async function listOrganizationUsers() {
    const organizationId = prompt('organization id');

    if (!organizationId) {
      return;
    }

    const organizationMemberships = await fetchAllPaginatedResults(
      client.models.OrganizationMembership.membershipsByOrganizationId,
      { organizationId, selectionSet: ['userId'], limit: 1000 }
    );

    const {
      data: { Users },
    } = await client.queries.listUsers({
      userIds: organizationMemberships.map((m) => m.userId),
    });

    console.log(Users);
  }

  async function exportAnnotationSetResults() {
    const annotationSetId = prompt('Enter the annotationSetId');
    if (!annotationSetId) {
      return;
    }

    const { data: annotationSet } = await client.models.AnnotationSet.get(
      { id: annotationSetId },
      { selectionSet: ['id', 'name', 'projectId', 'project.name'] }
    );

    if (!annotationSet) {
      console.error('Annotation set not found');
      return;
    }

    const surveyId = annotationSet.projectId;

    const cameras = await fetchAllPaginatedResults(
      client.models.Camera.camerasByProjectId,
      { projectId: surveyId, selectionSet: ['id', 'name'] }
    );

    const annotations = await fetchAllPaginatedResults(
      client.models.Annotation.annotationsByAnnotationSetId,
      {
        setId: annotationSetId,
        selectionSet: [
          'y',
          'x',
          'category.name',
          'owner',
          'source',
          'obscured',
          'id',
          'objectId',
          'image.originalPath',
          'image.timestamp',
          'image.latitude',
          'image.longitude',
          'image.cameraId',
        ] as const,
        limit: 1000,
      }
    );

    const fileName = `SurveyScope-${annotationSet.project.name}-${annotationSet.name}`;
    const exportType = exportFromJSON.types.csv;
    exportFromJSON({
      data: annotations.map((anno) => {
        let camera = cameras.find((c) => c.id === anno.image.cameraId) || {
          name: 'Unknown',
        };

        return {
          category: anno.category?.name,
          image: anno.image.originalPath || 'Unknown',
          timestamp: anno.image.timestamp,
          latitude: anno.image.latitude,
          longitude: anno.image.longitude,
          obscured: anno.obscured,
          annotator: anno.owner, // TODO: map to user name
          isPrimary: anno.objectId === anno.id,
          objectId: anno.objectId,
          x: anno.x,
          y: anno.y,
          source: anno.source,
          camera: camera.name,
        };
      }),
      fileName,
      exportType,
    });
  }

  async function setProjectStatus() {
    const projectId = prompt('Enter the projectId');
    if (!projectId) {
      return;
    }

    const status = prompt('Enter the status');
    if (!status) {
      return;
    }

    if (!['active', 'launching'].includes(status)) {
      return;
    }

    await client.models.Project.update({
      id: projectId,
      status: status,
    });

    client.mutations.updateProjectMemberships({
      projectId: projectId,
    });
  }

  async function inspectTwoImagesExif() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.multiple = true;

    input.onchange = async () => {
      const files = input.files;
      if (!files || files.length === 0) {
        alert('No files selected.');
        return;
      }
      if (files.length !== 2) {
        alert('Please select exactly two image files.');
        return;
      }

      const selected = [files[0], files[1]];
      for (const file of selected) {
        console.group(`EXIF inspection: ${file.name}`);
        console.log('Name:', file.name);
        console.log('Type:', file.type);
        console.log('Size (bytes):', file.size);

        try {
          console.time('exifr.parse');
          const tags = await exifr.parse(file);
          console.timeEnd('exifr.parse');
          if (tags && typeof tags === 'object') {
            console.log('EXIF tags:', tags);
            try {
              const exifW =
                (tags as any)?.ImageWidth ?? (tags as any)?.ExifImageWidth;
              const exifH =
                (tags as any)?.ImageHeight ?? (tags as any)?.ExifImageHeight;
              const orientation = (tags as any)?.Orientation;
              let swaps = false;
              if (typeof orientation === 'number') {
                swaps = orientation > 4; // 5-8 require width/height swap
              } else if (typeof orientation === 'string') {
                const o = orientation.toLowerCase();
                swaps =
                  o.includes('90') ||
                  o.includes('270') ||
                  o.includes('transpose') ||
                  o.includes('transverse') ||
                  o.includes('mirror horizontal and rotate') ||
                  o.includes('mirror vertical and rotate');
              }
              if (Number.isFinite(exifW) && Number.isFinite(exifH)) {
                console.log('EXIF raw dimensions:', exifW, exifH);
                const orientedW = swaps ? exifH : exifW;
                const orientedH = swaps ? exifW : exifH;
                console.log('EXIF orientation:', orientation);
                console.log(
                  'Effective (oriented) dimensions:',
                  orientedW,
                  orientedH
                );
              }
            } catch (e) {
              console.warn(
                'Failed to compute oriented dimensions from EXIF:',
                e
              );
            }
          } else {
            console.warn('No EXIF metadata found.');
          }
        } catch (e) {
          console.error('EXIF parse failed (possible corruption):', e);
        }

        // Basic decode check using Image element
        try {
          const url = URL.createObjectURL(file);
          await new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              console.log(
                'Decoded image dimensions:',
                img.naturalWidth,
                img.naturalHeight
              );
              URL.revokeObjectURL(url);
              resolve();
            };
            img.onerror = (err) => {
              URL.revokeObjectURL(url);
              reject(err);
            };
            img.src = url;
          });
        } catch (e) {
          console.error('Image decode failed (likely corrupt):', e);
        }

        console.groupEnd();
      }
    };

    input.click();
  }

  // Helper function to compute elevation from HGT buffer (same as UploadManager)
  function computeElevationFromBuffer(
    buffer: ArrayBuffer,
    lat: number,
    lon: number
  ): number {
    const latFloor = Math.floor(lat);
    const lonFloor = Math.floor(lon);
    const samples = Math.sqrt(buffer.byteLength / 2);
    if (!Number.isInteger(samples)) {
      throw new Error(`Unsupported HGT size: ${buffer.byteLength} bytes`);
    }
    const dataView = new DataView(buffer);
    const latOffset = lat - latFloor;
    const lonOffset = lon - lonFloor;
    const row = (1 - latOffset) * (samples - 1);
    const col = lonOffset * (samples - 1);
    const i1 = Math.min(Math.floor(row), samples - 2);
    const j1 = Math.min(Math.floor(col), samples - 2);
    const i2 = i1 + 1;
    const j2 = j1 + 1;
    const fx = col - j1;
    const fy = row - i1;
    function getSample(i: number, j: number): number {
      const index = i * samples + j;
      return dataView.getInt16(index * 2, false);
    }
    const q11 = getSample(i1, j1);
    const q21 = getSample(i1, j2);
    const q12 = getSample(i2, j1);
    const q22 = getSample(i2, j2);
    const interp =
      (1 - fx) * (1 - fy) * q11 +
      fx * (1 - fy) * q21 +
      (1 - fx) * fy * q12 +
      fx * fy * q22;
    return Math.round(interp * 100) / 100;
  }

  async function getElevationAtCoordinates(
    lat: number,
    lon: number,
    backend: any
  ): Promise<number | null> {
    if (isNaN(lat) || isNaN(lon)) {
      return null;
    }
    const latFloor = Math.floor(lat);
    const lonFloor = Math.floor(lon);
    const latPrefix = latFloor >= 0 ? 'N' : 'S';
    const lonPrefix = lonFloor >= 0 ? 'E' : 'W';
    const latDeg = Math.abs(latFloor).toString().padStart(2, '0');
    const lonDeg = Math.abs(lonFloor).toString().padStart(3, '0');
    const tileName = `${latPrefix}${latDeg}${lonPrefix}${lonDeg}.hgt`;
    const filePath = `SRTM/${latPrefix}${latDeg}/${tileName}`;
    try {
      const urlResult = await getUrl({
        path: filePath,
        options: {
          bucket: {
            bucketName: backend.custom.generalBucketName,
            region: 'eu-west-1',
          },
        },
      });
      const response = await fetch(urlResult.url.toString());
      const buffer = await response.arrayBuffer();
      const elevation = computeElevationFromBuffer(buffer, lat, lon);
      return elevation;
    } catch (error) {
      console.warn(`Failed to get elevation for ${lat}, ${lon}:`, error);
      return null;
    }
  }

  async function interpolateGpsDataFromCsv() {
    const projectId = prompt('Enter the projectId for the survey');
    if (!projectId) {
      return;
    }

    const dryRun = confirm('Dry run? OK = Yes (no updates), Cancel = No');

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';

    input.onchange = async () => {
      const files = input.files;
      if (!files || files.length === 0) {
        alert('No file selected.');
        return;
      }

      try {
        // Load all images for the project
        const images = await fetchAllPaginatedResults(
          client.models.Image.imagesByProjectId,
          {
            projectId,
            selectionSet: ['id', 'timestamp', 'latitude', 'longitude'] as const,
            limit: 1000,
          }
        );

        console.log(`Found ${images.length} images for project ${projectId}`);
        if (dryRun) {
          console.log('DRY RUN MODE - No images will be updated');
        }

        // Parse CSV file
        const file = files[0];
        const text = await file.text();
        const parsed = Papa.parse(text, {
          header: true,
          skipEmptyLines: true,
        });

        // Extract CSV data - expect columns: Timestamp, Latitude, Longitude, AGL
        const csvData = (parsed.data as any[])
          .map((row) => {
            const timestamp = Number(row['Timestamp']);
            const lat = Number(row['Latitude']);
            const lng = Number(row['Longitude']);
            const alt = Number(row['AGL']);

            // Validate data
            if (
              !Number.isFinite(timestamp) ||
              !Number.isFinite(lat) ||
              !Number.isFinite(lng) ||
              !Number.isFinite(alt) ||
              lat < -90 ||
              lat > 90 ||
              lng < -180 ||
              lng > 180
            ) {
              return null;
            }

            return {
              timestamp,
              lat,
              lng,
              alt,
            };
          })
          .filter(
            (
              row
            ): row is {
              timestamp: number;
              lat: number;
              lng: number;
              alt: number;
            } => row !== null
          )
          .sort((a, b) => a.timestamp - b.timestamp);

        console.log(`Parsed ${csvData.length} GPS data points from CSV`);

        if (csvData.length === 0) {
          alert('No valid GPS data found in CSV. Check the column names.');
          return;
        }

        // Interpolation function (same as in FilesUploadComponent)
        const interpolateGpsData = (
          csvData: {
            timestamp: number;
            lat: number;
            lng: number;
            alt: number;
          }[],
          queryTimestamp: number
        ) => {
          if (csvData.length === 0) {
            throw new Error('No GPS data available for interpolation.');
          }

          const sortedCsvData = csvData.sort(
            (a, b) => a.timestamp - b.timestamp
          );

          let low = 0;
          let high = sortedCsvData.length - 1;

          while (low <= high) {
            const mid = Math.floor((low + high) / 2);
            const midData = sortedCsvData[mid];

            if (midData.timestamp === queryTimestamp) {
              return midData;
            } else if (midData.timestamp < queryTimestamp) {
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }

          // If we exit the loop without finding an exact match, interpolate
          if (
            low > 0 &&
            sortedCsvData[low - 1].timestamp < queryTimestamp &&
            sortedCsvData[low].timestamp > queryTimestamp
          ) {
            const prevData = sortedCsvData[low - 1];
            const nextData = sortedCsvData[low];
            const gap = nextData.timestamp - prevData.timestamp;
            const pos = (queryTimestamp - prevData.timestamp) / gap;
            const latitude = prevData.lat * (1 - pos) + nextData.lat * pos;
            const longitude = prevData.lng * (1 - pos) + nextData.lng * pos;
            const altitude = prevData.alt * (1 - pos) + nextData.alt * pos;
            return {
              timestamp: queryTimestamp,
              lat: latitude,
              lng: longitude,
              alt: altitude,
            };
          } else {
            throw new Error(
              'Extrapolation required for GPS data interpolation.'
            );
          }
        };

        // Process each image and interpolate GPS data
        let updated = 0;
        let skipped = 0;
        let alreadyHasGps = 0;

        for (const image of images) {
          try {
            // Convert image timestamp from seconds to milliseconds if needed
            const imageTimestamp = image.timestamp || 0;

            // Check if image already has GPS data
            if (image.latitude && image.longitude) {
              alreadyHasGps++;
              if (dryRun) {
                console.log(`Image ${image.id} already has GPS data (skip)`);
              }
              continue;
            }

            // Interpolate GPS data
            const gpsData = interpolateGpsData(csvData, imageTimestamp);

            if (!dryRun) {
              // Update the image
              await client.models.Image.update({
                id: image.id,
                latitude: gpsData.lat,
                longitude: gpsData.lng,
                altitude_agl: gpsData.alt,
              });
            }

            updated++;
            const action = dryRun ? 'Would update' : 'Updated';
            console.log(
              `${action} image ${image.id}: lat=${gpsData.lat}, lng=${gpsData.lng}, alt=${gpsData.alt}`
            );
          } catch (error) {
            console.warn(
              `Failed to interpolate GPS for image ${image.id}:`,
              error
            );
            skipped++;
          }
        }

        const mode = dryRun ? 'DRY RUN - ' : '';
        const verb = dryRun ? 'would be updated' : 'updated';
        alert(
          `${mode}GPS interpolation complete:\n- ${verb}: ${updated}\n- Already had GPS: ${alreadyHasGps}\n- Skipped (outside range): ${skipped}`
        );
      } catch (error) {
        console.error('Failed to interpolate GPS data:', error);
        alert('Failed to interpolate GPS data. See console for details.');
      }
    };

    input.click();
  }

  async function transformCsvToTimestampedAgl() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';

    input.onchange = async () => {
      const files = input.files;
      if (!files || files.length === 0) {
        alert('No file selected.');
        return;
      }

      try {
        const file = files[0];
        console.log('Processing CSV file:', file.name);

        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            const data = results.data as any[];
            console.log(`Parsed ${data.length} rows`);

            // Find required columns (case-insensitive)
            const dateCol = Object.keys(data[0] || {}).find(
              (k) => k.toLowerCase() === 'date'
            );
            const timeCol = Object.keys(data[0] || {}).find(
              (k) => k.toLowerCase() === 'time'
            );
            const latCol = Object.keys(data[0] || {}).find((k) =>
              k.toLowerCase().includes('lat')
            );
            const lonCol = Object.keys(data[0] || {}).find((k) =>
              k.toLowerCase().includes('lon')
            );
            const altCol = Object.keys(data[0] || {}).find((k) =>
              k.toLowerCase().includes('alt')
            );

            if (!dateCol || !timeCol || !latCol || !lonCol || !altCol) {
              alert(
                `Missing required columns. Found: Date=${!!dateCol}, Time=${!!timeCol}, Lat=${!!latCol}, Lon=${!!lonCol}, Alt=${!!altCol}`
              );
              return;
            }

            console.log('Column mapping:', {
              dateCol,
              timeCol,
              latCol,
              lonCol,
              altCol,
            });

            const outputData: Array<{
              Timestamp: number;
              Latitude: number;
              Longitude: number;
              AGL: number;
            }> = [];

            let processed = 0;
            const total = data.length;

            for (const row of data) {
              try {
                const dateStr = row[dateCol];
                const timeStr = row[timeCol];
                const lat = parseFloat(row[latCol]);
                const lon = parseFloat(row[lonCol]);
                const alt = parseFloat(row[altCol]);

                if (
                  !dateStr ||
                  !timeStr ||
                  isNaN(lat) ||
                  isNaN(lon) ||
                  isNaN(alt)
                ) {
                  console.warn('Skipping row with invalid data:', row);
                  continue;
                }

                // Parse date (MM/DD/YYYY)
                const [month, day, year] = dateStr.split('/').map(Number);
                if (!month || !day || !year) {
                  console.warn('Invalid date format:', dateStr);
                  continue;
                }

                // Parse time (HH:MM:SS.mmm)
                const timeParts = timeStr.split(':');
                const hours = parseInt(timeParts[0] || '0');
                const minutes = parseInt(timeParts[1] || '0');
                const secondsParts = (timeParts[2] || '0').split('.');
                const seconds = parseInt(secondsParts[0] || '0');
                const millis = parseInt(secondsParts[1] || '0');

                // Create UTC timestamp (assumes GMT as specified)
                const date = new Date(
                  Date.UTC(
                    year,
                    month - 1,
                    day,
                    hours,
                    minutes,
                    seconds,
                    millis
                  )
                );
                const timestamp = Math.floor(date.getTime() / 1000);

                // Get elevation and calculate AGL
                let agl = alt;
                const elevation = await getElevationAtCoordinates(
                  lat,
                  lon,
                  backend
                );
                if (elevation !== null && elevation > 0) {
                  agl = alt - elevation;
                }

                outputData.push({
                  Timestamp: timestamp,
                  Latitude: lat,
                  Longitude: lon,
                  AGL: agl,
                });

                processed++;
                if (processed % 10 === 0) {
                  console.log(`Processed ${processed}/${total} rows...`);
                }
              } catch (e) {
                console.warn('Error processing row:', e, row);
              }
            }

            console.log('Processing complete. Exporting CSV...');

            // Export to CSV
            const csv = Papa.unparse(outputData);
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            a.download = `transformed-gps-data-${timestamp}.csv`;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 1000);

            alert(
              `Transformation complete. Exported ${outputData.length} rows to CSV.`
            );
          },
        });
      } catch (error) {
        console.error('Failed to transform CSV:', error);
        alert('Failed to transform CSV. See console for details.');
      }
    };

    input.click();
  }

  async function updateImageGpsFromCsvById() {
    const confirmProceed = confirm(
      'Select a CSV with columns: id, path, latitude, longitude, altitude (ASL).\nThis will update images by id with latitude, longitude and altitude_agl.'
    );
    if (!confirmProceed) return;

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';

    input.onchange = async () => {
      const files = input.files;
      if (!files || files.length === 0) {
        alert('No file selected.');
        return;
      }

      try {
        const file = files[0];
        console.log('Processing GPS CSV file:', file.name);

        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            const rows = (results.data as any[]) || [];
            if (rows.length === 0) {
              alert('CSV appears empty.');
              return;
            }

            // Normalize header keys (case-insensitive)
            const normalizeKey = (obj: any) => {
              const out: any = {};
              for (const k of Object.keys(obj || {}))
                out[k.toLowerCase()] = obj[k];
              return out;
            };

            // Validate at least the required columns exist in the first row
            const sample = normalizeKey(rows[0]);
            const required = ['id', 'latitude', 'longitude', 'altitude'];
            const missing = required.filter((k) => !(k in sample));
            if (missing.length) {
              alert(
                `Missing required column(s): ${missing.join(
                  ', '
                )}. Required: id, latitude, longitude, altitude`
              );
              return;
            }

            let success = 0;
            let skipped = 0;
            let failed = 0;

            // Cap concurrency to avoid overwhelming backend
            const tasks: Array<() => Promise<void>> = [];
            for (const raw of rows) {
              const row = normalizeKey(raw);
              const id = String(row['id'] || '').trim();
              const lat = Number(row['latitude']);
              const lon = Number(row['longitude']);
              const altAsl = Number(row['altitude']); // altitude above sea level

              if (
                !id ||
                !Number.isFinite(lat) ||
                !Number.isFinite(lon) ||
                !Number.isFinite(altAsl)
              ) {
                skipped += 1;
                continue;
              }

              tasks.push(async () => {
                try {
                  const elevation = await getElevationAtCoordinates(
                    lat,
                    lon,
                    backend
                  );
                  let agl = altAsl;
                  if (elevation !== null && elevation > 0)
                    agl = altAsl - elevation;

                  await (client as any).models.Image.update({
                    id,
                    latitude: lat,
                    longitude: lon,
                    altitude_agl: agl,
                  });
                  success += 1;
                } catch (e) {
                  console.warn(
                    'Failed to update image from CSV row',
                    { id, lat, lon, altAsl },
                    e
                  );
                  failed += 1;
                }
              });
            }

            // Run with limited concurrency
            const concurrency = 10;
            let next = 0;
            const workers = Array.from(
              { length: Math.min(concurrency, tasks.length || 1) },
              async () => {
                while (next < tasks.length) {
                  const i = next++;
                  await tasks[i]();
                }
              }
            );
            await Promise.all(workers);

            console.log('GPS CSV update complete', {
              success,
              skipped,
              failed,
            });
            alert(
              `Updated: ${success}. Skipped (invalid rows): ${skipped}. Failed: ${failed}.`
            );
          },
          error: (err) => {
            console.error('CSV parse error', err);
            alert('Failed to parse CSV. See console for details.');
          },
        });
      } catch (error) {
        console.error('Failed to process CSV:', error);
        alert('Failed to process CSV. See console for details.');
      }
    };

    input.click();
  }

  async function countLocationsByConfidence() {
    const setId = prompt('Enter the location set ID');
    if (!setId) {
      return;
    }

    const confidenceThresholdStr = prompt(
      'Enter the minimum confidence threshold (0.0 to 1.0)'
    );
    if (!confidenceThresholdStr) {
      return;
    }

    const confidenceThreshold = parseFloat(confidenceThresholdStr);
    if (
      isNaN(confidenceThreshold) ||
      confidenceThreshold < 0 ||
      confidenceThreshold > 1
    ) {
      alert('Please enter a valid confidence threshold between 0.0 and 1.0');
      return;
    }

    try {
      console.log(
        `Fetching locations from set ${setId} with confidence >= ${confidenceThreshold}`
      );

      // Fetch all locations for the set
      const locations = await fetchAllPaginatedResults(
        client.models.Location.locationsBySetIdAndConfidence,
        {
          setId: setId,
          selectionSet: [
            'id',
            'confidence',
            'x',
            'y',
            'width',
            'height',
            'source',
          ] as const,
          limit: 1000,
        }
      );

      // Filter locations by confidence threshold
      const filteredLocations = locations.filter(
        (location) =>
          location.confidence !== null &&
          location.confidence >= confidenceThreshold
      );

      console.log(`Total locations in set: ${locations.length}`);
      console.log(
        `Locations with confidence >= ${confidenceThreshold}: ${filteredLocations.length}`
      );

      // Log some statistics
      const confidenceStats = locations.reduce(
        (stats, loc) => {
          if (loc.confidence !== null) {
            stats.total++;
            stats.sum += loc.confidence;
            if (loc.confidence >= confidenceThreshold) {
              stats.aboveThreshold++;
            }
          }
          return stats;
        },
        { total: 0, sum: 0, aboveThreshold: 0 }
      );

      if (confidenceStats.total > 0) {
        const avgConfidence = confidenceStats.sum / confidenceStats.total;
        console.log(`Average confidence: ${avgConfidence.toFixed(3)}`);
        console.log(
          `Percentage above threshold: ${(
            (confidenceStats.aboveThreshold / confidenceStats.total) *
            100
          ).toFixed(1)}%`
        );
      }

      alert(
        `Found ${filteredLocations.length} locations with confidence >= ${confidenceThreshold} out of ${locations.length} total locations in the set.`
      );
    } catch (error) {
      console.error('Error counting locations:', error);
      alert('Failed to count locations. See console for details.');
    }
  }

  async function exportLocationsBySource() {
    const projectId = prompt('Enter the project ID');

    if (!projectId) {
      alert('Please select a project first');
      return;
    }

    const { data: project } = await client.models.Project.get({
      id: projectId,
      selectionSet: ['id', 'name'] as const,
    });

    try {
      console.log('Fetching all locations for project...');

      // Fetch all locations for the project
      const allLocations = await fetchAllPaginatedResults(
        client.models.Location.locationsByProjectIdAndSource,
        {
          projectId: projectId,
          selectionSet: [
            // 'id',
            'image.originalPath',
            // 'setId',
            'x',
            'y',
            'width',
            'height',
            'source',
            'confidence',
          ],
          limit: 1000,
        }
      );

      console.log(`Found ${allLocations.length} total locations`);

      // Get unique sources
      const uniqueSources = [...new Set(allLocations.map((loc) => loc.source))];
      console.log('Available sources:', uniqueSources);

      // Prompt user for source selection
      const selectedSource = prompt(
        `Available sources: ${uniqueSources.join(
          ', '
        )}\n\nEnter the source to filter by:`
      );

      if (!selectedSource) {
        console.log('No source selected, cancelling export');
        return;
      }

      // Filter locations by selected source
      const filteredLocations = allLocations.filter(
        (loc) => loc.source === selectedSource
      );

      console.log(
        `Found ${filteredLocations.length} locations with source "${selectedSource}"`
      );

      if (filteredLocations.length === 0) {
        alert(`No locations found with source "${selectedSource}"`);
        return;
      }

      // Prepare data for CSV export
      const csvData = filteredLocations.map((location) => ({
        // id: location.id,
        // imageId: location.imageId,
        image: location.image.originalPath,
        // setId: location.setId,
        x: location.x,
        y: location.y,
        width: location.width,
        height: location.height,
        source: location.source,
        confidence: location.confidence,
      }));

      // Export to CSV
      const safeProjectId = projectId.replace(/[^a-zA-Z0-9_-]+/g, '-');
      const safeSource = selectedSource.replace(/[^a-zA-Z0-9_-]+/g, '-');
      const fileName = `${project.name
        .split(' ')
        .join('_')}_${selectedSource}_export`;

      exportFromJSON({
        data: csvData,
        fileName: fileName,
        exportType: exportFromJSON.types.csv,
      });

      console.log(
        `Exported ${filteredLocations.length} locations to ${fileName}.csv`
      );
      alert(
        `Successfully exported ${filteredLocations.length} locations with source "${selectedSource}" to ${fileName}.csv`
      );
    } catch (error) {
      console.error('Error exporting locations:', error);
      alert('Failed to export locations. See console for details.');
    }
  }

  async function exportPathsOfImagesWithNoGPSdata() {
    const projectId = prompt('Enter the project ID');
    if (!projectId) {
      alert('Please select a project first');
      return;
    }

    const { data: project } = await client.models.Project.get({
      id: projectId,
      selectionSet: ['id', 'name', 'organizationId', 'tags'] as const,
    });

    const images = await fetchAllPaginatedResults(
      client.models.Image.imagesByProjectId,
      {
        projectId: projectId,
        selectionSet: ['id', 'originalPath', 'latitude', 'longitude'] as const,
        limit: 1000,
      }
    );

    const imagesWithNoGPSdata = images.filter(
      (image) => image.latitude === null || image.longitude === null
    );

    console.log(`Found ${imagesWithNoGPSdata.length} images with no GPS data`);

    const isLegacyProject =
      Array.isArray(project.tags) && project.tags.includes('legacy');
    const organizationId = project.organizationId;

    const makeKey = (orig: string): string =>
      !isLegacyProject && organizationId
        ? `${organizationId}/${projectId}/${orig}`
        : orig;

    const csvData = imagesWithNoGPSdata.map((image) => ({
      id: image.id,
      path: makeKey(image.originalPath),
    }));

    exportFromJSON({
      data: csvData,
      fileName: `images-with-no-gps-data-${projectId}.csv`,
      exportType: exportFromJSON.types.csv,
    });

    alert(
      `Successfully exported ${imagesWithNoGPSdata.length} images with no GPS data to images-with-no-gps-data-${projectId}.csv`
    );
  }

  async function deleteImageAndAssociatedData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';

    input.onchange = async () => {
      const files = input.files;
      if (!files || files.length === 0) {
        alert('No file selected.');
        return;
      }

      try {
        const file = files[0];
        console.log('Processing CSV file:', file.name);

        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            const rows = (results.data as any[]) || [];
            if (rows.length === 0) {
              alert('CSV appears empty.');
              return;
            }

            // Normalize header keys (case-insensitive)
            const normalizeKey = (obj: any) => {
              const out: any = {};
              for (const k of Object.keys(obj || {}))
                out[k.toLowerCase()] = obj[k];
              return out;
            };

            // Extract imageIds from CSV
            const imageIds = rows
              .map((row) => {
                const normalized = normalizeKey(row);
                return String(normalized['imageid'] || '').trim();
              })
              .filter((id) => id.length > 0);

            if (imageIds.length === 0) {
              alert(
                'No valid imageIds found in CSV. Make sure the column is named "imageId".'
              );
              return;
            }

            const proceed = confirm(
              `Found ${imageIds.length} imageId(s) in CSV.\n\n` +
                `This will delete all associated data (ImageFiles, Locations, ImageSetMemberships, ImageNeighbours) and then the Images themselves.\n\n` +
                `Proceed?`
            );
            if (!proceed) return;

            const totalCounts = {
              imageFilesDeleted: 0,
              locationsDeleted: 0,
              membershipsDeleted: 0,
              neighboursDeleted: 0,
              imagesDeleted: 0,
              imagesNotFound: 0,
              failures: 0,
            };

            console.group(
              `Deleting ${imageIds.length} images and associated data`
            );

            // Process each imageId
            for (let idx = 0; idx < imageIds.length; idx++) {
              const imageId = imageIds[idx];
              console.log(
                `Processing image ${idx + 1}/${imageIds.length}: ${imageId}`
              );

              try {
                // Fetch the image to verify it exists
                const { data: image } = await (client as any).models.Image.get({
                  id: imageId,
                  selectionSet: ['id', 'originalPath', 'projectId'] as const,
                });

                if (!image) {
                  console.warn(`Image ${imageId} not found`);
                  totalCounts.imagesNotFound += 1;
                  continue;
                }

                const counts = {
                  imageFilesDeleted: 0,
                  locationsDeleted: 0,
                  membershipsDeleted: 0,
                  neighboursDeleted: 0,
                  failures: 0,
                };

                // Delete ImageFile records
                try {
                  const filesResp = await (
                    client as any
                  ).models.ImageFile.imagesByimageId({
                    imageId,
                    selectionSet: ['id'] as const,
                    limit: 1000,
                  });
                  const files = (filesResp?.data || []) as Array<{
                    id: string;
                  }>;
                  await Promise.all(
                    files.map(async (f) => {
                      try {
                        await (client as any).models.ImageFile.delete({
                          id: f.id,
                        });
                        counts.imageFilesDeleted += 1;
                      } catch (e) {
                        counts.failures += 1;
                        console.warn('Failed to delete ImageFile', f.id, e);
                      }
                    })
                  );
                } catch (e) {
                  counts.failures += 1;
                  console.warn('Failed to delete ImageFile records', e);
                }

                // Delete Location records
                try {
                  const locations = (await (fetchAllPaginatedResults as any)(
                    (client as any).models.Location.locationsByImageKey,
                    {
                      imageId,
                      selectionSet: ['id'] as const,
                      limit: 1000,
                    }
                  )) as Array<{ id: string }>;
                  await Promise.all(
                    locations.map(async (loc) => {
                      try {
                        await (client as any).models.Location.delete({
                          id: loc.id,
                        });
                        counts.locationsDeleted += 1;
                      } catch (e) {
                        counts.failures += 1;
                        console.warn('Failed to delete Location', loc.id, e);
                      }
                    })
                  );
                } catch (e) {
                  counts.failures += 1;
                  console.warn('Failed to delete Location records', e);
                }

                // Delete ImageSetMembership records
                try {
                  const membershipsResp = await (
                    client as any
                  ).models.ImageSetMembership.list({
                    filter: { imageId: { eq: imageId } },
                    selectionSet: ['id'] as const,
                    limit: 1000,
                  });
                  const memberships = (membershipsResp?.data || []) as Array<{
                    id: string;
                  }>;
                  await Promise.all(
                    memberships.map(async (m) => {
                      try {
                        await (client as any).models.ImageSetMembership.delete({
                          id: m.id,
                        });
                        counts.membershipsDeleted += 1;
                      } catch (e) {
                        counts.failures += 1;
                        console.warn(
                          'Failed to delete ImageSetMembership',
                          m.id,
                          e
                        );
                      }
                    })
                  );
                } catch (e) {
                  counts.failures += 1;
                  console.warn(
                    'Failed to delete ImageSetMembership records',
                    e
                  );
                }

                // Delete ImageNeighbour records where this image is image1Id or image2Id
                try {
                  // Get neighbours where image is image1Id
                  const leftNeighboursResp = await (
                    client as any
                  ).models.ImageNeighbour.imageNeighboursByImage1key({
                    image1Id: imageId,
                    selectionSet: ['image1Id', 'image2Id'] as const,
                    limit: 1000,
                  });
                  const leftNeighbours = (leftNeighboursResp?.data ||
                    []) as Array<{
                    image1Id: string;
                    image2Id: string;
                  }>;

                  // Get neighbours where image is image2Id
                  const rightNeighboursResp = await (
                    client as any
                  ).models.ImageNeighbour.imageNeighboursByImage2key({
                    image2Id: imageId,
                    selectionSet: ['image1Id', 'image2Id'] as const,
                    limit: 1000,
                  });
                  const rightNeighbours = (rightNeighboursResp?.data ||
                    []) as Array<{
                    image1Id: string;
                    image2Id: string;
                  }>;

                  const allNeighbours = [...leftNeighbours, ...rightNeighbours];
                  await Promise.all(
                    allNeighbours.map(async (n) => {
                      try {
                        await (client as any).models.ImageNeighbour.delete({
                          image1Id: n.image1Id,
                          image2Id: n.image2Id,
                        });
                        counts.neighboursDeleted += 1;
                      } catch (e) {
                        counts.failures += 1;
                        console.warn(
                          'Failed to delete ImageNeighbour',
                          { image1Id: n.image1Id, image2Id: n.image2Id },
                          e
                        );
                      }
                    })
                  );
                } catch (e) {
                  counts.failures += 1;
                  console.warn('Failed to delete ImageNeighbour records', e);
                }

                // Finally, delete the Image itself
                try {
                  await (client as any).models.Image.delete({ id: imageId });
                  totalCounts.imagesDeleted += 1;
                } catch (e) {
                  counts.failures += 1;
                  console.warn('Failed to delete Image', imageId, e);
                }

                // Accumulate counts
                totalCounts.imageFilesDeleted += counts.imageFilesDeleted;
                totalCounts.locationsDeleted += counts.locationsDeleted;
                totalCounts.membershipsDeleted += counts.membershipsDeleted;
                totalCounts.neighboursDeleted += counts.neighboursDeleted;
                totalCounts.failures += counts.failures;
              } catch (e) {
                console.error(`Failed to process image ${imageId}`, e);
                totalCounts.failures += 1;
              }
            }

            console.groupEnd();
            console.group('Delete Images Summary');
            console.table(totalCounts as any);
            console.groupEnd();

            alert(
              `Batch deletion complete:\n` +
                `Total images processed: ${imageIds.length}\n` +
                `Images deleted: ${totalCounts.imagesDeleted}\n` +
                `Images not found: ${totalCounts.imagesNotFound}\n` +
                `ImageFiles deleted: ${totalCounts.imageFilesDeleted}\n` +
                `Locations deleted: ${totalCounts.locationsDeleted}\n` +
                `ImageSetMemberships deleted: ${totalCounts.membershipsDeleted}\n` +
                `ImageNeighbours deleted: ${totalCounts.neighboursDeleted}\n` +
                `Total failures: ${totalCounts.failures}\n\n` +
                `See console for details.`
            );
          },
          error: (err) => {
            console.error('CSV parse error', err);
            alert('Failed to parse CSV. See console for details.');
          },
        });
      } catch (error) {
        console.error('Failed to process CSV:', error);
        alert('Failed to process CSV. See console for details.');
      }
    };

    input.click();
  }

  async function returnImageKeysFromCsv() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';

    input.onchange = async () => {
      const files = input.files;
      if (!files || files.length === 0) {
        alert('No file selected.');
        return;
      }

      const file = files[0];
      console.log('Processing CSV file:', file.name);

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows = Array.isArray(results.data)
            ? (results.data as Record<string, unknown>[])
            : [];
          if (!rows.length) {
            alert('CSV appears empty.');
            return;
          }

          const strippedKeys = rows
            .map((row) => {
              if (!row || typeof row !== 'object') return null;
              const rawKey = (row as Record<string, unknown>)['key'];
              if (typeof rawKey !== 'string') return null;
              const trimmedKey = rawKey.trim();
              if (!trimmedKey) return null;
              const parts = trimmedKey.split('/');
              if (parts.length < 3) return trimmedKey;
              return parts.slice(3).join('/');
            })
            .filter((value): value is string => Boolean(value));

          if (!strippedKeys.length) {
            alert('No keys found in CSV.');
            return;
          }

          const csvHeader = 'key';
          const csvBody = strippedKeys
            .map((key) => `"${key.replace(/"/g, '""')}"`)
            .join('\r\n');
          const csvContent = `${csvHeader}\r\n${csvBody}`;

          const blob = new Blob([csvContent], {
            type: 'text/csv;charset=utf-8;',
          });
          const url = window.URL.createObjectURL(blob);

          const link = document.createElement('a');
          link.href = url;
          link.download = 'imageKeys.csv';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        },
        error: (error) => {
          console.error('Failed to parse CSV file', error);
          alert('Failed to parse CSV file.');
        },
      });
    };

    input.click();
  }

  return (
    <div className='d-flex flex-column gap-2'>
      <h2>Dev Actions</h2>
      {/* <UserStats/>
        <Button onClick={deleteOrphans}>Delete orphanned files from S3.</Button>
        <Button onClick={deleteImages}>Delete Image Records with no associated ImageFiles.</Button>
        <Button onClick={findImages}>Find Images without GeoData.</Button>
        <Button onClick={() => updateStats(createInput())}>Simulate UserStat update.</Button>
        <Button onClick={recomputeUserStats}>Recompute UserStats</Button>
        <Button onClick={createUserStatsTable}>Create UserStats Table</Button>
        <Button onClick={deleteImageNeighbours}>Delete ImageNeighbours Entries</Button>
        <Button onClick={backfillObjectID}>Backfill ObjectID data</Button> */}
      <Button onClick={returnImageKeysFromCsv}>
        Return Image Keys from CSV
      </Button>
      <Button onClick={exportPathsOfImagesWithNoGPSdata}>
        Export Paths of Images With No GPS Data
      </Button>
      <Button onClick={listOrganizationUsers}>List Organization Users</Button>
      <Button onClick={logSurveyImages}>Log Survey Images</Button>
      <Button onClick={exportAnnotationSetResults}>Export Data</Button>
      <Button onClick={updateProjectwithTestPresets}>
        Update Project with Test Presets
      </Button>
      <Button onClick={summarizeCameraOverlaps}>
        Summarize Camera Overlaps
      </Button>
      <Button onClick={getNeighboursWithoutHomography}>
        Get Neighbours Without Homography
      </Button>
      <Button onClick={logImagesWithoutCameraId}>
        Log Images Without CameraId
      </Button>
      <Button onClick={linkImagesToCamera}>Link Images to Camera</Button>
      <Button onClick={getCrossCameraNeighboursWithoutHomography}>
        Cross-Camera Neighbours Without Homography
      </Button>
      <Button onClick={summarizeCrossCameraNeighbourHomographies}>
        Summarize Cross-Camera Homographies
      </Button>
      <Button onClick={summarizeCameraTimestampRanges}>
        Camera Timestamp Ranges
      </Button>
      <Button onClick={adjustCameraTimestamps}>Adjust Camera Timestamps</Button>
      <Button onClick={listNeighboursWithNullHomography}>
        List Neighbours With Null Homography
      </Button>
      <Button onClick={listImageNeighbours}>
        List Images Without Neighbours
      </Button>
      <Button onClick={removeCameraWithChecks}>Remove Camera (safe)</Button>
      <Button onClick={registerOverlapKInterval}>
        Register Overlap K-Interval
      </Button>
      <Button onClick={runImageRegistration}>Run Image Registration</Button>
      <Button onClick={batchRunImageRegistrationForProject}>
        Batch Run Image Registration (by Project)
      </Button>
      <Button onClick={updateImageSetImageCount}>
        Update Image Set Image Count
      </Button>
      <Button onClick={createMissingImageFiles}>
        Create Missing ImageFile Records
      </Button>
      <Button onClick={deleteDuplicateLocations}>
        Delete Duplicate Locations
      </Button>
      <Button onClick={countLocationsByConfidence}>
        Count Locations by Confidence
      </Button>
      <Button onClick={exportLocationsBySource}>
        Export Locations by Source
      </Button>
      <Button onClick={deleteDuplicateImages}>Delete Duplicate Images</Button>
      <Button onClick={deleteImagesByOriginalPathPhrase}>
        Delete Images by Path Phrase
      </Button>
      <Button variant='danger' onClick={deleteImageAndAssociatedData}>
        Delete Image and All Associated Data
      </Button>
      <Button onClick={openImageLocations}>View Image Locations</Button>
      <Button onClick={updateProjectTags}>Update Project Tags</Button>
      <Button onClick={removeLoctionsForProject}>
        Remove Loctions For Project
      </Button>
      <Button onClick={setProjectStatus}>Set Project Status</Button>
      <Button onClick={testUpstreamConcurrency}>
        Test Client Concurrency (images)
      </Button>
      <Button onClick={inspectTwoImagesExif}>Inspect EXIF for 2 Images</Button>
      <Button onClick={promptDrainQueue}>Drain Queue</Button>
      <Button onClick={exportQueueMessagesAsJSON}>
        Export Queue Messages (JSON)
      </Button>
      <Button onClick={summarizeExportedQueueFile}>
        Summarize Export JSON (by Org/Project)
      </Button>
      <Button onClick={exportImageIdsAndKeysFromQueueJson}>
        Export Image IDs & Keys from Queue JSON
      </Button>
      <Button onClick={deleteCrossCameraNeighbours}>
        Delete Cross-Camera Neighbours
      </Button>
      <Button onClick={countProjectImages}>Count project images</Button>
      <Button onClick={transformCsvToTimestampedAgl}>
        Transform CSV to Timestamped AGL
      </Button>
      <Button onClick={interpolateGpsDataFromCsv}>
        Interpolate GPS Data from CSV
      </Button>
      <Button onClick={updateImageGpsFromCsvById}>
        Import GPS by ID (CSV)
      </Button>
      <Button variant='danger' onClick={deleteProjectReplicated}>
        Delete Project (replicated)
      </Button>

      {concurrencyTest.running ? (
        <div className='d-flex align-items-center gap-2'>
          <Spinner size='sm' />
          <span>
            Concurrency test: {concurrencyTest.completed}/
            {concurrencyTest.total}
            {concurrencyTest.errors
              ? ` (errors: ${concurrencyTest.errors})`
              : ''}
            . Check console for per-request timings. Upstream limit is 15.
          </span>
        </div>
      ) : concurrencyTest.total > 0 ? (
        <div>
          Concurrency test complete: {concurrencyTest.completed}/
          {concurrencyTest.total}
          {concurrencyTest.errors ? ` (errors: ${concurrencyTest.errors})` : ''}
        </div>
      ) : null}

      <Modal
        show={!!imageModalId}
        onHide={() => {
          setImageModalId(null);
          setImageModalAnnotationSetId(null);
        }}
        size='xl'
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>Image Locations</Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ height: '80vh' }}>
          {imageModalId ? (
            <ImageLocationsMap
              imageId={imageModalId}
              annotationSetId={imageModalAnnotationSetId || undefined}
            />
          ) : (
            <div className='w-100 h-100 d-flex align-items-center justify-content-center'>
              <Spinner size='sm' />
              <span className='ms-2'>Loading...</span>
            </div>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}

type LocationItem = {
  id: string;
  x: number;
  y: number;
  width?: number | null;
  height?: number | null;
  confidence?: number | null;
  setId: string;
  source: string;
};

function ImageLocationsMap({
  imageId,
  annotationSetId,
}: {
  imageId: string;
  annotationSetId?: string;
}) {
  const { client } = useContext(GlobalContext)!;
  const [imageMeta, setImageMeta] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [sourceKey, setSourceKey] = useState<string | null>(null);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loaded, setLoaded] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoaded(false);
      // Load image metadata
      const { data: image } = await (client as any).models.Image.get({
        id: imageId,
        selectionSet: ['id', 'width', 'height', 'originalPath'] as const,
      });
      if (!image || cancelled) return;
      setImageMeta({
        width: image.width as number,
        height: image.height as number,
      });

      // Load source key for slippy map tiles
      const filesResp = await (client as any).models.ImageFile.imagesByimageId({
        imageId,
        selectionSet: ['id', 'type', 'key'] as const,
      });
      const files = (filesResp.data || []) as Array<{
        id: string;
        type: string;
        key: string;
      }>;
      const jpeg = files.find((f) => f.type === 'image/jpeg') || files[0];
      setSourceKey(jpeg?.key || null);

      // Load locations for the image
      const locs = (await (fetchAllPaginatedResults as any)(
        (client as any).models.Location.locationsByImageKey,
        {
          imageId,
          selectionSet: [
            'id',
            'x',
            'y',
            'width',
            'height',
            'confidence',
            'setId',
            'source',
          ] as const,
          limit: 1000,
        }
      )) as LocationItem[];
      if (cancelled) return;
      const filtered = annotationSetId
        ? (locs || []).filter((l) => l.setId === annotationSetId)
        : locs || [];
      setLocations(filtered);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [client, imageId, annotationSetId]);

  const scale = useMemo(() => {
    if (!imageMeta) return 1;
    return Math.pow(
      2,
      Math.ceil(Math.log2(Math.max(imageMeta.width, imageMeta.height))) - 8
    );
  }, [imageMeta?.width, imageMeta?.height]);

  const xy2latLng = (x: number, y: number) => L.latLng(-y / scale, x / scale);

  const bounds = useMemo(() => {
    if (!imageMeta) return undefined as any;
    const sw = xy2latLng(0, imageMeta.height);
    const ne = xy2latLng(imageMeta.width, 0);
    return L.latLngBounds(sw, ne);
  }, [imageMeta?.width, imageMeta?.height, scale]);

  // Color map per location setId
  const colorMap = useMemo(() => {
    const palette = [
      '#FF5733',
      '#33FF57',
      '#3357FF',
      '#F333FF',
      '#33FFF8',
      '#FFA833',
      '#8B33FF',
      '#FF3380',
      '#33FF8B',
      '#999999',
    ];
    const map = new Map<string, string>();
    let idx = 0;
    for (const loc of locations) {
      if (!map.has(loc.setId)) {
        map.set(loc.setId, palette[idx % palette.length]);
        idx += 1;
      }
    }
    return map;
  }, [locations]);

  // Group locations by set for layer toggling
  const locationsBySet = useMemo(() => {
    const grouped = new Map<string, LocationItem[]>();
    for (const loc of locations) {
      const arr = grouped.get(loc.setId) || [];
      arr.push(loc);
      grouped.set(loc.setId, arr);
    }
    return grouped;
  }, [locations]);

  if (!imageMeta || !sourceKey || !bounds || !loaded)
    return (
      <div className='w-100 h-100 d-flex align-items-center justify-content-center'>
        <Spinner size='sm' />
        <span className='ms-2'>Loading...</span>
      </div>
    );

  return (
    <MapContainer
      style={{ width: '100%', height: '100%' }}
      crs={L.CRS.Simple}
      bounds={bounds as any}
      zoomSnap={1}
      zoomDelta={1}
      keyboardPanDelta={0}
    >
      <LayersControl position='topright'>
        <LayersControl.BaseLayer name='Image' checked>
          <StorageLayer
            source={sourceKey}
            bounds={bounds as any}
            maxNativeZoom={5}
            noWrap={true}
          />
        </LayersControl.BaseLayer>
        {Array.from(locationsBySet.entries()).map(([setId, setLocs]) => (
          <LayersControl.Overlay key={setId} name={`Set ${setId}`} checked>
            <LayerGroup>
              {setLocs.map((loc) => {
                const color = colorMap.get(setId) || '#999999';
                if (
                  loc.width &&
                  loc.height &&
                  loc.width > 0 &&
                  loc.height > 0
                ) {
                  // Treat x,y as CENTER coordinates (consistent with Location.tsx)
                  const x0 = (loc.x as number) - (loc.width as number) / 2;
                  const y0 = (loc.y as number) - (loc.height as number) / 2;
                  const x1 = x0 + (loc.width as number);
                  const y1 = y0 + (loc.height as number);
                  const lat1 = -(y0 / scale);
                  const lat2 = -(y1 / scale);
                  const lng1 = x0 / scale;
                  const lng2 = x1 / scale;
                  if (
                    loc.width &&
                    loc.height &&
                    loc.width > 0 &&
                    loc.height > 0
                  ) {
                    // Treat x,y as CENTER coordinates (consistent with Location.tsx)
                    const x0 = (loc.x as number) - (loc.width as number) / 2;
                    const y0 = (loc.y as number) - (loc.height as number) / 2;
                    const x1 = x0 + (loc.width as number);
                    const y1 = y0 + (loc.height as number);
                    const lat1 = -(y0 / scale);
                    const lat2 = -(y1 / scale);
                    const lng1 = x0 / scale;
                    const lng2 = x1 / scale;
                    const rectBounds: any = [
                      [Math.min(lat1, lat2), Math.min(lng1, lng2)],
                      [Math.max(lat1, lat2), Math.max(lng1, lng2)],
                    ];
                    return (
                      <Rectangle
                        key={loc.id}
                        bounds={rectBounds}
                        pathOptions={{ color, weight: 2, fillOpacity: 0.15 }}
                      >
                        <Popup>
                          <div>
                            <div>
                              <strong>Set:</strong> {setId}
                            </div>
                            <div>
                              <strong>Source:</strong> {loc.source}
                            </div>
                            {typeof loc.confidence === 'number' && (
                              <div>
                                <strong>Confidence:</strong>{' '}
                                {loc.confidence?.toFixed(3)}
                              </div>
                            )}
                          </div>
                        </Popup>
                      </Rectangle>
                    );
                  }
                  return (
                    <CircleMarker
                      key={loc.id}
                      center={xy2latLng(loc.x as number, loc.y as number)}
                      radius={6}
                      pathOptions={{
                        color,
                        fillColor: color,
                        weight: 2,
                        fillOpacity: 0.6,
                      }}
                    >
                      <Popup>
                        <div>
                          <div>
                            <strong>Set:</strong> {setId}
                          </div>
                          <div>
                            <strong>Source:</strong> {loc.source}
                          </div>
                          {typeof loc.confidence === 'number' && (
                            <div>
                              <strong>Confidence:</strong>{' '}
                              {loc.confidence?.toFixed(3)}
                            </div>
                          )}
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                }
              })}
            </LayerGroup>
          </LayersControl.Overlay>
        ))}
      </LayersControl>
    </MapContainer>
  );
}
