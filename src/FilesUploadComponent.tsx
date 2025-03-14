import { useEffect, useState, useRef, useContext, useCallback } from "react";
// import moment from 'moment'
// import {MD5,enc} from 'crypto-js'
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { useUpdateProgress } from "./useUpdateProgress";
import { list, uploadData } from "aws-amplify/storage";
import { UserContext, GlobalContext } from "./Context.tsx";
import pLimit from "p-limit";
import ExifReader from "exifreader";
import { DateTime } from "luxon";
import { fetchAllPaginatedResults } from "./utils";

/* I don't understand why I need to tell Typescript that webkitdirectory is one of the fields of the input element.
  Without this, Typescript complains that webkitdirectory is not a valid attribute for an input element.
  Some discussion at https://stackoverflow.com/questions/71444475/webkitdirectory-in-typescript-and-react 
  This can probably solved in a better way. I am moving on for now. JJN
*/
declare module "react" {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string;
  }
}

interface FilesUploadComponentProps {
  show: boolean;
  handleClose: () => void;
  project?: { id: string; name: string };
}

// Shared props for both modal and form versions
interface FilesUploadBaseProps {
  project?: { id: string; name: string };
  setOnSubmit?: React.Dispatch<
    React.SetStateAction<((projectId: string) => Promise<void>) | null>
  >;
}

// Props for form-compatible version
interface FilesUploadFormProps extends FilesUploadBaseProps {}

