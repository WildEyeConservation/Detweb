import { useEffect, useState, useRef, useContext, useCallback } from 'react';
// import moment from 'moment'
// import {MD5,enc} from 'crypto-js'
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { list } from 'aws-amplify/storage';
import { GlobalContext, UploadContext } from './Context.tsx';
import ExifReader from 'exifreader';
import { DateTime } from 'luxon';
import { fetchAllPaginatedResults } from './utils';
import Papa from 'papaparse';
import GPSSubset from './GPSSubset';
import { parseGPX } from '@we-gold/gpxjs';
import FileInput from './FileInput';
import ImageMaskEditor from './ImageMaskEditor.tsx';
import Select from 'react-select';
import localforage from 'localforage';

// Configure a dedicated storage instance for file paths
const fileStore = localforage.createInstance({
  name: 'fileStore',
  storeName: 'files',
});

const metadataStore = localforage.createInstance({
  name: 'metadataStore',
  storeName: 'metadata',
});

interface FilesUploadComponentProps {
  show: boolean;
  handleClose: () => void;
  project?: { id: string; name: string };
  fromStaleUpload?: boolean;
}

// Shared props for both modal and form versions
interface FilesUploadBaseProps {
  project?: { id: string; name: string };
  setOnSubmit?: React.Dispatch<
    React.SetStateAction<
      ((projectId: string, fromStaleUpload?: boolean) => Promise<any>) | null
    >
  >;
  setReadyToSubmit: React.Dispatch<React.SetStateAction<boolean>>;
  setGpsDataReady?: React.Dispatch<React.SetStateAction<boolean>>;
  newProject?: boolean;
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
export function FileUploadCore({
  setOnSubmit,
  setReadyToSubmit,
  setGpsDataReady,
  newProject = true,
}: FilesUploadBaseProps) {
  const [upload, setUpload] = useState(true);
  const [name, setName] = useState('');
  const { client } = useContext(GlobalContext)!;
  const [scannedFiles, setScannedFiles] = useState<File[]>([]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [filteredImageFiles, setFilteredImageFiles] = useState<File[]>([]);
  const { setTask } = useContext(UploadContext)!;
  const [totalImageSize, setTotalImageSize] = useState(0);
  const [filteredImageSize, setFilteredImageSize] = useState(0);
  const [exifData, setExifData] = useState<ExifData>({});
  const [missingGpsData, setMissingGpsData] = useState(false);
  const [associateByTimestamp, setAssociateByTimestamp] = useState(false);
  const [minTimestamp, setMinTimestamp] = useState(0);
  const [maxTimestamp, setMaxTimestamp] = useState(0);
  const [file, setFile] = useState<File | undefined>();
  const [scanningEXIF, setScanningEXIF] = useState(false);
  const [csvData, setCsvData] = useState<CsvData | undefined>(undefined);
  const [fullCsvData, setFullCsvData] = useState<CsvFile | undefined>(undefined);
  const [listingS3Images, setListingS3Images] = useState(false);
  const [timeRanges, setTimeRanges] = useState<{
    [day: number]: { start: string; end: string };
  }>({});
  const [masks, setMasks] = useState<number[][][]>([]);
  const [toUploadFiles, setToUploadFiles] = useState<File[]>([]);
  const [toUploadSize, setToUploadSize] = useState(0);
  const [model, setModel] = useState<{
    label: string;
    value: string;
  }>({
    label: 'ScoutBot',
    value: 'scoutbot',
  });

  // State for user-defined column mapping phase
  const [headerFields, setHeaderFields] = useState<string[] | null>(null);
  const [columnMapping, setColumnMapping] = useState<{
    timestamp?: string;
    filepath?: string;
    lat?: string;
    lng?: string;
    alt?: string;
  }>({});
  const [mappingConfirmed, setMappingConfirmed] = useState(false);
  const [timestampInMs, setTimestampInMs] = useState(false);

  // State for scan count and total
  const [scanCount, setScanCount] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);

  // Handler to confirm column mapping before processing
  const handleConfirmMapping = () => {
    const {
      timestamp: timestampCol,
      filepath: filepathCol,
      lat: latCol,
      lng: lngCol,
    } = columnMapping;
    if (!latCol || !lngCol) {
      alert('Please map the Latitude and Longitude columns.');
      return;
    }
    if (!timestampCol && !filepathCol) {
      alert('Please map at least Timestamp or FilePath column.');
      return;
    }
    setMappingConfirmed(true);
  };

  // Extract CSV header fields on file selection or skip for GPX
  useEffect(() => {
    if (!file) return;
    if (file.type === 'text/gpx' || file.name.toLowerCase().endsWith('.gpx')) {
      // GPX files are processed without manual mapping
      setHeaderFields(null);
      setMappingConfirmed(true);
    } else {
      // CSV files: parse only header row to get column names
      Papa.parse(file, {
        header: true,
        preview: 1,
        skipEmptyLines: true,
        complete: (results) => {
          setHeaderFields(results.meta.fields || []);

          const defaultMappings: {
            timestamp?: string;
            filepath?: string;
            lat?: string;
            lng?: string;
            alt?: string;
          } = {};

          for (const field of results.meta.fields || []) {
            switch (field.toLowerCase()) {
              case 'timestamp':
                defaultMappings.timestamp = field;
                break;
              case 'filepath':
                defaultMappings.filepath = field;
                break;
              case 'latitude':
                defaultMappings.lat = field;
                break;
              case 'longitude':
                defaultMappings.lng = field;
                break;
              case 'altitude':
                defaultMappings.alt = field;
                break;
            }
          }
          setColumnMapping(defaultMappings);
          setMappingConfirmed(false);
        },
      });
    }
    // Clear any existing CSV data until mapping confirmed
    setCsvData(undefined);
  }, [file]);

  useEffect(() => {
    setFilteredImageSize(0);
    setFilteredImageFiles([]);
  }, [name]);

  useEffect(() => {
    setImageFiles(
      scannedFiles.filter((file) => file.type.startsWith('image/jpeg'))
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
      // Always fetch existing files on S3 to determine upload count
      setListingS3Images(true);
      const { items } = await list({
        path: `images/${name}`,
        options: { bucket: 'inputs', listAll: true },
      });
      const existingFiles = items.reduce<Set<string>>((set, x) => {
        set.add(x.path.substring('images/'.length));
        return set;
      }, new Set());

      // Files to actually upload
      const uploadFiles = imageFiles.filter(
        (file) => !existingFiles.has(file.webkitRelativePath)
      );
      setToUploadFiles(uploadFiles);
      setToUploadSize(uploadFiles.reduce((acc, f) => acc + f.size, 0));

      // Files to show on map/exif: all for new project, only new for existing
      const mapFiles = newProject ? imageFiles : uploadFiles;
      setFilteredImageFiles(mapFiles);
      setListingS3Images(false);

      const gpsToCSVData: CsvFile = [];
      let missing = false;

      setScanCount(0);
      setScanTotal(mapFiles.length);
      setScanningEXIF(true);

      // Get EXIF metadata for each file
      const exifData = await Promise.all(
        mapFiles.map(async (file) => {
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
          setScanCount(prev => prev + 1);
          return updatedExif;
        })
      );

      setScanningEXIF(false);

      setMissingGpsData(missing);
      if (!missing) {
        setCsvData({
          data: gpsToCSVData,
        });
        setFullCsvData(gpsToCSVData);
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
  }, [imageFiles, name, newProject]);

  useEffect(() => {
    if (setGpsDataReady) {
      setGpsDataReady(
        !scanningEXIF &&
          filteredImageFiles.length > 0 &&
          (!missingGpsData || Boolean(csvData))
      );
    }
  }, [filteredImageFiles, missingGpsData, csvData, setGpsDataReady]);

  const handleFileInputChange = (files: File[]) => {
    if (files) {
      setScannedFiles(Array.from(files));
      setName(files[0].webkitRelativePath.split('/')[0]);
    }
  };

  async function getExifmeta(file: File) {
    const tags = await ExifReader.load(file);
    /* I am saving all of the exifdata to make it easier to answer questions about eg. lens used/ISO/shutterTime/aperture distributions later on. However, some
      EXIF fields are absolutely huge and make writing to my database impossibly slow. I explicitly drop those here*/
    delete tags['Thumbnail'];
    delete tags['Images'];
    delete tags['MakerNote'];
    for (const tag of Object.keys(tags)) {
      if (tags[tag]?.description?.length > 100) {
        console.log(
          `Tag ${tag} has a description longer than 100 characters. Dropping it.`
        );
        delete tags[tag];
      }
    }
    const rotated = (tags['Orientation']?.value as number) > 4;

    // Retrieve raw GPS values, allow number[] or string
    let lat: any = tags['GPSLatitude']?.value;
    let lng: any = tags['GPSLongitude']?.value;
    const latRef = tags['GPSLatitudeRef']?.value;
    const lngRef = tags['GPSLongitudeRef']?.value;

    // Convert coordinates to decimal degrees when value is an array
    if (Array.isArray(lat) && latRef) {
      lat = convertDMSToDD(lat as number[], latRef === 'N' ? 1 : -1);
    }
    if (Array.isArray(lng) && lngRef) {
      lng = convertDMSToDD(lng as number[], lngRef === 'E' ? 1 : -1);
    }

    // Parse EXIF original timestamp, fallback to file.lastModified
    let timestamp: number;
    const dateStr = tags.DateTimeOriginal?.description;
    if (typeof dateStr === 'string') {
      const dt = DateTime.fromFormat(dateStr, 'yyyy:MM:dd HH:mm:ss');
      if (dt.isValid) {
        timestamp = dt.toMillis();
      } else {
        console.warn(
          `Invalid EXIF DateTimeOriginal '${dateStr}' for ${file.webkitRelativePath}, falling back to file.lastModified`
        );
        timestamp = file.lastModified;
      }
    } else {
      console.warn(
        `No EXIF DateTimeOriginal for ${file.webkitRelativePath}, falling back to file.lastModified`
      );
      timestamp = file.lastModified;
    }
    return {
      key: file.webkitRelativePath,
      width: rotated ? tags['Image Height']?.value : tags['Image Width']?.value,
      height: rotated
        ? tags['Image Width']?.value
        : tags['Image Height']?.value,
      timestamp,
      cameraSerial: tags['Internal Serial Number']?.value,
      gpsData: {
        lat: lat?.toString(),
        lng: lng?.toString(),
        alt: tags['GPSAltitude']?.description,
      },
    };
  }

  // Helper function to convert DMS (Degrees, Minutes, Seconds) to decimal degrees
  function convertDMSToDD(dms: number[], sign: number): number {
    if (!Array.isArray(dms) || dms.length === 0) return 0;
    const degrees = dms[0] || 0;
    const minutes = dms[1] || 0;
    const seconds = dms[2] || 0;
    return sign * (degrees + minutes / 60 + seconds / 3600);
  }

  const interpolateGpsData = (
    csvData: { timestamp: number; lat: number; lng: number; alt: number }[],
    queryTimestamp: number
  ) => {
    if (csvData.length === 0) {
      throw new Error('No GPS data available for interpolation.');
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
      throw new Error('Extrapolation required for GPS data interpolation.');
    }
  };

  const handleSubmit = useCallback(
    async (projectId: string, fromStaleUpload?: boolean) => {
      if (!projectId) {
        alert('Survey is required');
        return;
      }

      if (!csvData) {
        alert('GPS metadata is required');
        return;
      }

      // Simplify return type to avoid complex union
      const imageSets: any[] = await (fetchAllPaginatedResults as any)(
        client.models.ImageSet.list,
        { filter: { projectId: { eq: projectId } }, selectionSet: ['id'] }
      );

      // only one image set exists for a survey
      if (imageSets.length === 0) {
        // Simplify return type to avoid complex union
        await (client.models.ImageSet.create as any)({
          name: name,
          projectId: projectId,
        });
      }

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

      const images = [];

      for (const file of gpsFilteredImageFiles) {
        const exifmeta = exifData[file.webkitRelativePath];
        let gpsData = null;

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
            console.warn('Timestamp outside of GPS data range');
          }
        } else {
          const csvRow = csvData.data.find(
            (row) => row.filepath === file.webkitRelativePath
          );
          if (csvRow) {
            gpsData = { lat: csvRow.lat, lng: csvRow.lng, alt: csvRow.alt };
          } else {
            console.warn(
              `No GPS data found for image ${file.webkitRelativePath}`
            );
          }
        }

        images.push({
          width: exifmeta.width,
          height: exifmeta.height,
          timestamp: Math.floor(exifmeta.timestamp / 1000),
          cameraSerial: exifmeta.cameraSerial,
          originalPath: file.webkitRelativePath,
          latitude: gpsData ? gpsData.lat : undefined,
          longitude: gpsData ? gpsData.lng : undefined,
          altitude_agl: gpsData ? gpsData.alt : undefined,
        });
      }

      //store image data & model in local storage
      await fileStore.setItem(projectId, images);
      await metadataStore.setItem(projectId, {
        model: model.value,
        masks: masks,
      });

      // push new task to upload manager
      setTask({
        projectId,
        newProject,
        fromStaleUpload: fromStaleUpload ?? false,
        files: gpsFilteredImageFiles,
        retryDelay: 0,
      });
    },
    [upload, filteredImageFiles, name, client, filteredImageSize, csvData]
  );

  useEffect(() => {
    // Disable submit if no images or if CSV loaded but no georeferenced points
    const hasData =
      filteredImageFiles.length > 0 && (!csvData || csvData.data.length > 0);
    setReadyToSubmit(hasData);
  }, [filteredImageFiles, csvData, setReadyToSubmit]);

  // Register the submit handler with the parent form if provided
  useEffect(() => {
    if (setOnSubmit) {
      setOnSubmit(() => handleSubmit);
    }
  }, [setOnSubmit, handleSubmit]);

  useEffect(() => {
    if (!file || !mappingConfirmed) return;
    async function transformFile(file: File) {
      // Check for GPX files by both type and extension
      if (
        file.type === 'text/gpx' ||
        file.name.toLowerCase().endsWith('.gpx')
      ) {
        setAssociateByTimestamp(true);

        const text = await file.text();
        const [gpxFile, error] = parseGPX(text);

        if (error) {
          console.error('Error parsing GPX file:', error);
          return;
        }

        if (!gpxFile.tracks || gpxFile.tracks.length === 0) {
          alert('No tracks found in GPX file');
          console.error('No tracks found in GPX file');
          return;
        }

        // Build raw GPX track points
        const rawPoints = gpxFile.tracks
          .flatMap((track) =>
            track.points.map((point) => ({
              timestamp: Number(point.time),
              lat: point.latitude,
              lng: point.longitude,
              alt: point.elevation || 0,
            }))
          )
          .sort((a, b) => a.timestamp - b.timestamp);

        // Georeference each image by EXIF timestamp
        const imagePoints = filteredImageFiles
          .map((imgFile) => {
            const meta = exifData[imgFile.webkitRelativePath];
            if (!meta) {
              console.warn(
                `No EXIF metadata for image ${imgFile.webkitRelativePath}`
              );
              return null;
            }
            const ts = meta.timestamp;
            if (
              ts < rawPoints[0].timestamp ||
              ts > rawPoints[rawPoints.length - 1].timestamp
            ) {
              console.warn(
                `Timestamp outside of GPX data range for image ${imgFile.webkitRelativePath}`
              );
              return null;
            }
            const exact = rawPoints.find((p) => p.timestamp === ts);
            const gps = exact ?? interpolateGpsData(rawPoints, ts);
            return {
              timestamp: ts,
              filepath: imgFile.webkitRelativePath,
              lat: gps.lat,
              lng: gps.lng,
              alt: gps.alt,
            };
          })
          .filter((pt) => pt !== null) as CsvFile;

        // Update CSV data and bounds for images
        setCsvData({ data: imagePoints });
        setFullCsvData(imagePoints);
        const imgTimestamps = imagePoints.map((pt) => pt.timestamp!);
        setMinTimestamp(Math.min(...imgTimestamps));
        setMaxTimestamp(Math.max(...imgTimestamps));

        // Initialize time ranges based on image timestamps
        const initialRanges: { [day: number]: { start: string; end: string } } =
          {};
        imagePoints.forEach(({ timestamp }) => {
          const date = new Date(timestamp!);
          const day = date.getUTCDate();
          const hours = date.getUTCHours().toString().padStart(2, '0');
          const minutes = date.getUTCMinutes().toString().padStart(2, '0');
          const timeStr = `${hours}:${minutes}`;
          if (!initialRanges[day]) {
            initialRanges[day] = { start: timeStr, end: timeStr };
          } else {
            if (timeStr < initialRanges[day].start)
              initialRanges[day].start = timeStr;
            if (timeStr > initialRanges[day].end)
              initialRanges[day].end = timeStr;
          }
        });
        setTimeRanges(initialRanges);

        return;
      }

      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: function (results) {
          // Apply user-defined column mapping
          const mappedData = (results.data as any[]).map((row: any) => {
            const newRow: any = { ...row };
            if (columnMapping.timestamp)
              newRow['Timestamp'] = row[columnMapping.timestamp];
            if (columnMapping.filepath)
              newRow['FilePath'] = row[columnMapping.filepath];
            if (columnMapping.lat) newRow['Latitude'] = row[columnMapping.lat];
            if (columnMapping.lng) newRow['Longitude'] = row[columnMapping.lng];
            if (columnMapping.alt) newRow['Altitude'] = row[columnMapping.alt];
            return newRow;
          });
          results.data = mappedData;

          const hasTimestamp = results.data.some(
            (row: any) => row['Timestamp']
          );
          const hasFilepath = results.data.some((row: any) => row['FilePath']);

          setAssociateByTimestamp(hasTimestamp && !hasFilepath);
          // Build raw CSV data
          const rawData = results.data
            .map((row: any) => ({
              timestamp: hasTimestamp
                ? timestampInMs
                  ? Number(row['Timestamp'])
                  : Number(row['Timestamp']) * 1000
                : undefined,
              filepath: hasFilepath ? row['FilePath'] : undefined,
              lat: Number(row['Latitude']),
              lng: Number(row['Longitude']),
              alt: Number(row['Altitude']),
            }))
            .sort((a, b) =>
              hasTimestamp
                ? a.timestamp! - b.timestamp!
                : a
                    .filepath!.toLowerCase()
                    .localeCompare(b.filepath!.toLowerCase())
            );
          if (hasTimestamp && !hasFilepath) {
            // Georeference each image by EXIF timestamp
            const imagePoints = filteredImageFiles
              .map((imgFile) => {
                const meta = exifData[imgFile.webkitRelativePath];
                if (!meta) {
                  console.warn(
                    `No EXIF metadata for image ${imgFile.webkitRelativePath}`
                  );
                  return null;
                }
                const ts = meta.timestamp;
                if (
                  rawData.length === 0 ||
                  ts < rawData[0].timestamp! ||
                  ts > rawData[rawData.length - 1].timestamp!
                ) {
                  console.warn(
                    `Timestamp outside of CSV data range for image ${imgFile.webkitRelativePath}`
                  );
                  return null;
                }
                const exact = rawData.find((p) => p.timestamp === ts);
                const gps =
                  exact ??
                  interpolateGpsData(
                    rawData.map((p) => ({
                      timestamp: p.timestamp!,
                      lat: p.lat,
                      lng: p.lng,
                      alt: p.alt,
                    })),
                    ts
                  );
                return {
                  timestamp: ts,
                  filepath: imgFile.webkitRelativePath,
                  lat: gps.lat,
                  lng: gps.lng,
                  alt: gps.alt,
                };
              })
              .filter((pt) => pt !== null) as CsvFile;
            setCsvData({ data: imagePoints });
            setFullCsvData(imagePoints);
            // Update bounds based on image points
            const imgTimestamps = imagePoints.map((pt) => pt.timestamp!);
            setMinTimestamp(Math.min(...imgTimestamps));
            setMaxTimestamp(Math.max(...imgTimestamps));

            // Initialize time ranges based on image timestamps
            const initialRanges: { [day: number]: { start: string; end: string } } = {};
            imagePoints.forEach(({ timestamp }) => {
              const date = new Date(timestamp!);
              const day = date.getUTCDate();
              const hours = date.getUTCHours().toString().padStart(2, '0');
              const minutes = date.getUTCMinutes().toString().padStart(2, '0');
              const timeStr = `${hours}:${minutes}`;
              if (!initialRanges[day]) {
                initialRanges[day] = { start: timeStr, end: timeStr };
              } else {
                if (timeStr < initialRanges[day].start) initialRanges[day].start = timeStr;
                if (timeStr > initialRanges[day].end) initialRanges[day].end = timeStr;
              }
            });
            setTimeRanges(initialRanges);
          } else if (!hasTimestamp && hasFilepath) {
            // Georeference each image by matching CSV filepaths
            const imagePoints = filteredImageFiles
              .map((imgFile) => {
                const match = rawData.find(
                  (row) =>
                    row.filepath?.toLowerCase() ===
                    imgFile.webkitRelativePath.toLowerCase()
                );
                if (!match) return null;
                return {
                  timestamp: match.timestamp,
                  filepath: imgFile.webkitRelativePath,
                  lat: match.lat,
                  lng: match.lng,
                  alt: match.alt,
                };
              })
              .filter((pt) => pt !== null) as CsvFile;
            setCsvData({ data: imagePoints });
            setFullCsvData(imagePoints);
          } else {
            // Use raw CSV data
            setCsvData({ data: rawData });
            setFullCsvData(rawData);
            if (hasTimestamp) {
              const timestamps = rawData.map((r) => r.timestamp!);
              setMinTimestamp(Math.min(...timestamps));
              setMaxTimestamp(Math.max(...timestamps));

              // Initialize time ranges based on CSV timestamps
              const initialRanges: { [day: number]: { start: string; end: string } } = {};
              rawData.forEach(({ timestamp }) => {
                if (timestamp === undefined) return;
                const date = new Date(timestamp!);
                const day = date.getUTCDate();
                const hours = date.getUTCHours().toString().padStart(2, '0');
                const minutes = date.getUTCMinutes().toString().padStart(2, '0');
                const timeStr = `${hours}:${minutes}`;
                if (!initialRanges[day]) {
                  initialRanges[day] = { start: timeStr, end: timeStr };
                } else {
                  if (timeStr < initialRanges[day].start) initialRanges[day].start = timeStr;
                  if (timeStr > initialRanges[day].end) initialRanges[day].end = timeStr;
                }
              });
              setTimeRanges(initialRanges);
            }
          }
        },
      });
    }

    if (file) {
      transformFile(file);
    }
  }, [file, mappingConfirmed]);

  // Update the time range for a given day.
  const updateTimeRange = (day: number, start: string, end: string) => {
    setTimeRanges((prev) => ({
      ...prev,
      [day]: { start, end },
    }));
  };

  // Helper: converts a "HH:mm" string to total minutes.
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Filter csvData rows by each day's selected time range.
  const applyTimeFilter = () => {
    if (!fullCsvData) return;
    const filtered = fullCsvData.filter((row) => {
      if (row.timestamp === undefined) return false;
      const date = new Date(row.timestamp!);
      const day = date.getUTCDate();
      const start = timeRanges[day]?.start || '00:00';
      const end = timeRanges[day]?.end || '23:59';
      const rowMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
      const startMinutes = timeToMinutes(start);
      const endMinutes = timeToMinutes(end);
      return rowMinutes >= startMinutes && rowMinutes <= endMinutes;
    });
    setCsvData({ data: filtered });
  };

  // Automatically re-filter when time ranges change
  useEffect(() => {
    if (associateByTimestamp) {
      applyTimeFilter();
    }
  }, [timeRanges, fullCsvData, associateByTimestamp]);

  // Common UI elements shared between modal and form versions
  return (
    <>
      <Form.Group>
        <Form.Label className='mb-0'>Model</Form.Label>
        <Form.Text
          className='d-block text-muted mt-0 mb-1'
          style={{ fontSize: 12 }}
        >
          Select the model you wish to use to guide annotation.
        </Form.Text>
        <Select
          className='text-black'
          value={model}
          options={[
            { label: 'ScoutBot', value: 'scoutbot' },
            {
              label: 'Elephant Detection Nadir',
              value: 'elephant-detection-nadir',
            },
            {
              label: 'Manual (images may be processed later)',
              value: 'manual',
            },
          ]}
          onChange={(e) => {
            if (e) setModel(e);
          }}
          placeholder='Select a model'
        />
      </Form.Group>
      <Form.Group>
        <Form.Label className='mb-0'>Files to Upload</Form.Label>
        <p className='text-muted mb-1' style={{ fontSize: 12 }}>
          Upload the survey files by selecting the entire folder you wish to
          upload.
        </p>
        <div
          className='p-2 mb-2 bg-white text-black'
          style={{ minHeight: '136px', overflow: 'auto' }}
        >
          {scannedFiles.length > 0 && (
            <code className='m-0 text-dark'>
              Folder name: {name}
              <br />
              Total files: {scannedFiles.length}
              <br />
              Image files: {imageFiles.length}
              <br />
              Image files size: {formatFileSize(totalImageSize)}
              <br />
              {listingS3Images ? (
                'Searching for images in S3...'
              ) : (
                <>
                  To upload: {toUploadFiles.length}
                  {toUploadFiles.length > 0 && (
                    <>
                      <br />
                      To upload size: {formatFileSize(toUploadSize)}
                    </>
                  )}
                </>
              )}
            </code>
          )}
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Form.Group>
            <FileInput
              id='filepicker'
              webkitdirectory=''
              onFileChange={handleFileInputChange}
            >
              <p style={{ margin: 0 }}>
                {scannedFiles.length > 0
                  ? 'Change source folder'
                  : 'Select Folder'}
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
      </Form.Group>
      {scanningEXIF ? (
        <div className='mt-3 mb-0'>
          <p className='mb-0'>Scanning images for GPS data: {`${scanCount}/${scanTotal}`}</p>
        </div>
      ) : Object.keys(exifData).length > 0 && imageFiles.length > 0 ? (
        <Form.Group className='mt-3 d-flex flex-column gap-2'>
          <div>
            <Form.Label className='mb-0'>
              {missingGpsData ? 'Missing GPS data' : 'GPS data found'}
            </Form.Label>
            <Form.Text className='d-block mb-0' style={{ fontSize: '12px' }}>
              {missingGpsData
                ? 'Some images do not have GPS data. Please upload the gpx or csv file containing the GPS data for all images.'
                : 'The selected images have GPS data. Would you like to upload a separate file containing the GPS data for all images?'}
            </Form.Text>
            <Form.Text className='d-block mb-0' style={{ fontSize: '12px' }}>
              If your data contains file paths instead of timestamps, the format
              should be:{' '}
              <code className='text-primary' style={{ fontSize: '14px' }}>
                {imageFiles[0].webkitRelativePath}
              </code>
            </Form.Text>
          </div>
          <FileInput
            id='gps-metadata-file'
            fileType='.csv,.gpx'
            onFileChange={(files) => setFile(files[0])}
          >
            <p className='mb-0'>Select GPS metadata file</p>
          </FileInput>
        </Form.Group>
      ) : null}
      {headerFields && !mappingConfirmed && (
        <Form.Group className='mt-3'>
          <Form.Label className='mb-0'>Confirm File Structure</Form.Label>
          <p className='text-muted mb-1' style={{ fontSize: 12 }}>
            Select which columns from your file correspond to the following
            fields:
          </p>
          <div className='d-flex flex-column gap-2'>
            <div className='d-flex flex-row gap-2 align-items-center'>
              <div style={{ flex: 0.5 }}>
                <Form.Label className='mb-0'>FilePath (optional)</Form.Label>
                <Select
                  options={[
                    { label: 'None', value: '' },
                    ...headerFields.map((f) => ({ label: f, value: f })),
                  ]}
                  value={
                    columnMapping.filepath
                      ? {
                          label: columnMapping.filepath,
                          value: columnMapping.filepath,
                        }
                      : { label: 'None', value: '' }
                  }
                  onChange={(opt) =>
                    setColumnMapping({
                      ...columnMapping,
                      filepath: opt ? opt.value : undefined,
                    })
                  }
                  placeholder='Select FilePath column'
                  className='text-black'
                />
              </div>
              <p
                className='mb-0'
                style={{ width: '50px', textAlign: 'center' }}
              >
                or
              </p>
              <div style={{ flex: 0.5 }}>
                <div className='d-flex flex-row gap-2 align-items-center justify-content-between'>
                  <Form.Label className='mb-0'>Timestamp (optional)</Form.Label>
                  <div className='d-flex flex-row gap-2 align-items-center'>
                    <label className='me-2'>ms</label>
                    <Form.Check
                      type='switch'
                      id='timestamp-in-ms'
                      checked={!timestampInMs}
                      onChange={(e) => setTimestampInMs(!e.target.checked)}
                    />
                    <label>s</label>
                  </div>
                </div>
                <Select
                  options={[
                    { label: 'None', value: '' },
                    ...headerFields.map((f) => ({ label: f, value: f })),
                  ]}
                  value={
                    columnMapping.timestamp
                      ? {
                          label: columnMapping.timestamp,
                          value: columnMapping.timestamp,
                        }
                      : { label: 'None', value: '' }
                  }
                  onChange={(opt) =>
                    setColumnMapping({
                      ...columnMapping,
                      timestamp: opt ? opt.value : undefined,
                    })
                  }
                  placeholder='Select Timestamp column'
                  className='text-black'
                />
              </div>
            </div>
            <div>
              <Form.Label className='mb-0'>Latitude</Form.Label>
              <Select
                options={headerFields.map((f) => ({ label: f, value: f }))}
                value={
                  columnMapping.lat
                    ? { label: columnMapping.lat, value: columnMapping.lat }
                    : null
                }
                onChange={(opt) =>
                  setColumnMapping({
                    ...columnMapping,
                    lat: opt ? opt.value : undefined,
                  })
                }
                placeholder='Select Latitude column'
                className='text-black'
              />
            </div>
            <div>
              <Form.Label className='mb-0'>Longitude</Form.Label>
              <Select
                options={headerFields.map((f) => ({ label: f, value: f }))}
                value={
                  columnMapping.lng
                    ? { label: columnMapping.lng, value: columnMapping.lng }
                    : null
                }
                onChange={(opt) =>
                  setColumnMapping({
                    ...columnMapping,
                    lng: opt ? opt.value : undefined,
                  })
                }
                placeholder='Select Longitude column'
                className='text-black'
              />
            </div>
            <div>
              <Form.Label className='mb-0'>Altitude (optional)</Form.Label>
              <Select
                options={[
                  { label: 'None', value: '' },
                  ...headerFields.map((f) => ({ label: f, value: f })),
                ]}
                value={
                  columnMapping.alt
                    ? { label: columnMapping.alt, value: columnMapping.alt }
                    : { label: 'None', value: '' }
                }
                onChange={(opt) =>
                  setColumnMapping({
                    ...columnMapping,
                    alt: opt && opt.value ? opt.value : undefined,
                  })
                }
                placeholder='Select Altitude column'
                className='text-black'
              />
            </div>
          </div>
          <Button
            variant='primary'
            className='mt-2'
            onClick={handleConfirmMapping}
          >
            Confirm File Structure
          </Button>
        </Form.Group>
      )}
      {csvData && (
        <>
          <GPSSubset
            gpsData={csvData.data}
            imageFiles={imageFiles}
            onFilter={(filteredData) => {
              setCsvData((prevData) => ({ ...prevData, data: filteredData }));
            }}
          />
          {associateByTimestamp && (
            <Form.Group>
              <Form.Label className='mb-0'>
                Filter Data by Time Range (Optional)
              </Form.Label>
              <Form.Text
                className='d-block mb-1 mt-0'
                style={{ fontSize: '12px' }}
              >
                Select the effective time range for each day. The default range
                is the earliest and latest timestamp recorded for that day.
              </Form.Text>
              <Form.Text
                className='d-block mb-1'
                style={{ fontSize: '12px', fontStyle: 'italic' }}
              >
                All times shown in UTC.
              </Form.Text>
              <div className='d-flex flex-column gap-2'>
                {Array.from(
                  new Set(
                    csvData.data.map((row) =>
                      new Date(row.timestamp!).getUTCDate()
                    )
                  )
                )
                  .sort((a: number, b: number) => a - b)
                  .map((day: number) => (
                    <div
                      key={`day-${day}`}
                      className='d-flex flex-row align-items-center gap-2'
                    >
                      <span className='me-2'>
                        {new Date(
                          csvData.data[0].timestamp!
                        ).toLocaleDateString()}
                      </span>
                      <input
                        type='time'
                        value={timeRanges[day]?.start || '00:00'}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateTimeRange(
                            day,
                            e.target.value,
                            timeRanges[day]?.end || '23:59'
                          )
                        }
                      />
                      <input
                        type='time'
                        value={timeRanges[day]?.end || '23:59'}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          updateTimeRange(
                            day,
                            timeRanges[day]?.start || '00:00',
                            e.target.value
                          )
                        }
                      />
                    </div>
                  ))}
              </div>
            </Form.Group>
          )}
        </>
      )}
      {csvData && (
        <div className='mt-3'>
          {(() => {
            let message = '';
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
                const formatTimestamp = (timestamp: number) =>
                  new Date(timestamp).toLocaleString(undefined, {
                    timeZone: 'UTC',
                  }) + ' UTC';
                if (csvMin < minTimestamp || csvMax > maxTimestamp) {
                  message = `Timestamp mismatch: CSV timestamps (${formatTimestamp(
                    csvMin
                  )} - ${formatTimestamp(
                    csvMax
                  )}) are outside the image timestamps range.`;
                } else {
                  message = `Timestamp range valid: CSV timestamps (${formatTimestamp(
                    csvMin
                  )} - ${formatTimestamp(
                    csvMax
                  )}) are within the image timestamps range.`;
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
            const hasData = csvData.data.length > 0;
            const alertClass = hasData ? 'alert-info' : 'alert-danger';
            const displayMessage = hasData
              ? message
              : 'No matching GPS data for selected images.';
            return (
              <div className={`alert ${alertClass} mb-0`}>{displayMessage}</div>
            );
          })()}
        </div>
      )}
      {filteredImageFiles.length > 0 && <ImageMaskEditor setMasks={setMasks} />}
    </>
  );
}

