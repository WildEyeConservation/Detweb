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
  const limitConnections = pLimit(1);
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
  
  const [setStepsCompleted, setTotalSteps] = useUpdateProgress({
    taskId: `Upload files ${name}`,
    determinateTaskName: `Uploading files for imageSet ${name}`,
    indeterminateTaskName: `Preparing files for imageSet ${name}`, 
    stepFormatter: formatFileSize
  });

  const handleSubmit = async () => {
    // Close the modal first, so the user doesn't experience the UI as unresponsive
    handleClose();
    /* We wait for scanning of the submitted folder to be completed before proceeding, otherwise there is a risk that 
    we start processing on a recurseResult that is incomplete*/

    setTotalSteps(filteredImageSize);
    setStepsCompleted(0);

    const promises = filteredImageFiles.map(
      (file) => limitConnections(async () => {
        let lastTransferred = 0;
        const task = uploadData({
          path: "images/" + file.webkitRelativePath,
          data: file,
          options: {
            contentType: file.type,
            onProgress: ({ transferredBytes }) => {
              {
                const additionalTransferred = transferredBytes - lastTransferred;
                setStepsCompleted(fc => fc + additionalTransferred);  
              }
              lastTransferred = transferredBytes;
            }
          }
        })
        await task.result;
      })
    );

    Promise.all(promises).then(() =>
      client.models.ImageSet.create({ name, projectId: project.id })
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
          <Form.Group>
            <Form.Check // prettier-ignore
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
            <Form.Check // prettier-ignore
              type="switch"
              id="custom-switch"
              label="Do integrity check"
              checked={integrityCheck}
              onChange={(x) => {
                setIntegrityCheck(x.target.checked);
              }}
            />
            <Form.Group>
              <Form.Label>Imageset Name</Form.Label>
              <Form.Control
                type="string"
                value={name}
                onChange={(x) => setName(x.target.value)}
                disabled
              />
            </Form.Group>
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
                Image files size: {formatFileSize(totalImageSize)}<br/>
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
