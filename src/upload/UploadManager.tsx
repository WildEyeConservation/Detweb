import localforage from "localforage";
import { UploadContext, GlobalContext, UserContext } from "../Context";
import { useContext, useEffect, useRef, useState } from "react";
import { uploadData, list } from "aws-amplify/storage";
import { ImageData, UploadedFiles } from "../types/ImageData";
import ConfirmationModal from "../ConfirmationModal";

const fileStore = localforage.createInstance({
  name: "fileStore",
  storeName: "files",
});

const fileStoreUploaded = localforage.createInstance({
  name: "fileStoreUploaded",
  storeName: "filesUploaded",
});

const modelStore = localforage.createInstance({
  name: "modelStore",
  storeName: "models",
});

export default function UploadManager() {
  const {
    task: { projectId, files, retryDelay },
    progress: { isComplete, error },
    setTask,
    setProgress,
  } = useContext(UploadContext)!;
  const { client } = useContext(GlobalContext)!;
  const { myMembershipHook: myProjectsHook } = useContext(UserContext)!;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pendingResumeProjectIdRef = useRef<{ id: string; name: string } | null>(
    null
  );
  const [projectBackOff, setProjectBackOff] = useState<Record<string, number>>(
    {}
  );
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);

  async function uploadProject() {
    console.log("uploading project", projectId);

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
          const { value: image, done } = iterator.next();
          if (done) break;
          try {
            const file = files.find(
              (file) => file.webkitRelativePath === image.originalPath
            );
            if (!file) {
              console.error("File not found", image.originalPath);
              continue;
            }
            try {
              await uploadData({
                path: "images/" + image.originalPath,
                data: file,
                options: { bucket: "inputs", contentType: file.type },
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
              throw new Error("Image not created");
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
      // all workers finished successfully; mark upload complete
      setProgress((progress) => ({
        ...progress,
        processed: totalImages,
        isComplete: true,
      }));
    } catch (error) {
      console.error("Error uploading files:", error);
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
        options: { bucket: "inputs", listAll: true },
      });

      const uploadedFiles = items.reduce((set, x) => {
        set.add(x.path.substring("images/".length));
        return set;
      }, new Set());

      return uploadedFiles;
    } catch (error) {
      console.error("Error fetching files from S3:", error);

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

    await fileStoreUploaded.setItem(projectId, uploadedFiles);

    if (uploadedFiles.length !== filesToUpload.length) {
      await retryWithBackoff();
    } else {
      // finish upload
      await fileStore.removeItem(projectId);
      await fileStoreUploaded.removeItem(projectId);

      setTask({
        projectId: "",
        files: [],
        retryDelay: 0,
      });

      setProgress({
        processed: 0,
        total: 0,
        isComplete: false,
        error: null,
      });

      const model = await modelStore.getItem(projectId);

      if (model === "manual") {
        await client.models.Project.update({
          id: projectId,
          status: "active",
        });
      }

      if (model === "scoutbot") {
        //TODO: kick off scoutbot processing

        await client.models.Project.update({
          id: projectId,
          status: "processing",
        });
      }

      client.mutations.updateProjectMemberships({
        projectId: projectId,
      });
    }
  }

  function handleError(error: string) {
    console.error("Error uploading files:", JSON.parse(error));
    if (
      window.confirm(
        "An unexpected error occurred while uploading files. Would you like to refresh the page to try again? Already uploaded files won't be affected."
      )
    ) {
      window.location.reload();
    }
  }

  // handles upload events
  useEffect(() => {
    if (error) {
      // clear the error to prevent continuous retries
      setProgress((prev) => ({ ...prev, error: null }));
      // schedule retry on network failure
      retryWithBackoff();
    } else if (isComplete) {
      handleComplete();
    } else if (projectId) {
      uploadProject();
    }
  }, [projectId, retryDelay, isComplete, error]);

  // picks up unfinished uploads and queues them for completion
  useEffect(() => {
    if (!projectId) {
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
                  selectionSet: ["id", "name", "status"],
                }
              )
            ).data;
          })
        );

        const uploadingProjects = projects
          .filter((project) => project && project?.status === "uploading")
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
        const uploadsToComplete = await findUploadsToComplete();

        if (uploadsToComplete.length === 0) return;

        // handles only one failed project for now
        const project = uploadsToComplete[0];

        pendingResumeProjectIdRef.current = project;
        setShowConfirmationModal(true);
      };

      completeUploads();
    }
  }, []);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = event.target.files;
    if (selectedFiles && pendingResumeProjectIdRef.current) {
      setTask({
        projectId: pendingResumeProjectIdRef.current.id,
        files: Array.from(selectedFiles),
        retryDelay: 0,
      });
      pendingResumeProjectIdRef.current = null;
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        webkitdirectory="true"
        directory="true"
        multiple
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
      <ConfirmationModal
        show={showConfirmationModal}
        onClose={() => setShowConfirmationModal(false)}
        onConfirm={() => fileInputRef.current?.click()}
        title="Found interrupted uploads"
        body={`Uploads were interrupted for ${pendingResumeProjectIdRef.current?.name}. Would you like to resume? After confirming, please select the files again. Only the files that were interrupted will be uploaded.`}
      />
    </>
  );
}
