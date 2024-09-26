import { useEffect, useState, useRef, useContext, useCallback } from "react";
import Spinner from "react-bootstrap/Spinner"; // Add this import
// import moment from 'moment'
// import {MD5,enc} from 'crypto-js'
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { useUpdateProgress } from "./useUpdateProgress";
import { list, uploadData } from "aws-amplify/storage";
import { ProjectContext, UserContext, GlobalContext } from "./Context.tsx";
import pLimit from 'p-limit'
import ExifReader from 'exifreader'
import { ManagementContext } from "./Context.tsx";
import { DateTime } from 'luxon'



/* I don't understand why I need to tell Typescript that webkitdirectory is one of the fields of the input element.
  Without this, Typescript complains that webkitdirectory is not a valid attribute for an input element.
  Some discussion at https://stackoverflow.com/questions/71444475/webkitdirectory-in-typescript-and-react 
  This can probably solved in a better way. I am moving on for now. JJN
*/
declare module 'react' {
  interface InputHTMLAttributes<T> extends HTMLAttributes<T> {
    webkitdirectory?: string;
  }
}

interface FilesUploadComponentProps {
  show: boolean;
  handleClose: () => void;
}

export default function FilesUploadComponent({ show, handleClose }: FilesUploadComponentProps) {
  const limitConnections = pLimit(3);
  const [upload, setUpload] = useState(true);
  const [name, setName] = useState("");
  const {client} = useContext(GlobalContext)!;
  const { project } = useContext(ProjectContext)!;
  const [integrityCheck, setIntegrityCheck] = useState(true);
  const [scannedFiles, setScannedFiles] = useState<File[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [filteredImageFiles, setFilteredImageFiles] = useState<File[]>([]);
  const submitButtonRef = useRef<HTMLButtonElement | null>(null);
  const userContext = useContext(UserContext);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [totalImageSize, setTotalImageSize] = useState(0);
  const [filteredImageSize, setFilteredImageSize] = useState(0);
  const manContext = useContext(ManagementContext)!;
  const {imageSetsHook:{data:imageSets,create:createImageSet} } = manContext!;

  if (!userContext) {
    return null;
  }

  useEffect(() => {
    if (show && fileInputRef.current) {
      setIsScanning(true);
      fileInputRef.current.click();
    }
  }, [show]);

  useEffect(() => {
    setFilteredImageSize(0)
    setFilteredImageFiles([])
  }, [name]);

  useEffect(() => {
    setImageFiles(scannedFiles.filter(file => file.type.startsWith('image/')));
  }, [scannedFiles]);

  useEffect(() => {
    setTotalImageSize(imageFiles.reduce((acc, file) => acc + file.size, 0));
  }, [imageFiles]);


  useEffect(() => {
    setFilteredImageSize(filteredImageFiles.reduce((acc, file) => acc + file.size, 0));
  }, [filteredImageFiles]);

  useEffect(() => {
    async function getExistingFiles() {
      const {items} = await list({
        path: `images/${name}`,
        options:{bucket:'inputs'}
      });
      console.log(items);
      const existingFiles = items.reduce<Set<string>>((set, x) => {
        set.add(x.path.substring("images/".length));
        return set;
      }, new Set());
      setFilteredImageFiles(imageFiles.filter(file => !existingFiles.has(file.webkitRelativePath)));
    }
    if (imageFiles.length > 0) {
      getExistingFiles();
    }
  }, [imageFiles]);

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setScannedFiles(Array.from(files));
      setName(files[0].webkitRelativePath.split('/')[0]);
    }
    setIsScanning(false);
  };

  const formatFileSize = useCallback((bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  }, []);

  async function getExifmeta(file:File){
      const tags = await ExifReader.load(file)
      /* I am saving all of the exifdata to make it easier to answer questions about eg. lens used/ISO/shutterTime/aperture distributions later on. However, some
      EXIF fields are absolutely huge and make writing to my database impossibly slow. I explicitly drop those here*/
      delete tags['Thumbnail']
      delete tags['Images']
      delete tags['MakerNote']
      for (const tag of Object.keys(tags)) {
        if (tags[tag]?.description?.length > 100) {
          console.log(`Tag ${tag} has a description longer than 100 characters. Dropping it.`)
          console.log(tags[tag].description)
          delete tags[tag];
        }
      }
      return ({ key:file.webkitRelativePath,
                width:tags['Image Width']?.value,
                height:tags['Image Height']?.value,
                timestamp: DateTime.fromFormat(tags.DateTimeOriginal?.description as string, 'yyyy:MM:dd HH:mm:ss').toSeconds(),
                cameraSerial:tags['Internal Serial Number']?.value,
                //exifData: JSON.stringify({ ...tags, 'ImageHeight':undefined, 'ImageWidth':undefined})
      })
  }
  
  const [setStepsCompleted, setTotalSteps] = useUpdateProgress({
    taskId: `Upload files ${name}`,
    determinateTaskName: `Uploading files for imageSet ${name}`,
    indeterminateTaskName: `Preparing files for imageSet ${name}`, 
    stepFormatter: formatFileSize
  });

  const handleSubmit = async () => {
    // Close the modal first, so the user doesn't experience the UI as unresponsive
    handleClose();
    setTotalSteps(filteredImageSize);
    setStepsCompleted(0);
    const imageSetId = imageSets.find(x => x.name === name)?.id || createImageSet({name, projectId:project.id});
    filteredImageFiles.map(
      (file) => limitConnections(async () => {
        let lastTransferred = 0;
        const tasks = [upload ? uploadData({
          path: "images/" + file.webkitRelativePath,
          data: file,
          options: {
            bucket:'inputs',
            contentType: file.type,
            onProgress: ({ transferredBytes }) => {
              {
                const additionalTransferred = transferredBytes - lastTransferred;
                setStepsCompleted(fc => fc + additionalTransferred);  
              }
              lastTransferred = transferredBytes;
            }
          }
        }) : Promise.resolve(), getExifmeta(file).then(exifmeta => { if (!upload) { setStepsCompleted(fc => fc + file.size) } return exifmeta})] as const
        const results=await Promise.all(tasks)
        const exifmeta=results[1]
        // Get the exif metadata from the second task
        client.models.Image.create({
          projectId: project.id,
          width: exifmeta.width || 0,
          height: exifmeta.height || 0,
          timestamp: exifmeta.timestamp!,
          cameraSerial: exifmeta.cameraSerial,
          //exifData: exifmeta.exifData,
        }).then(({ data: image }) => {
          if (!image) {
            throw new Error("Image not created");
          }
          client.models.ImageSetMembership.create({
            imageId: image.id,
            imageSetId: imageSetId
          });
          client.models.ImageFile.create({
            projectId: project.id,
            imageId: image.id,
            key: file.webkitRelativePath,
            path: file.webkitRelativePath,
            type: file.type
          })
        })
      })
    );
  };

  // This just ensures that the modal closes if the user closes the filepicker without making a selection
  useEffect(() => {
    const fileInput = fileInputRef.current;
    if (fileInput) {
      const handleCancel = () => {
        handleClose();
      };
      fileInput.addEventListener('cancel', handleCancel);
      return () => {
        fileInput.removeEventListener('cancel', handleCancel);
      };
    }
  }, [handleClose]);

  return (
    <Modal show={show} onHide={handleClose}>
      <input type="file"
        id="filepicker"
        name="fileList"
        multiple
        webkitdirectory=""
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileInputChange}
      />
      <Modal.Header closeButton>
        <Modal.Title>Add files</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
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
            </div>
            <Form.Group>
              <Button variant="primary" onClick={() => fileInputRef.current?.click()}>
                Change source folder
              </Button>
            </Form.Group>
          </div>
          <Form.Group>
            <Form.Label>Imageset Name</Form.Label>
            <Form.Control
              type="string"
              value={name}
              onChange={(x) => setName(x.target.value)}
            />
          </Form.Group>
          {isScanning ? (
            <div className="text-center mt-3">
              <Spinner animation="border" role="status" />
              <p className="mt-2">Please be patient while files are scanned.</p>
            </div>
          ) : (
            <div className="text-center mt-3">
              <p>
                Total files: {scannedFiles.length}<br />
                Image files: {imageFiles.length}<br />
                Image files size: {formatFileSize(totalImageSize)}<br />
                Image files not allready uploaded: {filteredImageFiles.length}<br />
                Image files size not allready uploaded: {formatFileSize(filteredImageSize)}
              </p>
            </div>
          )}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="primary" onClick={handleSubmit} ref={submitButtonRef}>
          Submit
        </Button>
        <Button variant="primary" onClick={handleClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