// Core functionality shared between modal and form versions
export function FileUploadCore({ setOnSubmit }: FilesUploadBaseProps) {
  const limitConnections = pLimit(6);
  const [upload, setUpload] = useState(true);
  const [name, setName] = useState("");
  const { client } = useContext(GlobalContext)!;
  const [integrityCheck, setIntegrityCheck] = useState(true);
  const [scannedFiles, setScannedFiles] = useState<File[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [filteredImageFiles, setFilteredImageFiles] = useState<File[]>([]);
  const userContext = useContext(UserContext);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [totalImageSize, setTotalImageSize] = useState(0);
  const [filteredImageSize, setFilteredImageSize] = useState(0);
  const [advancedImageOptions, setAdvancedImageOptions] = useState(false);

  if (!userContext) {
    return null;
  }

  useEffect(() => {
    setFilteredImageSize(0);
    setFilteredImageFiles([]);
  }, [name]);

  useEffect(() => {
    setImageFiles(
      scannedFiles.filter((file) => file.type.startsWith("image/"))
    );
  }, [scannedFiles]);

  useEffect(() => {
    setTotalImageSize(imageFiles.reduce((acc, file) => acc + file.size, 0));
  }, [imageFiles]);

  useEffect(() => {
    setFilteredImageSize(
      filteredImageFiles.reduce((acc, file) => acc + file.size, 0)
    );
  }, [filteredImageFiles]);

  useEffect(() => {
    async function getExistingFiles() {
      const { items } = await list({
        path: `images/${name}`,
        options: { bucket: "inputs", listAll: true },
      });
      console.log(items);
      const existingFiles = items.reduce<Set<string>>((set, x) => {
        set.add(x.path.substring("images/".length));
        return set;
      }, new Set());
      setFilteredImageFiles(
        imageFiles.filter((file) => !existingFiles.has(file.webkitRelativePath))
      );
    }
    if (imageFiles.length > 0) {
      getExistingFiles();
    }
  }, [imageFiles]);

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (files) {
      setScannedFiles(Array.from(files));
      setName(files[0].webkitRelativePath.split("/")[0]);
    }
  };

  const formatFileSize = useCallback((bytes: number): string => {
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }, []);

  async function getExifmeta(file: File) {
    const tags = await ExifReader.load(file);
    /* I am saving all of the exifdata to make it easier to answer questions about eg. lens used/ISO/shutterTime/aperture distributions later on. However, some
      EXIF fields are absolutely huge and make writing to my database impossibly slow. I explicitly drop those here*/
    delete tags["Thumbnail"];
    delete tags["Images"];
    delete tags["MakerNote"];
    for (const tag of Object.keys(tags)) {
      if (tags[tag]?.description?.length > 100) {
        console.log(
          `Tag ${tag} has a description longer than 100 characters. Dropping it.`
        );
        console.log(tags[tag].description);
        delete tags[tag];
      }
    }
    const rotated = (tags["Orientation"]?.value as number) > 4;
    return {
      key: file.webkitRelativePath,
      width: rotated ? tags["Image Height"]?.value : tags["Image Width"]?.value,
      height: rotated
        ? tags["Image Width"]?.value
        : tags["Image Height"]?.value,
      timestamp: DateTime.fromFormat(
        tags.DateTimeOriginal?.description as string,
        "yyyy:MM:dd HH:mm:ss"
      ).toSeconds(),
      cameraSerial: tags["Internal Serial Number"]?.value,
      //exifData: JSON.stringify({ ...tags, 'ImageHeight':undefined, 'ImageWidth':undefined})
    };
  }

  const [setStepsCompleted, setTotalSteps] = useUpdateProgress({
    taskId: `Upload files ${name}`,
    determinateTaskName: `Uploading files for imageSet ${name}`,
    indeterminateTaskName: `Preparing files for imageSet ${name}`,
    stepFormatter: formatFileSize,
  });

  const handleSubmit = useCallback(
    async (projectId: string) => {
      if (!projectId) {
        console.error("Project is required");
        return;
      }

      setTotalSteps(filteredImageSize);
      setStepsCompleted(0);

      const imageSets = await fetchAllPaginatedResults(
        client.models.ImageSet.list,
        { filter: { projectId: { eq: projectId } } }
      );

      async function createImageSet() {
        const { data: imageSet } = await client.models.ImageSet.create({
          name,
          projectId: projectId,
        });
        return imageSet?.id;
      }

      const imageSetId =
        imageSets.find((x) => x.name === name)?.id || createImageSet();
      filteredImageFiles.map((file) =>
        limitConnections(async () => {
          let lastTransferred = 0;
          const tasks = [
            upload
              ? uploadData({
                  path: "images/" + file.webkitRelativePath,
                  data: file,
                  options: {
                    bucket: "inputs",
                    contentType: file.type,
                    onProgress: ({ transferredBytes }) => {
                      {
                        const additionalTransferred =
                          transferredBytes - lastTransferred;
                        setStepsCompleted((fc) => fc + additionalTransferred);
                      }
                      lastTransferred = transferredBytes;
                    },
                    onError: (error) => {
                      console.error(error);
                    },
                  },
                }).result
              : Promise.resolve(),
            getExifmeta(file).then((exifmeta) => {
              if (!upload) {
                setStepsCompleted((fc) => fc + file.size);
              }
              return exifmeta;
            }),
          ] as const;
          const results = await Promise.all(tasks);
          const exifmeta = results[1];
          // Get the exif metadata from the second task
          client.models.Image.create({
            projectId: projectId,
            width: exifmeta.width || 0,
            height: exifmeta.height || 0,
            timestamp: exifmeta.timestamp!,
            cameraSerial: exifmeta.cameraSerial,
            //exifData: exifmeta.exifData,
            originalPath: file.webkitRelativePath,
          }).then(async ({ data: image }) => {
            if (!image) {
              throw new Error("Image not created");
            }
            await client.models.ImageSetMembership.create({
              imageId: image.id,
              imageSetId: imageSetId,
            });
            await client.models.ImageFile.create({
              projectId: projectId,
              imageId: image.id,
              key: file.webkitRelativePath,
              path: file.webkitRelativePath,
              type: file.type,
            });
          });
        })
      );

      await client.models.ImageSet.update({
        id: imageSetId,
        imageCount: filteredImageFiles.length,
      });
    },
    [upload, filteredImageFiles, name, client]
  );

  // Register the submit handler with the parent form if provided
  useEffect(() => {
    if (setOnSubmit) {
      setOnSubmit(() => handleSubmit);
    }
  }, [setOnSubmit]);

  // Common UI elements shared between modal and form versions
  return (
    <>
      <input
        type="file"
        id="filepicker"
        name="fileList"
        multiple
        webkitdirectory=""
        ref={fileInputRef}
        style={{ display: "none" }}
        onChange={handleFileInputChange}
      />
      <div
        className="p-2 mb-2 bg-white text-black"
        style={{ minHeight: "160px", overflow: "auto" }}
      >
        {scannedFiles.length > 0 && (
          <p className="m-0">
            Imageset name: {name}
            <br />
            Total files: {scannedFiles.length}
            <br />
            Image files: {imageFiles.length}
            <br />
            Image files size: {formatFileSize(totalImageSize)}
            <br />
            Image files not already uploaded: {filteredImageFiles.length}
            <br />
            Image files size not already uploaded:{" "}
            {formatFileSize(filteredImageSize)}
          </p>
        )}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Form.Group>
          <Button
            variant="primary"
            onClick={() => fileInputRef.current?.click()}
          >
            {scannedFiles.length > 0 ? "Change source folder" : "Select Files"}
          </Button>
        </Form.Group>
        <div>
          <Form.Group>
            <Form.Check
              type="switch"
              id="custom-switch"
              label="Advanced Options"
              checked={advancedImageOptions}
              onChange={(x) => {
                setAdvancedImageOptions(x.target.checked);
                if (!x.target.checked) {
                  setUpload(true);
                  setIntegrityCheck(true);
                }
              }}
            />
          </Form.Group>
          {advancedImageOptions && (
            <>
              <Form.Group>
                <Form.Check
                  type="switch"
                  id="custom-switch"
                  label="Upload files to S3"
                  checked={upload}
                  onChange={(x) => {
                    setUpload(x.target.checked);
                  }}
                />
              </Form.Group>
              <Form.Group>
                <Form.Check
                  type="switch"
                  id="custom-switch"
                  label="Do integrity check"
                  checked={integrityCheck}
                  onChange={(x) => {
                    setIntegrityCheck(x.target.checked);
                  }}
                />
              </Form.Group>
            </>
          )}
        </div>
      </div>
    </>
  );
}

// Form-compatible version that can be integrated into another form
export function FilesUploadForm(props: FilesUploadFormProps) {
  return <FileUploadCore {...props} />;
}

// Original modal version
export default function FilesUploadComponent({
  show,
  handleClose,
  project,
}: FilesUploadComponentProps) {
  const [uploadSubmitFn, setUploadSubmitFn] = useState<
    ((projectId: string) => Promise<void>) | null
  >(null);

  // Modal version needs to handle its own submit
  const handleModalSubmit = async () => {
    // Close the modal first, so the user doesn't experience the UI as unresponsive
    handleClose();
    if (uploadSubmitFn && project?.id) {
      await uploadSubmitFn(project.id);
    }
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Add files: {project?.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <FileUploadCore project={project} setOnSubmit={setUploadSubmitFn} />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={handleModalSubmit}>
          Submit
        </Button>
        <Button variant="dark" onClick={handleClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