// Form-compatible version that can be integrated into another form
export function FilesUploadForm(props: FilesUploadFormProps) {
  return <FileUploadCore {...props} />;
}

export const formatFileSize = (bytes: number): string => {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
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
  fromStaleUpload,
}: FilesUploadComponentProps) {
  const { client } = useContext(GlobalContext)!;
  const [uploadSubmitFn, setUploadSubmitFn] = useState<
    ((projectId: string, fromStaleUpload?: boolean) => Promise<void>) | null
  >(null);
  const [readyToSubmit, setReadyToSubmit] = useState(false);

  // Modal version needs to handle its own submit
  const handleModalSubmit = async () => {
    // Close the modal first, so the user doesn't experience the UI as unresponsive

    if (uploadSubmitFn && project?.id) {
      // Simplify return type to avoid complex union
      await (client.models.Project.update as any)({
        id: project.id,
        status: 'uploading',
      });

      handleClose();

      await uploadSubmitFn(project.id, fromStaleUpload);
    }
  };

  return (
    <Modal show={show} onHide={handleClose} size='xl'>
      <Modal.Header closeButton>
        <Modal.Title>
          {fromStaleUpload ? 'Resume upload: ' : 'Add files: '}
          {project?.name}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          {fromStaleUpload && (
            <p className='mb-2 text-warning'>
              This survey&apos;s upload is stale.
              <br />
              Complete the form to continue - only the remaining images will be
              uploaded.
            </p>
          )}
          <FileUploadCore
            project={project}
            setOnSubmit={setUploadSubmitFn}
            setReadyToSubmit={setReadyToSubmit}
            newProject={false}
          />
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant='primary'
          disabled={!readyToSubmit}
          onClick={handleModalSubmit}
        >
          Submit
        </Button>
        <Button variant='dark' onClick={handleClose}>
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
