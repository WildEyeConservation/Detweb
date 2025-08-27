import localforage from 'localforage';
import { UploadContext, GlobalContext, UserContext } from '../Context';
import { useContext, useEffect, useRef, useState } from 'react';
import { uploadData, list, getUrl } from 'aws-amplify/storage';
import { CreatedImage, ImageData, UploadedFiles } from '../types/ImageData';
import ConfirmationModal from '../ConfirmationModal';
import { fetchAllPaginatedResults } from '../utils';

const fileStore = localforage.createInstance({
  name: 'fileStore',
  storeName: 'files',
});

const fileStoreUploaded = localforage.createInstance({
  name: 'fileStoreUploaded',
  storeName: 'filesUploaded',
});

const createdImagesStore = localforage.createInstance({
  name: 'createdImagesStore',
  storeName: 'createdImages',
});

const metadataStore = localforage.createInstance({
  name: 'metadataStore',
  storeName: 'metadata',
});

export default function UploadManager() {
  const {
    task: {
      projectId,
      files,
      retryDelay,
      resumeId,
      deleteId,
      pauseId,
      fromStaleUpload,
    },
    progress: { isComplete, error },
    setTask,
    setProgress,
  } = useContext(UploadContext)!;
  const { client, backend } = useContext(GlobalContext)!;
  const { myMembershipHook: myProjectsHook } = useContext(UserContext)!;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingResumeProjectIdRef = useRef<{ id: string; name: string } | null>(
    null
  );
  const [projectBackOff, setProjectBackOff] = useState<Record<string, number>>(
    {}
  );
  const [tileBuffers, setTileBuffers] = useState<Record<string, ArrayBuffer>>(
    {}
  );
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] =
    useState(false);
  const [showPauseConfirmationModal, setShowPauseConfirmationModal] =
    useState(false);
  const deletingRef = useRef<boolean>(false);
  const cancelledRef = useRef<boolean>(false);
  const pausedRef = useRef<boolean>(false);

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
    lon: number
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
    let buffer = tileBuffers[tileName];
    if (!buffer) {
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
      buffer = await response.arrayBuffer();
      setTileBuffers((prev) => ({ ...prev, [tileName]: buffer }));
    }
    const elevation = computeElevationFromBuffer(buffer, lat, lon);
    return elevation;
  }

  async function uploadProject() {
    console.log('uploading project', projectId);

    if (retryDelay) {
      // Wait for the calculated delay
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }

    try {
      const {
        data: [imageSet],
      } = await client.models.ImageSet.imageSetsByProjectId({
        projectId: projectId,
      });

      const allImages =
        ((await fileStore.getItem(projectId)) as ImageData[]) ?? [];

      // Fetch cameras for this project and build a name -> id map
      const { data: existingCameras } = await (
        client.models.Camera.camerasByProjectId as any
      )({ projectId });
      const cameraNameToId: Record<string, string> = {};
      (existingCameras || []).forEach((cam: any) => {
        if (cam?.name && cam?.id) cameraNameToId[cam.name] = cam.id;
      });
      const knownCameraNames = Object.keys(cameraNameToId);

      const extractCameraNameFromPath = (path: string): string | null => {
        const parts = path.split('/');
        if (parts.length > 1) parts.pop(); // remove filename
        for (let i = parts.length - 1; i >= 0; i--) {
          const seg = parts[i];
          if (knownCameraNames.includes(seg)) return seg;
        }
        return null;
      };

      // seed uploaded files from S3 and created images from DB
      const s3Files = (await fetchFilesFromS3()) as Set<string>;
      const dbRawImages = (await (fetchAllPaginatedResults as any)(
        client.models.Image.imagesByProjectId,
        {
          projectId,
          selectionSet: ['id', 'originalPath', 'timestamp'],
        }
      )) as { id: string; originalPath: string; timestamp: number }[];

      // track which files are already on S3
      const uploadedFiles = Array.from(s3Files);
      await fileStoreUploaded.setItem(projectId, uploadedFiles);

      // track which images are already created in the DB
      let createdImages: CreatedImage[] = dbRawImages.map((img) => ({
        id: img.id,
        originalPath: img.originalPath,
        timestamp: img.timestamp,
      }));
      await createdImagesStore.setItem(projectId, createdImages);

      // determine DB-seed tasks (existing S3 files without DB entries)
      const dbPaths = new Set(createdImages.map((img) => img.originalPath));
      const seedPaths = uploadedFiles.filter((path) => !dbPaths.has(path));
      // determine S3-upload tasks (files not yet on S3)
      const images = allImages.filter(
        (image) => !s3Files.has(image.originalPath)
      );
      // total tasks = DB seeds + uploads
      const totalTasks = seedPaths.length + images.length;
      // initialize progress over all tasks
      setProgress({
        processed: 0,
        total: totalTasks,
        isComplete: false,
        error: null,
      });
      // 1) seed existing S3 files into DB in parallel
      const SEED_CONCURRENCY = 5;
      const seedIterator = seedPaths[Symbol.iterator]();
      const seedWorker = async () => {
        while (true) {
          const { value: originalPath, done } = seedIterator.next();
          if (done) break;
          const imageData = allImages.find(
            (img) => img.originalPath === originalPath
          );
          if (imageData) {
            const fileObj = files.find(
              (f) => f.webkitRelativePath === originalPath
            );
            const fileType = fileObj?.type ?? 'application/octet-stream';

            let elevation = 0;
            if (
              imageData.latitude &&
              imageData.longitude &&
              !imageData.altitude_agl
            ) {
              elevation =
                (await getElevationAtCoordinates(
                  imageData.latitude,
                  imageData.longitude
                )) ?? 0;
            }

            const altitude =
              imageData.altitude_egm96 ?? imageData.altitude_wgs84;

            const cameraName = extractCameraNameFromPath(originalPath);
            const cameraId = cameraName
              ? cameraNameToId[cameraName]
              : undefined;

            const { data: img } = await (client.models.Image.create as any)({
              projectId,
              width: imageData.width,
              height: imageData.height,
              timestamp: imageData.timestamp,
              cameraSerial: imageData.cameraSerial,
              originalPath: imageData.originalPath,
              latitude: imageData.latitude,
              longitude: imageData.longitude,
              altitude_egm96: imageData.altitude_egm96,
              altitude_wgs84: imageData.altitude_wgs84,
              altitude_agl:
                imageData.altitude_agl ??
                (elevation > 0 && altitude ? altitude - elevation : undefined),
              cameraId,
            });
            if (img) {
              createdImages.push({
                id: img.id,
                originalPath: img.originalPath!,
                timestamp: img.timestamp!,
              });
              await createdImagesStore.setItem(projectId, createdImages);
              await (client.models.ImageSetMembership.create as any)({
                imageId: img.id,
                imageSetId: imageSet.id,
              });
              await (client.models.ImageFile.create as any)({
                projectId,
                imageId: img.id,
                key: img.originalPath!,
                path: img.originalPath!,
                type: fileType,
              });
            }
          }
          // increment progress after each seed
          setProgress((prev) => ({ ...prev, processed: prev.processed + 1 }));
        }
      };
      const seedWorkers: Promise<void>[] = [];
      for (let i = 0; i < SEED_CONCURRENCY; i++) {
        seedWorkers.push(seedWorker());
      }
      await Promise.all(seedWorkers);

      // 2) upload new files to S3 with concurrency, continuing progress count
      const CONCURRENCY = 20;
      let processedTasks = 0; // counts only upload tasks here but progress is tracked globally via state
      const iterator = images[Symbol.iterator]();
      const runWorker = async () => {
        while (true) {
          if (cancelledRef.current) break;
          const { value: image, done } = iterator.next();
          if (done) break;
          try {
            const file = files.find(
              (f) => f.webkitRelativePath === image.originalPath
            );
            if (file) {
              await uploadData({
                path: 'images/' + image.originalPath,
                data: file,
                options: { bucket: 'inputs', contentType: file.type },
              }).result;
              uploadedFiles.push(image.originalPath);
              await fileStoreUploaded.setItem(projectId, uploadedFiles);

              let elevation = 0;
              if (image.latitude && image.longitude && !image.altitude_agl) {
                elevation =
                  (await getElevationAtCoordinates(
                    image.latitude,
                    image.longitude
                  )) ?? 0;
              }

              const altitude = image.altitude_egm96 ?? image.altitude_wgs84;

              const cameraName = extractCameraNameFromPath(image.originalPath);
              const cameraId = cameraName
                ? cameraNameToId[cameraName]
                : undefined;

              const { data: img } = await (client.models.Image.create as any)({
                projectId,
                width: image.width,
                height: image.height,
                timestamp: image.timestamp,
                cameraSerial: image.cameraSerial,
                originalPath: image.originalPath,
                latitude: image.latitude,
                longitude: image.longitude,
                altitude_egm96: image.altitude_egm96,
                altitude_wgs84: image.altitude_wgs84,
                altitude_agl:
                  image.altitude_agl ??
                  (elevation > 0 && altitude
                    ? altitude - elevation
                    : undefined),
                cameraId,
              });
              if (img) {
                createdImages.push({
                  id: img.id,
                  originalPath: image.originalPath,
                  timestamp: image.timestamp,
                });
                await createdImagesStore.setItem(projectId, createdImages);
                await (client.models.ImageSetMembership.create as any)({
                  imageId: img.id,
                  imageSetId: imageSet.id,
                });
                await (client.models.ImageFile.create as any)({
                  projectId,
                  imageId: img.id,
                  key: img.originalPath!,
                  path: image.originalPath,
                  type: file.type,
                });
              }
            }
          } catch (error) {
            console.error(
              `Error processing image ${image.originalPath}:`,
              error
            );
            if (!navigator.onLine) throw error;
          } finally {
            // increment progress after each upload task
            setProgress((prev) => ({ ...prev, processed: prev.processed + 1 }));
          }
        }
      };
      const workers: Promise<void>[] = [];
      for (let i = 0; i < CONCURRENCY; i++) workers.push(runWorker());
      await Promise.all(workers);
      // if pause was requested, after active uploads finish, reset state
      if (cancelledRef.current) {
        setProgress({ processed: 0, total: 0, isComplete: false, error: null });
        setTask({
          newProject: true,
          projectId: '',
          files: [],
          retryDelay: 0,
          resumeId: undefined,
          deleteId: undefined,
          pauseId: undefined,
        });
        return;
      }
      // all tasks finished successfully; mark upload complete
      setProgress((prev) => ({
        ...prev,
        processed: totalTasks,
        isComplete: true,
      }));
    } catch (error) {
      console.error('Error uploading files:', error);
      setProgress((progress) => ({
        ...progress,
        isComplete: false,
        error: JSON.stringify(error),
      }));
    }
  }

  async function retryWithBackoff() {
    // Helper function to calculate next retry delay using exponential backoff
    const getNextRetryDelay = (attempt: number): number => {
      // Base delay of 1 second, doubles each attempt
      const baseDelay = 1000; // 1 second in milliseconds
      const maxDelay = 300000; // 5 minutes in milliseconds
      const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);
      // Add some jitter to prevent thundering herd
      return delay + Math.random() * 1000;
    };

    const MAX_ATTEMPTS = 153; // 153 attempts = 12 hours (theoretically)
    const attempt = projectBackOff[projectId] || 1;

    if (attempt >= MAX_ATTEMPTS) {
      console.log(`Max attempts reached for project ${projectId}`);
      return;
    }

    console.log(`Attempt ${attempt} with ${projectId}`);

    // Calculate next retry delay
    const retryDelay = getNextRetryDelay(attempt);
    console.log(
      `Waiting ${retryDelay / 1000} seconds before next retry attempt`
    );

    setTask((task) => ({
      ...task,
      retryDelay: retryDelay,
      isComplete: false,
    }));

    setProjectBackOff((prev) => ({
      ...prev,
      [projectId]: attempt + 1,
    }));
  }

  async function fetchFilesFromS3() {
    try {
      const {
        data: [imageSet],
      } = await client.models.ImageSet.imageSetsByProjectId({
        projectId: projectId,
      });

      const { items } = await list({
        path: `images/${imageSet.name}/`, // image set name
        options: { bucket: 'inputs', listAll: true },
      });

      const uploadedFiles = items.reduce((set, x) => {
        set.add(x.path.substring('images/'.length));
        return set;
      }, new Set());

      return uploadedFiles;
    } catch (error) {
      console.error('Error fetching files from S3:', error);

      //get remaining files from local storage
      const filesToUpload =
        ((await fileStore.getItem(projectId)) as ImageData[]) ?? [];
      const uploadedFiles =
        ((await fileStoreUploaded.getItem(projectId)) as UploadedFiles) ?? [];

      const remainingFiles = filesToUpload.filter(
        (file) => !uploadedFiles.includes(file.originalPath)
      );

      //return the remaining files
      return new Set(remainingFiles.map((file) => file.originalPath));
    }
  }

  async function handleComplete() {
    const filesOnS3 = await fetchFilesFromS3();
    const filesToUpload =
      ((await fileStore.getItem(projectId)) as ImageData[]) ?? [];

    //replace uploaded files with all files from S3
    const uploadedFiles = filesToUpload.filter((file) =>
      filesOnS3.has(file.originalPath)
    );

    await fileStoreUploaded.setItem(
      projectId,
      uploadedFiles.map((file) => file.originalPath)
    );

    if (uploadedFiles.length !== filesToUpload.length) {
      await retryWithBackoff();
    } else {
      // finish upload
      const createdImages =
        ((await createdImagesStore.getItem(projectId)) as CreatedImage[]) ?? [];

      createdImages.sort((a, b) => a.timestamp - b.timestamp);

      const metadata = (await metadataStore.getItem(projectId)) as {
        model: string;
        masks: number[][][];
      };
      const model = metadata?.model ?? 'manual';
      const masks = metadata?.masks ?? [];

      const BATCH_SIZE = 500;

      for (let i = 0; i < createdImages.length; i += BATCH_SIZE) {
        const batch = createdImages.slice(i, i + BATCH_SIZE);
        const batchStrings = batch.map(
          (image) => `${image.id}---${image.originalPath}---${image.timestamp}`
        );

        // kick off image registration
        client.mutations.runImageRegistration({
          projectId: projectId,
          metadata: JSON.stringify({
            masks: masks,
          }),
          queueUrl: backend.custom.lightglueTaskQueueUrl,
        });
      }

      if (model === 'manual') {
        await (client.models.Project.update as any)({
          id: projectId,
          status: 'active',
        });
      }

      const { data: locationSet } = await (
        client.models.LocationSet.create as any
      )({
        name: projectId + `_${model}`,
        projectId: projectId,
      });

      if (!locationSet) {
        console.error('Failed to create location set');
        alert('Something went wrong, please try again.');
        return;
      }

      if (model === 'scoutbot') {
        for (let i = 0; i < createdImages.length; i += BATCH_SIZE) {
          const batch = createdImages.slice(i, i + BATCH_SIZE);
          const batchStrings = batch.map(
            (image) => `${image.id}---${image.originalPath}`
          );

          client.mutations.runScoutbot({
            projectId: projectId,
            images: batchStrings,
            setId: locationSet.id,
            bucket: backend.storage.buckets[1].bucket_name,
            queueUrl: backend.custom.scoutbotTaskQueueUrl,
          });
        }

        await client.models.Project.update({
          id: projectId,
          status: 'processing-scoutbot',
        });
      }

      if (model === 'elephant-detection-nadir') {
        for (let i = 0; i < createdImages.length; i += BATCH_SIZE) {
          const batch = createdImages.slice(i, i + BATCH_SIZE);
          const batchStrings = batch.map((image) => image.originalPath);

          client.mutations.runHeatmapper({
            images: batchStrings,
          });
        }

        await client.models.Project.update({
          id: projectId,
          status: 'processing-heatmap-busy',
        });
      }

      //clear local storage
      await fileStore.removeItem(projectId);
      await fileStoreUploaded.removeItem(projectId);
      await metadataStore.removeItem(projectId);
      await createdImagesStore.removeItem(projectId);

      setTask({
        newProject: true,
        projectId: '',
        files: [],
        retryDelay: 0,
        pauseId: undefined,
        deleteId: undefined,
      });

      setProgress({
        processed: 0,
        total: 0,
        isComplete: false,
        error: null,
      });

      client.mutations.updateProjectMemberships({
        projectId: projectId,
      });
    }
  }

  const fetchUploadingProjects = async () => {
    const myAdminProjects = myProjectsHook.data?.filter(
      (project) => project.isAdmin
    );

    const projects = await Promise.all(
      myAdminProjects?.map(async (project) => {
        return (
          await client.models.Project.get(
            { id: project.projectId },
            {
              selectionSet: ['id', 'name', 'status'],
            }
          )
        ).data;
      })
    );

    const uploadingProjects = projects
      .filter((project) => project && project?.status === 'uploading')
      .map((project) => ({ id: project?.id, name: project?.name }));

    return uploadingProjects as { id: string; name: string }[];
  };

  const findUploadsToComplete = async () => {
    const uploadingProjects = await fetchUploadingProjects();
    const uploadsToComplete = [];

    for (const project of uploadingProjects) {
      const uploads = await fileStoreUploaded.getItem(project.id);
      if (uploads) {
        uploadsToComplete.push(project);
      }
    }

    return uploadsToComplete;
  };

  const resumeUploads = async () => {
    if (resumeId) {
      const { data: project } = await client.models.Project.get({
        id: resumeId,
      });
      if (project) {
        pendingResumeProjectIdRef.current = {
          id: project.id,
          name: project.name,
        };
      }
      setTask((task) => ({
        ...task,
        resumeId: undefined,
        pauseId: undefined,
        deleteId: undefined,
      }));
    } else {
      const uploadsToComplete = await findUploadsToComplete();

      if (uploadsToComplete.length === 0) return;

      // handles only one failed project for now
      const project = uploadsToComplete[0];

      pendingResumeProjectIdRef.current = project;
    }

    setShowConfirmationModal(true);
  };

  async function handleDelete() {
    // Cancel any ongoing uploads
    cancelledRef.current = true;
    const id = deleteId!;
    try {
      console.log(`Deleting project ${id}`);
      // Fetch the associated image set
      const {
        data: [imageSet],
      } = await client.models.ImageSet.imageSetsByProjectId({ projectId: id });

      // Delete the image set
      await client.models.ImageSet.delete({ id: imageSet.id });
      setProgress((prev) => ({ ...prev, processed: 1, total: 3 }));

      // Delete the project memberships
      const { data: memberships } = await (
        client.models.UserProjectMembership
          .userProjectMembershipsByProjectId as any
      )({ projectId: id });
      await Promise.all(
        memberships.map((membership) =>
          client.models.UserProjectMembership.delete({ id: membership.id })
        )
      );
      setProgress((prev) => ({ ...prev, processed: 2 }));

      // Delete the project
      await client.models.Project.delete({ id });
      setProgress((prev) => ({
        ...prev,
        processed: 3,
      }));

      // Reset task context
      setTask({
        newProject: true,
        projectId: '',
        files: [],
        retryDelay: 0,
        deleteId: undefined,
        pauseId: undefined,
      });

      setProgress({
        processed: 0,
        total: 0,
        isComplete: false,
        error: null,
      });

      // clear local storage
      await fileStore.removeItem(id);
      await fileStoreUploaded.removeItem(id);
      await metadataStore.removeItem(id);
      await createdImagesStore.removeItem(id);

      setShowDeleteConfirmationModal(false);
    } catch (error) {
      console.error('Error deleting project:', error);
      setProgress((prev) => ({ ...prev, error: JSON.stringify(error) }));
    }
  }

  function handlePause() {
    cancelledRef.current = true;
  }

  function resetRefs() {
    pausedRef.current = false;
    deletingRef.current = false;
  }

  // Show pause modal when pauseId is set
  useEffect(() => {
    if (pauseId) {
      setShowPauseConfirmationModal(true);
    }
  }, [pauseId]);

  // Show delete modal when deleteId is set
  useEffect(() => {
    if (deleteId) {
      setShowDeleteConfirmationModal(true);
    }
  }, [deleteId]);

  // Core upload event handling (retry, resume, complete, new upload)
  useEffect(() => {
    if (error) {
      setProgress((prev) => ({ ...prev, error: null }));
      retryWithBackoff();
    } else if (resumeId) {
      resetRefs();
      resumeUploads();
    } else if (isComplete) {
      resetRefs();
      handleComplete();
    } else if (projectId) {
      resetRefs();
      uploadProject();
    }
  }, [projectId, resumeId, retryDelay, isComplete, error]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (selectedFiles && pendingResumeProjectIdRef.current) {
      setTask({
        newProject: false,
        projectId: pendingResumeProjectIdRef.current.id,
        files: Array.from(selectedFiles),
        retryDelay: 0,
        pauseId: undefined,
        deleteId: undefined,
      });
      pendingResumeProjectIdRef.current = null;
    }
  };

  useEffect(() => {
    let pingInterval: NodeJS.Timeout | null = null;

    if (projectId && !isComplete) {
      // Function to perform an empty update
      const pingProject = async () => {
        try {
          await client.models.Project.update({
            id: projectId,
          });
          console.log(`Pinged project ${projectId}`);
        } catch (error) {
          console.error('Error pinging project:', error);
        }
      };

      // Set interval to ping every 5 minutes
      pingInterval = setInterval(pingProject, 300000);
    }

    // Clear interval on cleanup
    return () => {
      if (pingInterval) {
        clearInterval(pingInterval);
      }
    };
  }, [projectId, isComplete]);

  return (
    <>
      <input
        ref={fileInputRef}
        type='file'
        webkitdirectory='true'
        directory='true'
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <ConfirmationModal
        show={showConfirmationModal}
        onClose={() => setShowConfirmationModal(false)}
        onConfirm={() => fileInputRef.current?.click()}
        title='Found interrupted uploads'
        body={`Uploads were interrupted for ${pendingResumeProjectIdRef.current?.name}. Would you like to resume? After confirming, please select the files again. If the upload was started on this device you won't have to filter the data again. Only the files that were interrupted will be uploaded.`}
      />
      <ConfirmationModal
        show={showPauseConfirmationModal}
        onClose={() => {
          if (!pausedRef.current) {
            setTask((task) => ({ ...task, pauseId: undefined }));
          }
          setShowPauseConfirmationModal(false);
        }}
        onConfirm={() => {
          pausedRef.current = true;
          handlePause();
        }}
        title='Pause upload'
        body={`Are you sure you want to pause the upload? The in flight uploads will be completed and the remaining files will be uploaded when you resume.`}
      />
      <ConfirmationModal
        show={showDeleteConfirmationModal}
        onClose={() => {
          if (!deletingRef.current) {
            setTask((task) => ({ ...task, deleteId: undefined }));
          }
          setShowDeleteConfirmationModal(false);
        }}
        onConfirm={() => {
          deletingRef.current = true;
          handleDelete();
        }}
        title='Delete Survey'
        body={`This will cancel the upload and delete the survey. This action cannot be undone.`}
      />
    </>
  );
}
