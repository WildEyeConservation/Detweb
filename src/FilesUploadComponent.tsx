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
import { parseGPX } from "@we-gold/gpxjs";
import { Schema } from "../amplify/data/resource.ts";
import FileInput from "./FileInput";

interface FilesUploadComponentProps {
  show: boolean;
  handleClose: () => void;
  project?: { id: string; name: string };
}

// Shared props for both modal and form versions
interface FilesUploadBaseProps {
  project?: { id: string; name: string };
  setOnSubmit?: React.Dispatch<
    React.SetStateAction<
      ((projectId: string) => Promise<Schema["Image"]["type"][]>) | null
    >
  >;
  setReadyToSubmit: React.Dispatch<React.SetStateAction<boolean>>;
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

type CsvFile = {
  timestamp?: number;
  filepath?: string;
  lat: number;
  lng: number;
  alt: number;
}[];

type CsvData = {
  data: CsvFile;
};

// Core functionality shared between modal and form versions
export function FileUploadCore({ setOnSubmit, setReadyToSubmit }: FilesUploadBaseProps) {
  const limitConnections = pLimit(6);
  const [upload, setUpload] = useState(true);
  const [name, setName] = useState("");
  const { client } = useContext(GlobalContext)!;
  const [scannedFiles, setScannedFiles] = useState<File[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [filteredImageFiles, setFilteredImageFiles] = useState<File[]>([]);
  const userContext = useContext(UserContext);
  const [totalImageSize, setTotalImageSize] = useState(0);
  const [filteredImageSize, setFilteredImageSize] = useState(0);
  const [advancedImageOptions, setAdvancedImageOptions] = useState(false);
  const [exifData, setExifData] = useState<ExifData>({});
  const [missingGpsData, setMissingGpsData] = useState(false);
  const [associateByTimestamp, setAssociateByTimestamp] = useState(false);
  const [minTimestamp, setMinTimestamp] = useState(0);
  const [maxTimestamp, setMaxTimestamp] = useState(0);
  const [file, setFile] = useState<File | undefined>();
  const [scanningEXIF, setScanningEXIF] = useState(false);
  const [csvData, setCsvData] = useState<CsvData | undefined>(undefined);
  const [listingS3Images, setListingS3Images] = useState(false);
  const [timeRanges, setTimeRanges] = useState<{
    [day: number]: { start: string; end: string };
  }>({});
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
      setListingS3Images(true);

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
      setListingS3Images(false);

      const gpsToCSVData: CsvFile = [];
      let missing = false;

      setScanningEXIF(true);

      // Get EXIF metadata for each file
      const exifData = await Promise.all(
        fImages.map(async (file) => {
          const exif = await getExifmeta(file);

          const updatedExif = {
            ...exif,
            width: exif.width || 0,
            height: exif.height || 0,
            gpsData:
              exif.gpsData.alt && exif.gpsData.lat && exif.gpsData.lng
                ? {
                    lat: Number(exif.gpsData.lat),
                    lng: Number(exif.gpsData.lng),
                    alt: Number(exif.gpsData.alt),
                  }
                : null,
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

      setScanningEXIF(false);

      setMissingGpsData(missing);
      if (!missing) {
        setCsvData({
          data: gpsToCSVData,
        });
        setAssociateByTimestamp(true);
        setMinTimestamp(
          Math.min(...gpsToCSVData.map((row) => row.timestamp || 0))
        );
        setMaxTimestamp(
          Math.max(...gpsToCSVData.map((row) => row.timestamp || 0))
        );
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

  const handleFileInputChange = (files: File[]) => {
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
        alert("Project is required");
        return;
      }

      if (!csvData) {
        alert("GPS metadata is required");
        return;
      }

      setTotalSteps(filteredImageSize);
      setStepsCompleted(0);

      const imageSets = await fetchAllPaginatedResults(
        client.models.ImageSet.list,
        { filter: { projectId: { eq: projectId } }, selectionSet: ["id"] }
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
        return imageSet?.id || "";
      }

      const imageSetId =
        imageSets.length > 0 ? imageSets[0].id : await createImageSet();

      const gpsFilteredImageFiles = filteredImageFiles.filter((file) => {
        const exifMeta = exifData[file.webkitRelativePath];

        if (exifMeta.gpsData) {
          // image metadata
          const csvRow = csvData.data.find(
            (row) => row.timestamp === exifMeta.timestamp
          );
          return csvRow !== undefined;
        } else {
          // csv/gpx file
          if (associateByTimestamp) {
            const csvRow = csvData.data.find(
              (row) => row.timestamp === exifMeta.timestamp
            );

            if (csvRow) {
              // Exact timestamp match found
              return true;
            } else {
              // No exact timestamp match found - determine if the timestamp is valid based on surrounding CSV data
              const sortedCsvData = csvData.data.sort(
                (a, b) => a.timestamp! - b.timestamp!
              );
              // Ensure the timestamp is within the CSV bounds
              if (
                exifMeta.timestamp < sortedCsvData[0].timestamp! ||
                exifMeta.timestamp >
                  sortedCsvData[sortedCsvData.length - 1].timestamp!
              ) {
                return false;
              }
              // Find the two CSV timestamps that bound this image timestamp
              let lower = null,
                upper = null;
              for (let i = 0; i < sortedCsvData.length - 1; i++) {
                if (
                  sortedCsvData[i].timestamp! <= exifMeta.timestamp &&
                  sortedCsvData[i + 1].timestamp! >= exifMeta.timestamp
                ) {
                  lower = sortedCsvData[i].timestamp!;
                  upper = sortedCsvData[i + 1].timestamp!;
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
                (sortedCsvData[sortedCsvData.length - 1].timestamp! -
                  sortedCsvData[0].timestamp!) /
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
              (row) =>
                row.filepath?.toLowerCase() ===
                file.webkitRelativePath.toLowerCase()
            );
            return csvRow !== undefined;
          }
        }
      });

      const result: Schema["Image"]["type"][] = [];

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
                    onError: (error: any) => {
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
              gpsData = interpolateGpsData(
                csvData.data.map((row) => ({
                  timestamp: row.timestamp!,
                  lat: row.lat,
                  lng: row.lng,
                  alt: row.alt,
                })),
                exifmeta.timestamp
              );
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

          const { data: image } = await client.models.Image.create({
            projectId: projectId,
            width: exifmeta.width,
            height: exifmeta.height,
            timestamp: exifmeta.timestamp,
            cameraSerial: exifmeta.cameraSerial,
            originalPath: file.webkitRelativePath,
            latitude: gpsData?.lat,
            longitude: gpsData?.lng,
            altitude_agl: gpsData?.alt,
          });

          if (!image) {
            throw new Error("Image not created");
          }

          result.push(image);

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

      return { images: result, imageSetId };
    },
    [upload, filteredImageFiles, name, client, filteredImageSize, csvData]
  );

  useEffect(() => {
    if (filteredImageFiles.length > 0 && csvData) {
      setReadyToSubmit(true);
    } else {
      setReadyToSubmit(false);
    }
  }, [filteredImageFiles, csvData]);

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

        const csvFormat = gpxFile.waypoints.map((waypoint) => ({
          timestamp: Number(waypoint.time),
          lat: waypoint.latitude,
          lng: waypoint.longitude,
          alt: waypoint.elevation || 0,
        }));

        setCsvData({
          data: csvFormat.sort((a, b) => a.timestamp - b.timestamp),
        });

        return;
      }

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
          const hasTimestamp = results.data.some(
            (row: any) => row["Timestamp"]
          );
          const hasFilepath = results.data.some((row: any) => row["FilePath"]);

          setAssociateByTimestamp(hasTimestamp && !hasFilepath);

          setCsvData({
            data: results.data
              .map((row: any) => {
                return {
                  timestamp: hasTimestamp
                    ? Number(row["Timestamp"])
                    : undefined,
                  filepath: hasFilepath ? row["FilePath"] : undefined,
                  lat: Number(row["Latitude"]),
                  lng: Number(row["Longitude"]),
                  alt: Number(row["Altitude"]),
                };
              })
              .sort((a, b) =>
                hasTimestamp
                  ? a.timestamp! - b.timestamp!
                  : a.filepath.localeCompare(b.filepath)
              ),
          });

          if (hasTimestamp) {
            setMinTimestamp(
              Math.min(...results.data.map((row: any) => row.timestamp))
            );
            setMaxTimestamp(
              Math.max(...results.data.map((row: any) => row.timestamp))
            );
          }
        },
      });
    }

    if (file) {
      transformFile(file);
    }
  }, [file, associateByTimestamp]);

  // Update the time range for a given day.
  const updateTimeRange = (day: number, start: string, end: string) => {
    setTimeRanges((prev) => ({
      ...prev,
      [day]: { start, end },
    }));
  };

  // Helper: converts a "HH:mm" string to total minutes.
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(":").map(Number);
    return hours * 60 + minutes;
  };

