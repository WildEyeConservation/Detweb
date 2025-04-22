import { useEffect, useState, useRef, useContext, useCallback } from "react";
// import moment from 'moment'
// import {MD5,enc} from 'crypto-js'
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import { list, uploadData } from "aws-amplify/storage";
import { UserContext, GlobalContext } from "./Context.tsx";
import pLimit from "p-limit";
import ExifReader from "exifreader";
import { DateTime } from "luxon";
import { fetchAllPaginatedResults } from "./utils";
import { useQueryClient } from "@tanstack/react-query";
import Papa from "papaparse";
import GPSSubset from "./GPSSubset";
import { parseGPX } from "@we-gold/gpxjs"
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

type GpsData = {
  lat: number | undefined;
  lng: number | undefined;
  alt: number | undefined;
};

type ExifData = Record<
  string,
  {
    width: number;
    height: number;
    timestamp: number;
    cameraSerial: string;
    gpsData: GpsData | null;
  }
>;

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
  const [exifData, setExifData] = useState<ExifData>({});
  const [missingGpsData, setMissingGpsData] = useState(false);
  const [associateByTimestamp, setAssociateByTimestamp] = useState(false);
  const [minTimestamp, setMinTimestamp] = useState(0);
  const [maxTimestamp, setMaxTimestamp] = useState(0);
  const [file, setFile] = useState<File | undefined>();
  const [csvData, setCsvData] = useState<any>(undefined);
  const queryClient = useQueryClient();

  if (!userContext) {
    return null;
  }

  useEffect(() => {
    setFilteredImageSize(0);
    setFilteredImageFiles([]);
  }, [name]);

  useEffect(() => {
    setImageFiles(
      scannedFiles.filter((file) => file.type.startsWith("image/jpeg"))
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

      const existingFiles = items.reduce<Set<string>>((set, x) => {
        set.add(x.path.substring("images/".length));
        return set;
      }, new Set());

      const fImages = imageFiles.filter(
        (file) => !existingFiles.has(file.webkitRelativePath)
      );

      setFilteredImageFiles(fImages);

      const gpsToCSVData = [];
      let missing = false;

      // Get EXIF metadata for each file
      const exifData = await Promise.all(
        fImages.map(async (file) => {
          const exif = await getExifmeta(file);

          const updatedExif = {
            ...exif,
            width: exif.width || 0,
            height: exif.height || 0,
            gpsData:
              !exif.gpsData.alt || !exif.gpsData.lat || !exif.gpsData.lng
                ? null
                : exif.gpsData,
          };

          if (updatedExif.gpsData === null) {
            missing = true;
          } else {
            gpsToCSVData.push({
              ...updatedExif.gpsData,
              timestamp: updatedExif.timestamp,
            });
          }

          return updatedExif;
        })
      );

      setMissingGpsData(missing);
      if (!missing) {
        setCsvData({ data: gpsToCSVData });
        setAssociateByTimestamp(true);
        setMinTimestamp(Math.min(...gpsToCSVData.map((row) => row.timestamp)));
        setMaxTimestamp(Math.max(...gpsToCSVData.map((row) => row.timestamp)));
      }

      setExifData(
        exifData.reduce((acc, x) => {
          acc[x.key] = x;
          return acc;
        }, {} as ExifData)
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
      gpsData: {
        lat: tags["GPSLatitude"]?.description,
        lng: tags["GPSLongitude"]?.description,
        alt: tags["GPSAltitude"]?.description,
      },
      //exifData: JSON.stringify({ ...tags, 'ImageHeight':undefined, 'ImageWidth':undefined})
    };
  }

  const interpolateGpsData = (
    csvData: { timestamp: number; lat: number; lng: number; alt: number }[],
    queryTimestamp: number
  ) => {
    if (csvData.length === 0) {
      throw new Error("No GPS data available for interpolation.");
    }

    const sortedCsvData = csvData.sort((a, b) => a.timestamp - b.timestamp);

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
      throw new Error("Extrapolation required for GPS data interpolation.");
    }
  };

  const handleSubmit = useCallback(
    async (
      projectId: string,
      setStepsCompleted: (stepsCompleted: number) => void,
      setTotalSteps: (totalSteps: number) => void,
      onFinished?: () => void
    ) => {
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
        const { data: project } = await client.models.Project.get(
          { id: projectId },
          { selectionSet: ["name"] }
        );

        const { data: imageSet } = await client.models.ImageSet.create({
          name: project?.name || name,
          projectId: projectId,
        });
        return imageSet?.id;
      }

      const imageSetId =
        imageSets.length > 0 ? imageSets[0].id : await createImageSet();

        const gpsFilteredImageFiles = filteredImageFiles.filter((file) => {
          const exifMeta = exifData[file.webkitRelativePath];
  
          if (exifMeta.gpsData) { // image metadata
            const csvRow = csvData.data.find(
              (row) => row.timestamp === exifMeta.timestamp
            );
            return csvRow !== undefined;
          } else { // csv/gpx file
            if (associateByTimestamp) {
              const csvRow = csvData.data.find(
                (row) => row.timestamp === exifMeta.timestamp
              );
  
              if (csvRow) {
                // Exact timestamp match found
                return true;
              } else {
                // No exact timestamp match found - determine if the timestamp is valid based on surrounding CSV data
                const sortedCsvData = csvData.data.sort((a, b) => a.timestamp - b.timestamp);
                // Ensure the timestamp is within the CSV bounds
                if (
                  exifMeta.timestamp < sortedCsvData[0].timestamp ||
                  exifMeta.timestamp > sortedCsvData[sortedCsvData.length - 1].timestamp
                ) {
                  return false;
                }
                // Find the two CSV timestamps that bound this image timestamp
                let lower = null,
                  upper = null;
                for (let i = 0; i < sortedCsvData.length - 1; i++) {
                  if (
                    sortedCsvData[i].timestamp <= exifMeta.timestamp &&
                    sortedCsvData[i + 1].timestamp >= exifMeta.timestamp
                  ) {
                    lower = sortedCsvData[i].timestamp;
                    upper = sortedCsvData[i + 1].timestamp;
                    break;
                  }
                }
                if (lower === null || upper === null) {
                  return false;
                }
                // Compute the gap in this interval
                const intervalGap = upper - lower;
                // Calculate average gap over all CSV timestamps
                const avgInterval =
                  (sortedCsvData[sortedCsvData.length - 1].timestamp - sortedCsvData[0].timestamp) /
                  (sortedCsvData.length - 1);
                const thresholdFactor = 2; // adjustable factor; if the gap is > than 2x the average, assume dropped data
                if (intervalGap > avgInterval * thresholdFactor) {
                  return false;
                }
                return true;
              }
            } else {
              // Associate by filepath
              const csvRow = csvData.data.find(
                (row) => row.filepath === file.webkitRelativePath
              );
              return csvRow !== undefined;
            }
          }
        });

      const uploadTasks = gpsFilteredImageFiles.map((file) =>
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
                      const additionalTransferred =
                        transferredBytes - lastTransferred;
                      setStepsCompleted((fc) => fc + additionalTransferred);
                      lastTransferred = transferredBytes;
                    },
                    onError: (error) => {
                      console.error(error);
                    },
                  },
                }).result
              : Promise.resolve(),
          ];
          await Promise.all(tasks);
          const exifmeta = exifData[file.webkitRelativePath];

          let gpsData: GpsData | null = null;

          if (associateByTimestamp) {
            if (
              exifmeta.timestamp > minTimestamp &&
              exifmeta.timestamp < maxTimestamp
            ) {
              gpsData = interpolateGpsData(csvData.data, exifmeta.timestamp);
            } else {
              console.warn("Timestamp outside of GPS data range");
            }
          } else {
            const csvRow = csvData.data.find(
              (row) => row.filepath === file.webkitRelativePath
            );

            if (csvRow) {
              gpsData = {
                lat: csvRow.lat,
                lng: csvRow.lng,
                alt: csvRow.alt,
              };
            } else {
              console.warn(
                `No GPS data found for image ${file.webkitRelativePath}`
              );
            }
          }

          await client.models.Image.create({
            projectId: projectId,
            width: exifmeta.width,
            height: exifmeta.height,
            timestamp: exifmeta.timestamp,
            cameraSerial: exifmeta.cameraSerial,
            originalPath: file.webkitRelativePath,
            latitude: gpsData?.lat,
            longitude: gpsData?.lng,
            altitude_agl: gpsData?.alt,
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

      await Promise.all(uploadTasks); // Ensure all uploads finish before continuing

      await client.models.ImageSet.update({
        id: imageSetId,
        imageCount: filteredImageFiles.length,
      });

      queryClient.invalidateQueries({
        queryKey: ["UserProjectMembership"],
      });

      if (onFinished) {
        onFinished();
      }
    },
    [upload, filteredImageFiles, name, client, filteredImageSize]
  );

  // Register the submit handler with the parent form if provided
  useEffect(() => {
    if (setOnSubmit) {
      setOnSubmit(() => handleSubmit);
    }
  }, [setOnSubmit, handleSubmit]);

  useEffect(() => {
    async function transformFile(file: File) {
      if (file.type === "text/gpx") {
        setAssociateByTimestamp(true);

        const text = await file.text();
        const [gpxFile, error] = parseGPX(text);

        if (error) {
          console.error(error);
          return;
        }

        const csvFormat = gpxFile.waypoints.map((waypoint) => {
          return {
            timestamp: waypoint.time,
            lat: waypoint.latitude,
            lng: waypoint.longitude,
            alt: waypoint.elevation,
          };
        });

        setCsvData({
          data: csvFormat,
        });

        return;
      }

      if (associateByTimestamp) {
        Papa.parse(file, {
          complete: function (results) {
            setCsvData({
              ...results,
              data: results.data
                .map((row: any) => {
                  return {
                    timestamp: Number(row["Timestamp"]),
                    lat: Number(row["Latitude"]),
                    lng: Number(row["Longitude"]),
                    alt: Number(row["Altitude"]),
                  };
                })
                .filter((row) => row.timestamp),
            });
            setMinTimestamp(
              Math.min(...results.data.map((row: any) => row.timestamp))
            );
            setMaxTimestamp(
              Math.max(...results.data.map((row: any) => row.timestamp))
            );
          },
        });
      } else {
        Papa.parse(file, {
          header: true,
          skipEmptyLines: true,
          complete: function (results) {
            setCsvData({
              ...results,
              data: results.data.map((row: any) => {
                return {
                  filepath: row["FilePath"],
                  lat: Number(row["Latitude"]),
                  lng: Number(row["Longitude"]),
                  alt: Number(row["Altitude"]),
                };
              }),
            });
          },
        });
      }
    }

    if (file) {
      transformFile(file);
    }
  }, [file, associateByTimestamp]);

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
        style={{ minHeight: "136px", overflow: "auto" }}
      >
        {scannedFiles.length > 0 && (
          <p className="m-0">
            Folder name: {name}
            <br />
            Total files: {scannedFiles.length}
            <br />
            Image files: {imageFiles.length}
            <br />
            Image files size: {formatFileSize(totalImageSize)}
            <br />
            New images: {filteredImageFiles.length}
            {filteredImageFiles.length > 0 && (
              <>
                <br />
                New images size: {formatFileSize(filteredImageSize)}
              </>
            )}
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
          {/* <Form.Group>
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
          </Form.Group> */}
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
      {missingGpsData && (
        <Form.Group className="mt-3 d-flex flex-column gap-2">
          <div>
            <Form.Label className="mb-0">Missing GPS data</Form.Label>
            <Form.Text className="d-block mb-0" style={{ fontSize: "12px" }}>
              Some images do not have GPS data. Please upload the gpx or csv
              file containing the GPS data for all images. <br />
              CSV files should have the following columns with the correct
              headers: Timestamp or FilePath, Latitude, Longitude, Altitude.
            </Form.Text>
          </div>
          {file && file.type === "text/csv" && (
            <Form.Switch
              id="custom-switch"
              label="Associate by timestamp instead of filepath"
            checked={associateByTimestamp}
              onChange={(x) => {
                setAssociateByTimestamp(x.target.checked);
              }}
            />
          )}
          <div className="d-flex flex-row align-items-center gap-2">
            <Button
              style={{ width: "fit-content" }}
              as="label"
              htmlFor="file-upload"
            >
              Select GPS metadata file
              <input
                id="file-upload"
                type="file"
                accept=".csv,.gpx"
                onChange={(event) => {
                  if (event.target.files) {
                    setFile(event.target.files[0]);
                  }
                }}
                style={{ display: "none" }}
              />
            </Button>
            {file && <i className="mb-0">{file.name}</i>}
          </div>
        </Form.Group>
      )}
      {csvData && (
        <GPSSubset
          gpsData={csvData.data}
          onFilter={(filteredData) => {
            setCsvData({ ...csvData, data: filteredData });
          }}
        />
      )}
    </>
  );
}

// Form-compatible version that can be integrated into another form
export function FilesUploadForm(props: FilesUploadFormProps) {
  return <FileUploadCore {...props} />;
}

export const formatFileSize = (bytes: number): string => {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
};

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
