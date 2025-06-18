import localforage from 'localforage';
import { UploadContext, GlobalContext, UserContext } from '../Context';
import { useContext, useEffect, useRef, useState } from 'react';
import { uploadData, list } from 'aws-amplify/storage';
import { CreatedImage, ImageData, UploadedFiles } from '../types/ImageData';
import ConfirmationModal from '../ConfirmationModal';

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
    task: { projectId, files, retryDelay, resumeId, deleteId, pauseId },
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
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] =
    useState(false);
  const [showPauseConfirmationModal, setShowPauseConfirmationModal] =
    useState(false);
  const deletingRef = useRef<boolean>(false);
  const cancelledRef = useRef<boolean>(false);
  const pausedRef = useRef<boolean>(false);

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
      const uploadedFiles =
        ((await fileStoreUploaded.getItem(projectId)) as UploadedFiles) ?? [];
      const createdImages =
        ((await createdImagesStore.getItem(projectId)) as CreatedImage[]) ?? [];

      //images to upload
      const images = allImages.filter(
        (image) => !uploadedFiles.includes(image.originalPath)
      );

      const CONCURRENCY = 20;
      const totalImages = images.length;
      let processedImages = 0;

      setProgress({
        processed: processedImages,
        total: totalImages,
        isComplete: false,
        error: null,
      });

      // Process images with concurrency limit
      const iterator = images[Symbol.iterator]();
      const runWorker = async () => {
        while (true) {
          // Abort worker if deletion is in progress
          if (cancelledRef.current) break;
          const { value: image, done } = iterator.next();
          if (done) break;
          try {
            const file = files.find(
              (file) => file.webkitRelativePath === image.originalPath
            );
            if (!file) {
              console.error('File not found', image.originalPath);
              continue;
            }
            try {
              await uploadData({
                path: 'images/' + image.originalPath,
                data: file,
                options: { bucket: 'inputs', contentType: file.type },
              }).result;
            } catch (error) {
              console.error(
                `Error uploading image ${image.originalPath}:`,
                error
              );
              if (!navigator.onLine) {
                // propagate offline error to trigger backoff
                throw error;
              }
              continue;
            }

            // record the file as uploaded
            uploadedFiles.push(image.originalPath);
            await fileStoreUploaded.setItem(projectId, uploadedFiles);

            const { data: img } = await client.models.Image.create({
              projectId: projectId,
              width: image.width,
              height: image.height,
              timestamp: image.timestamp,
              cameraSerial: image.cameraSerial,
              originalPath: image.originalPath,
              latitude: image.latitude,
              longitude: image.longitude,
            });

            if (img) {
              createdImages.push({
                id: img.id,
                originalPath: image.originalPath,
                timestamp: image.timestamp,
              });
              await createdImagesStore.setItem(projectId, createdImages);

              await client.models.ImageSetMembership.create({
                imageId: img.id,
                imageSetId: imageSet.id,
              });

              await client.models.ImageFile.create({
                projectId: projectId,
                imageId: img.id,
                key: img.originalPath!,
                path: img.originalPath!,
                type: file.type,
              });
            } else {
              throw new Error('Image not created');
            }
          } catch (error) {
            console.error(
              `Error processing image ${image.originalPath}:`,
              error
            );
            if (!navigator.onLine) {
              // propagate offline error to trigger backoff
              throw error;
            }
          } finally {
            processedImages++;
            setProgress((progress) => ({
              ...progress,
              processed: processedImages,
              // defer marking complete until all workers finish
            }));
          }
        }
      };

      // Start concurrent workers
      const workers: Promise<void>[] = [];
      for (let i = 0; i < CONCURRENCY; i++) {
        workers.push(runWorker());
      }
      await Promise.all(workers);
      // if pause was requested, after active uploads finish, reset state
      if (cancelledRef.current) {
        setProgress({ processed: 0, total: 0, isComplete: false, error: null });
        setTask({
          projectId: '',
          files: [],
          retryDelay: 0,
          resumeId: undefined,
          deleteId: undefined,
          pauseId: undefined,
        });
        return;
      }
      // all workers finished successfully; mark upload complete
      setProgress((progress) => ({
        ...progress,
        processed: totalImages,
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
        path: `images/${imageSet.name}`, // image set name
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
          images: batchStrings,
          projectId: projectId,
          masks: JSON.stringify(masks),
          queueUrl: backend.custom.lightglueTaskQueueUrl,
        });
      }

      if (model === 'manual') {
        await client.models.Project.update({
          id: projectId,
          status: 'active',
        });
      }

      const { data: locationSet } = await client.models.LocationSet.create({
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
          const batchStrings = batch.map((image) => `${image.originalPath}`);

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

  const completeUploads = async () => {
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
      const { data: memberships } =
        await client.models.UserProjectMembership.userProjectMembershipsByProjectId(
          { projectId: id }
        );
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

  // handles upload events and deletion
  useEffect(() => {
    if (error) {
      setProgress((prev) => ({ ...prev, error: null }));
      retryWithBackoff();
    } else if (pauseId) {
      setShowPauseConfirmationModal(true);
    } else if (deleteId) {
      setShowDeleteConfirmationModal(true);
    } else if (resumeId) {
      resetRefs();
      completeUploads();
    } else if (isComplete) {
      resetRefs();
      handleComplete();
    } else if (projectId) {
      resetRefs();
      uploadProject();
    }
  }, [projectId, resumeId, retryDelay, isComplete, error, deleteId, pauseId]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (selectedFiles && pendingResumeProjectIdRef.current) {
      setTask({
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
        type="file"
        webkitdirectory="true"
        directory="true"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <ConfirmationModal
        show={showConfirmationModal}
        onClose={() => setShowConfirmationModal(false)}
        onConfirm={() => fileInputRef.current?.click()}
        title="Found interrupted uploads"
        body={`Uploads were interrupted for ${pendingResumeProjectIdRef.current?.name}. Would you like to resume? After confirming, please select the files again. Only the files that were interrupted will be uploaded.`}
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
        title="Pause upload"
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
        title="Delete Survey"
        body={`This will cancel the upload and delete the survey. This action cannot be undone.`}
      />
    </>
  );
}