  // Filter csvData rows by each day's selected time range.
  const applyTimeFilter = () => {
    setCsvData((prev) => {
      if (!prev) return prev;
      const filtered = prev.data.filter((row) => {
        const date = new Date(row.timestamp!);
        const day = date.getDate();
        if (timeRanges[day]) {
          const rowMinutes = date.getHours() * 60 + date.getMinutes();
          const startMinutes = timeToMinutes(timeRanges[day].start);
          const endMinutes = timeToMinutes(timeRanges[day].end);
          return rowMinutes >= startMinutes && rowMinutes <= endMinutes;
        }
        return true;
      });
      return { data: filtered };
    });
  };

  // Common UI elements shared between modal and form versions
  return (
    <>
      <div
        className="p-2 mb-2 bg-white text-black"
        style={{ minHeight: "136px", overflow: "auto" }}
      >
        {scannedFiles.length > 0 && (
          <code className="m-0 text-dark">
            Folder name: {name}
            <br />
            Total files: {scannedFiles.length}
            <br />
            Image files: {imageFiles.length}
            <br />
            Image files size: {formatFileSize(totalImageSize)}
            <br />
            {listingS3Images ? (
              "Searching for images in S3..."
            ) : (
              <>
                New images: {filteredImageFiles.length}
                {filteredImageFiles.length > 0 && (
                  <>
                    <br />
                    New images size: {formatFileSize(filteredImageSize)}
                  </>
                )}
              </>
            )}
          </code>
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
          <FileInput
            id="filepicker"
            webkitdirectory=""
            onFileChange={handleFileInputChange}
          >
            <p style={{ margin: 0 }}>
              {scannedFiles.length > 0
                ? "Change source folder"
                : "Select Files"}
            </p>
          </FileInput>
        </Form.Group>
        {/* <div>
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
          )}
        </div> */}
      </div>
      {scanningEXIF ? (
        <p className="mt-3 mb-0">Scanning images for GPS data...</p>
      ) : imageFiles.length > 0 ? (
        <Form.Group className="mt-3 d-flex flex-column gap-2">
          <div>
            <Form.Label className="mb-0">
              {missingGpsData ? "Missing GPS data" : "GPS data found"}
            </Form.Label>
            <Form.Text className="d-block mb-0" style={{ fontSize: "12px" }}>
              {missingGpsData
                ? "Some images do not have GPS data. Please upload the gpx or csv file containing the GPS data for all images."
                : "The selected images have GPS data. Would you like to upload a separate file containing the GPS data for all images?"}
            </Form.Text>
            <Form.Text className="d-block mb-0" style={{ fontSize: "12px" }}>
              If your data contains file paths instead of timestamps, the format
              should be:{" "}
              <code className="text-primary" style={{ fontSize: "14px" }}>
                {imageFiles[0].webkitRelativePath}
              </code>
            </Form.Text>
          </div>
          <FileInput
            id="gps-metadata-file"
            fileType=".csv,.gpx"
            onFileChange={(files) => setFile(files[0])}
          >
            <p className="mb-0">Select GPS metadata file</p>
          </FileInput>
        </Form.Group>
      ) : null}
      {csvData && (
        <>
          <GPSSubset
            gpsData={csvData.data}
            onFilter={(filteredData) => {
              setCsvData((prevData) => ({ ...prevData, data: filteredData }));
            }}
          />
          {associateByTimestamp && (
            <Form.Group>
              <Form.Label className="mb-0">
                Filter Data by Time Range (Optional)
              </Form.Label>
              <Form.Text
                className="d-block mb-1 mt-0"
                style={{ fontSize: "12px" }}
              >
                Select the effective time range for each day. The default range
                is the earliest and latest timestamp recorded for that day.
              </Form.Text>
              <div className="d-flex flex-column gap-2">
                {Array.from(
                  new Set(
                    csvData.data.map((row) =>
                      new Date(row.timestamp!).getDate()
                    )
                  )
                )
                  .sort((a: number, b: number) => a - b)
                  .map((day: number) => (
                    <div
                      key={`day-${day}`}
                      className="d-flex flex-row align-items-center gap-2"
                    >
                      <span className="me-2">Day {day}</span>
                      <input
                        type="time"
                        value={timeRanges[day]?.start || "00:00"}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateTimeRange(
                            day,
                            e.target.value,
                            timeRanges[day]?.end || "23:59"
                          )
                        }
                      />
                      <input
                        type="time"
                        value={timeRanges[day]?.end || "23:59"}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateTimeRange(
                            day,
                            timeRanges[day]?.start || "00:00",
                            e.target.value
                          )
                        }
                      />
                    </div>
                  ))}
              </div>
              <Button variant="primary" onClick={applyTimeFilter}>
                Filter Data
              </Button>
            </Form.Group>
          )}
        </>
      )}
      {csvData && (
        <div className="mt-3">
          {(() => {
            let message = "";
            if (associateByTimestamp) {
              const csvTimestamps = csvData.data.map(
                (row) => row.timestamp || 0
              );
              const csvMin = csvTimestamps.length
                ? Math.min(...csvTimestamps)
                : 0;
              const csvMax = csvTimestamps.length
                ? Math.max(...csvTimestamps)
                : 0;
              if (csvTimestamps.length) {
                if (csvMin < minTimestamp || csvMax > maxTimestamp) {
                  message = `Timestamp mismatch: CSV timestamps (${csvMin} - ${csvMax}) are outside the image timestamps range (${minTimestamp} - ${maxTimestamp}).`;
                } else {
                  message = `Timestamp range valid: CSV timestamps (${csvMin} - ${csvMax}) are within the image timestamps range (${minTimestamp} - ${maxTimestamp}).`;
                }
              }
            } else {
              const total = filteredImageFiles.length;
              if (total > 0) {
                const matched = filteredImageFiles.filter((file) =>
                  csvData.data.some(
                    (row) =>
                      row.filepath &&
                      row.filepath.toLowerCase() ===
                        file.webkitRelativePath.toLowerCase()
                  )
                ).length;
                const percent = Math.round((matched / total) * 100);
                message = `${percent}% of image files have corresponding CSV file paths.`;
              } else {
                message = `No image files available for CSV file path matching.`;
              }
            }
            return <div className="alert alert-info">{message}</div>;
          })()}
        </div>
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
    <Modal show={show} onHide={handleClose} size="xl">
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
