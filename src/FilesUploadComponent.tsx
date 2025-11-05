import { useEffect, useState, useContext, useCallback, useMemo } from 'react';
// import moment from 'moment'
// import {MD5,enc} from 'crypto-js'
import Modal from 'react-bootstrap/Modal';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import { list } from 'aws-amplify/storage';
import { GlobalContext, UploadContext } from './Context.tsx';
import exifr from 'exifr';
import { DateTime } from 'luxon';
import { fetchAllPaginatedResults } from './utils';
import Papa from 'papaparse';
import GPSSubset from './GPSSubset';
import { parseGPX } from '@we-gold/gpxjs';
import FileInput from './FileInput';
import FolderStructure from './FolderStructure';
import ImageMaskEditor from './ImageMaskEditor.tsx';
import Select from 'react-select';
import localforage from 'localforage';
import CameraOverlap from './CameraOverlap';
import CameraSpecification from './CameraSpecification';
import LabeledToggleSwitch from './LabeledToggleSwitch.tsx';
import { Schema } from './amplify/client-schema.ts';
import Slider from 'rc-slider';
import 'rc-slider/assets/index.css';
import UTM from 'utm-latlng';

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
  onShapefileParsed?: (latLngs: [number, number][]) => void;
}

// Props for form-compatible version
interface FilesUploadFormProps extends FilesUploadBaseProps {}

export type CameraSpec = {
  focalLengthMm: number;
  sensorWidthMm: number;
  tiltDegrees: number;
};

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
    timezone?: string;
  }
>;

type ImageExif = {
  key: string;
  width: number;
  height: number;
  timestamp: number;
  cameraSerial: string;
  gpsData: GpsData | null;
  timezone?: string;
};

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

type NormalizedGps = {
  lat: number;
  lng: number;
  alt?: number;
};

const isFiniteWithinRange = (
  value: unknown,
  min: number,
  max: number
): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

const hasValidLatLng = (lat: unknown, lng: unknown): boolean =>
  isFiniteWithinRange(lat, -90, 90) && isFiniteWithinRange(lng, -180, 180);

// Core functionality shared between modal and form versions
export function FileUploadCore({
  setOnSubmit,
  setReadyToSubmit,
  setGpsDataReady,
  newProject = true,
  onShapefileParsed,
  project,
}: FilesUploadBaseProps) {
  const [name, setName] = useState('');
  const { client } = useContext(GlobalContext)!;
  const [scannedFiles, setScannedFiles] = useState<File[]>([]);
  const [cameraSelection, setCameraSelection] = useState<
    [string, string[]] | null
  >(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [filteredImageFiles, setFilteredImageFiles] = useState<File[]>([]);
  const { setTask } = useContext(UploadContext)!;
  const [totalImageSize, setTotalImageSize] = useState(0);
  const [exifData, setExifData] = useState<ExifData>({});
  const [commonTimezone, setCommonTimezone] = useState<string | undefined>(
    undefined
  );
  const [missingGpsData, setMissingGpsData] = useState(false);
  const [associateByTimestamp, setAssociateByTimestamp] = useState(false);
  const [minTimestamp, setMinTimestamp] = useState(0);
  const [maxTimestamp, setMaxTimestamp] = useState(0);
  const [file, setFile] = useState<File | undefined>();
  const [scanningEXIF, setScanningEXIF] = useState(false);
  const [csvData, setCsvData] = useState<CsvData | undefined>(undefined);
  const [fullCsvData, setFullCsvData] = useState<CsvFile | undefined>(
    undefined
  );
  const [listingS3Images, setListingS3Images] = useState(false);
  const [timeRanges, setTimeRanges] = useState<{
    [day: number]: { start: string; end: string };
  }>({});
  const [cameraSpecs, setCameraSpecs] = useState<Record<string, CameraSpec>>(
    {}
  );
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
  const [overlaps, setOverlaps] = useState<
    { cameraA: string; cameraB: string }[]
  >([]);
  const [multipleCameras, setMultipleCameras] = useState(false);
  const [altitudeInMeters, setAltitudeInMeters] = useState(true);
  const [altitudeType, setAltitudeType] = useState({
    label: 'EGM96',
    value: 'egm96',
  });
  const altitudeTypeOptions = [
    { label: 'EGM96', value: 'egm96' },
    { label: 'WGS84', value: 'wgs84' },
    { label: 'AGL', value: 'agl' },
  ];
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
  // UTM handling
  const [useUtm, setUseUtm] = useState(false);
  const [utmColumn, setUtmColumn] = useState<string | undefined>(undefined);

  // Helper function to convert altitude from feet to meters if needed
  const convertAltitude = (altitude: number): number => {
    if (!altitudeInMeters) {
      // Convert feet to meters (1 foot = 0.3048 meters)
      return altitude * 0.3048;
    }
    return altitude;
  };

  // Prefetched existing cameras for the project (modal flow)
  const [existingCameraNames, setExistingCameraNames] = useState<string[]>([]);
  const [loadingExistingCameras, setLoadingExistingCameras] = useState(false);

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
    if (!useUtm) {
      if (!latCol || !lngCol) {
        alert('Please map the Latitude and Longitude columns.');
        return;
      }
    } else {
      if (!utmColumn) {
        alert('Please select the UTM column.');
        return;
      }
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

          // UTM auto-detect: choose a column that contains "utm" in its name
          const utmCandidate = (results.meta.fields || []).find((f) =>
            /utm/i.test(f)
          );
          if (utmCandidate) {
            setUtmColumn(utmCandidate);
            setUseUtm(true);
          } else {
            setUtmColumn(undefined);
            setUseUtm(false);
          }
        },
      });
    }
    // Clear any existing CSV data until mapping confirmed
    setCsvData(undefined);
  }, [file]);

  useEffect(() => {
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
    if (!multipleCameras) {
      setOverlaps([]);
    }
  }, [multipleCameras]);

  useEffect(() => {
    async function getExistingFiles() {
      // Always fetch existing files on S3 to determine upload count
      setListingS3Images(true);
      // Only consider S3 keys that match the currently scanned local files for this upload
      const localPaths = new Set(imageFiles.map((f) => f.webkitRelativePath));
      const prefixes = Array.from(
        new Set(
          Array.from(localPaths)
            .map((p) => (p.split(/[/\\]/)[0] || '').trim())
            .filter((p) => p.length > 0)
        )
      );

      const allItems: { path: string }[] = [];
      // Try to use new key structure: images/{organizationId}/{projectId}/{originalPath}
      let usedNewPrefix = false;
      let projOrgId: string | undefined = undefined;
      let projIsLegacy = true;
      try {
        if (!newProject && project?.id) {
          const { data: proj } = await client.models.Project.get(
            { id: project.id },
            { selectionSet: ['id', 'organizationId', 'tags'] as const }
          );
          const orgId =
            typeof proj?.organizationId === 'string'
              ? proj.organizationId
              : undefined;
          const tagsVal = proj?.tags;
          const isLegacy = Array.isArray(tagsVal)
            ? tagsVal.some((t) => t === 'legacy')
            : false;
          projOrgId = orgId;
          projIsLegacy = isLegacy;
          if (orgId && !isLegacy) {
            const listPrefix = `images/${orgId}/${project.id}/`;
            const { items } = await list({
              path: listPrefix,
              options: { bucket: 'inputs', listAll: true },
            });
            allItems.push(...items);
            usedNewPrefix = true;
          }
        }
      } catch {
        // Fallback to legacy listing below
      }
      // Legacy structure or fallback: list by top-level folder prefixes
      if (!usedNewPrefix) {
        for (const prefix of prefixes) {
          const { items } = await list({
            path: `images/${prefix}/`,
            options: { bucket: 'inputs', listAll: true },
          });
          allItems.push(...items);
        }
      }

      const existingFiles = allItems.reduce<Set<string>>((set, x) => {
        const keyWithoutImages = x.path.substring('images/'.length);
        if (!projIsLegacy && projOrgId && project?.id) {
          const newPrefix = `${projOrgId}/${project.id}/`;
          if (!keyWithoutImages.startsWith(newPrefix)) return set;
          const candidateOriginalPath = keyWithoutImages.substring(
            newPrefix.length
          );
          if (localPaths.has(candidateOriginalPath)) {
            set.add(candidateOriginalPath);
          }
        } else {
          if (localPaths.has(keyWithoutImages)) {
            set.add(keyWithoutImages);
          }
        }
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

      // Get EXIF metadata for each file (sample first, then selective fast path if no GPS)
      const sampleSize = Math.min(5, mapFiles.length);
      const sampleFiles = mapFiles.slice(0, sampleSize);
      const restFiles = mapFiles.slice(sampleSize);

      // Sample with full EXIF to check for GPS
      const sampleRaw: ImageExif[] = await Promise.all(
        sampleFiles.map(async (file) => {
          const exif = await getExifmeta(file);

          // Validate and convert GPS data
          let gpsData: GpsData | null = null;
          if (exif.gpsData.alt && exif.gpsData.lat && exif.gpsData.lng) {
            const lat = Number(exif.gpsData.lat);
            const lng = Number(exif.gpsData.lng);
            // Only set GPS data if coordinates are valid and in range
            if (
              Number.isFinite(lat) &&
              Number.isFinite(lng) &&
              lat >= -90 &&
              lat <= 90 &&
              lng >= -180 &&
              lng <= 180
            ) {
              gpsData = {
                lat,
                lng,
                alt: convertAltitude(Number(exif.gpsData.alt)),
              };
            }
          }

          const updatedExif: ImageExif = {
            ...exif,
            width: exif.width || 0,
            height: exif.height || 0,
            gpsData,
          };
          return updatedExif;
        })
      );
      setScanCount((prev) => prev + sampleRaw.length);

      const gpsLikely = sampleRaw.some((x) => x.gpsData !== null);
      const extractor = gpsLikely ? getExifmeta : getTimestampOnlyExif;

      for (const updatedExif of sampleRaw) {
        if (updatedExif.gpsData === null) {
          missing = true;
        } else {
          gpsToCSVData.push({
            timestamp: updatedExif.timestamp,
            lat: updatedExif.gpsData.lat as number,
            lng: updatedExif.gpsData.lng as number,
            alt: convertAltitude(updatedExif.gpsData.alt as number),
          });
        }
      }

      // Process the rest with limited concurrency using chosen extractor
      const restRaw: ImageExif[] = await mapWithLimit(
        restFiles,
        4,
        async (file) => {
          const exif = (await extractor(file as File)) as ImageExif;

          // Validate and convert GPS data
          let gpsData: GpsData | null = null;
          if (
            exif.gpsData &&
            (exif.gpsData as any).alt !== undefined &&
            (exif.gpsData as any).lat !== undefined &&
            (exif.gpsData as any).lng !== undefined
          ) {
            const lat = Number((exif.gpsData as any).lat);
            const lng = Number((exif.gpsData as any).lng);
            // Only set GPS data if coordinates are valid and in range
            if (
              Number.isFinite(lat) &&
              Number.isFinite(lng) &&
              lat >= -90 &&
              lat <= 90 &&
              lng >= -180 &&
              lng <= 180
            ) {
              gpsData = {
                lat,
                lng,
                alt: convertAltitude(Number((exif.gpsData as any).alt)),
              };
            }
          }

          const updatedExif: ImageExif = {
            ...exif,
            width: exif.width || 0,
            height: exif.height || 0,
            gpsData,
          };
          return updatedExif;
        },
        () => setScanCount((prev) => prev + 1)
      );

      for (const updatedExif of restRaw) {
        if (updatedExif.gpsData === null) {
          missing = true;
        } else {
          gpsToCSVData.push({
            timestamp: updatedExif.timestamp,
            lat: (updatedExif.gpsData as any).lat as number,
            lng: (updatedExif.gpsData as any).lng as number,
            alt: convertAltitude((updatedExif.gpsData as any).alt as number),
          });
        }
      }

      const exifData: ImageExif[] = [...sampleRaw, ...restRaw];

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
        (exifData as ImageExif[]).reduce((acc, x) => {
          acc[x.key] = x;
          return acc;
        }, {} as ExifData)
      );

      // Extract common timezone from EXIF data
      const timezones = (exifData as ImageExif[])
        .map((e) => e.timezone)
        .filter(Boolean) as string[];
      const mostCommonTimezone =
        timezones.length > 0 ? timezones[0] : undefined;
      setCommonTimezone(mostCommonTimezone);
    }
    if (imageFiles.length > 0) {
      getExistingFiles();
    }
  }, [imageFiles, name, newProject]);

  useEffect(() => {
    if (!multipleCameras) {
      setCameraSelection(['Survey Level', ['Survey Camera']]);
      setOverlaps([]);
    }
  }, [multipleCameras]);

  useEffect(() => {
    if (!project || !project.id) {
      setExistingCameraNames([]);
      return;
    }
    const projectId = project.id;
    let cancelled = false;
    async function fetchExistingCameras() {
      try {
        setLoadingExistingCameras(true);
        const { data } = await client.models.Camera.camerasByProjectId({
          projectId,
        });
        if (!cancelled) {
          setExistingCameraNames(
            (data || []).map((c) => c.name).filter(Boolean)
          );
        }
      } finally {
        if (!cancelled) setLoadingExistingCameras(false);
      }
    }
    fetchExistingCameras();
    return () => {
      cancelled = true;
    };
  }, [client, project?.id]);

  const handleFileInputChange = (files: File[]) => {
    if (files) {
      setScannedFiles(Array.from(files));
      setName(files[0].webkitRelativePath.split('/')[0]);
    }
  };

  async function getExifmeta(file: File) {
    const tags = await exifr.parse(file, {
      pick: [
        'DateTimeOriginal',
        'OffsetTimeOriginal',
        'Orientation',
        'ImageWidth',
        'ImageHeight',
        'ExifImageWidth',
        'ExifImageHeight',
        'InternalSerialNumber',
        'GPSLatitude',
        'GPSLongitude',
        'GPSLatitudeRef',
        'GPSLongitudeRef',
        'GPSAltitude',
        // convenience props sometimes provided by exifr
        'latitude',
        'longitude',
      ],
    });

    const orientation = tags?.Orientation ?? 1;
    const rotated = orientationRequiresSwap(orientation);

    // Build timestamp from DateTimeOriginal + OffsetTimeOriginal (if any)
    let timestamp: number;
    const dto = tags?.DateTimeOriginal as Date | string | undefined;
    const tz = tags?.OffsetTimeOriginal as string | undefined;
    if (dto instanceof Date) {
      timestamp = dto.getTime();
    } else if (typeof dto === 'string' && dto.length > 0) {
      const dt = DateTime.fromFormat(dto, 'yyyy:MM:dd HH:mm:ss', { zone: tz });
      timestamp = dt.isValid ? dt.toMillis() : file.lastModified;
    } else {
      timestamp = file.lastModified;
    }

    const imageWidth = tags?.ImageWidth ?? tags?.ExifImageWidth ?? 0;
    const imageHeight = tags?.ImageHeight ?? tags?.ExifImageHeight ?? 0;

    // GPS handling: prefer decimal latitude/longitude if provided, else compute from DMS
    let lat: any = tags?.latitude ?? tags?.GPSLatitude;
    let lng: any = tags?.longitude ?? tags?.GPSLongitude;
    const latRef = tags?.GPSLatitudeRef;
    const lngRef = tags?.GPSLongitudeRef;

    if (Array.isArray(lat) && latRef) {
      lat = convertDMSToDD(lat as number[], latRef === 'N' ? 1 : -1);
    }
    if (Array.isArray(lng) && lngRef) {
      lng = convertDMSToDD(lng as number[], lngRef === 'E' ? 1 : -1);
    }

    return {
      key: file.webkitRelativePath,
      width: rotated ? imageHeight : imageWidth,
      height: rotated ? imageWidth : imageHeight,
      timestamp,
      cameraSerial: tags?.InternalSerialNumber ?? '',
      gpsData: {
        lat: lat?.toString(),
        lng: lng?.toString(),
        alt:
          (tags?.GPSAltitude as any)?.toString?.() ??
          (tags?.GPSAltitude as any),
      },
      timezone: tz,
    };
  }

  // Detect and parse timestamp from various formats
  function detectAndParseTimestamp(
    value: any,
    fallbackTimezone?: string
  ): number | null {
    if (!value) return null;
    const str = typeof value === 'string' ? value.trim() : String(value);

    // Try EXIF format: yyyy:MM:dd HH:mm:ss
    const exifFormatMatch = /^\d{4}:\d{2}:\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(str);
    if (exifFormatMatch) {
      const dt = DateTime.fromFormat(str, 'yyyy:MM:dd HH:mm:ss', {
        zone: fallbackTimezone,
      });
      if (dt.isValid) return dt.toMillis();
    }

    // Try ISO-like format: yyyy-MM-dd HH:mm:ss
    const isoFormatMatch = /^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}$/.test(str);
    if (isoFormatMatch) {
      const dt = DateTime.fromFormat(str, 'yyyy-MM-dd HH:mm:ss', {
        zone: fallbackTimezone,
      });
      if (dt.isValid) return dt.toMillis();
    }

    // Try US date format: M/d/yyyy h:mm:ss or MM/dd/yyyy HH:mm:ss
    const usDateMatch = /^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}$/.test(
      str
    );
    if (usDateMatch) {
      const dt = DateTime.fromFormat(str, 'M/d/yyyy h:mm:ss', {
        zone: fallbackTimezone,
      });
      if (dt.isValid) return dt.toMillis();
    }

    // Try US date format with AM/PM: M/d/yyyy h:mm:ss a
    const usDateAmPmMatch =
      /^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}\s+[AP]M$/i.test(str);
    if (usDateAmPmMatch) {
      const dt = DateTime.fromFormat(str, 'M/d/yyyy h:mm:ss a', {
        zone: fallbackTimezone,
      });
      if (dt.isValid) return dt.toMillis();
    }

    // Try ISO 8601 format: yyyy-MM-ddTHH:mm:ss
    const iso8601Match = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(str);
    if (iso8601Match) {
      const dt = DateTime.fromFormat(str, 'yyyy-MM-ddTHH:mm:ss', {
        zone: fallbackTimezone,
      });
      if (dt.isValid) return dt.toMillis();
    }

    // Try ISO 8601 with Z: yyyy-MM-ddTHH:mm:ssZ
    const iso8601ZMatch = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/i.test(str);
    if (iso8601ZMatch) {
      const dt = DateTime.fromFormat(str, 'yyyy-MM-ddTHH:mm:ssZ', {
        zone: 'utc',
      });
      if (dt.isValid) return dt.toMillis();
    }

    // Try numeric (epoch timestamp)
    const num = Number(str);
    if (Number.isFinite(num) && num > 0) {
      // Auto-detect ms vs seconds: >= 1e12 is milliseconds
      return num >= 1e12 ? num : num * 1000;
    }

    return null;
  }

  // Parse common UTM string formats like: "33S 500000 4649776" or "500000 4649776 33S"
  function parseUtmString(
    utmStr: unknown
  ): { lat: number; lng: number } | null {
    if (!utmStr || typeof utmStr !== 'string') return null;
    const s = utmStr.trim().replace(/,/g, ' ').replace(/\s+/g, ' ');
    // Try patterns
    // 1) ZoneLetter first: "33S 500000 4649776"
    let m = s.match(
      /^(\d{1,2})([C-HJ-NP-X])\s+([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)$/i
    );
    let zoneNum: number | null = null;
    let zoneLetter: string | null = null;
    let easting: number | null = null;
    let northing: number | null = null;
    if (m) {
      zoneNum = Number(m[1]);
      zoneLetter = m[2].toUpperCase();
      easting = Number(m[3]);
      northing = Number(m[4]);
    } else {
      // 2) Coordinates first: "500000 4649776 33S"
      m = s.match(
        /^([0-9]+(?:\.[0-9]+)?)\s+([0-9]+(?:\.[0-9]+)?)\s+(\d{1,2})([C-HJ-NP-X])$/i
      );
      if (m) {
        easting = Number(m[1]);
        northing = Number(m[2]);
        zoneNum = Number(m[3]);
        zoneLetter = m[4].toUpperCase();
      } else {
        // 3) Tokens fallback
        const tokens = s.split(' ');
        const zl = tokens.find((t) => /^(\d{1,2})([C-HJ-NP-X])$/i.test(t));
        const nums = tokens.filter((t) => /^[0-9]+(?:\.[0-9]+)?$/.test(t));
        if (zl && nums.length >= 2) {
          const mm = zl.match(/^(\d{1,2})([C-HJ-NP-X])$/i)!;
          zoneNum = Number(mm[1]);
          zoneLetter = mm[2].toUpperCase();
          easting = Number(nums[0]);
          northing = Number(nums[1]);
        }
      }
    }
    if (
      zoneNum === null ||
      !zoneLetter ||
      easting === null ||
      northing === null
    )
      return null;
    try {
      const converter = new UTM();
      const res = converter.convertUtmToLatLng(
        easting,
        northing,
        zoneNum,
        zoneLetter
      );
      if (res && typeof res === 'object') {
        const record = res as Record<string, unknown>;
        const latCandidate = record.lat ?? record.Lat;
        const lngCandidate = record.lng ?? record.Lon;
        if (hasValidLatLng(latCandidate, lngCandidate)) {
          return {
            lat: latCandidate as number,
            lng: lngCandidate as number,
          };
        }
      }
    } catch {}
    return null;
  }

  // Helper function to convert DMS (Degrees, Minutes, Seconds) to decimal degrees
  function convertDMSToDD(dms: number[], sign: number): number {
    if (!Array.isArray(dms) || dms.length === 0) return 0;
    const degrees = dms[0] || 0;
    const minutes = dms[1] || 0;
    const seconds = dms[2] || 0;
    return sign * (degrees + minutes / 60 + seconds / 3600);
  }

  function orientationRequiresSwap(orientation: unknown): boolean {
    if (typeof orientation === 'number') {
      return orientation > 4;
    }
    if (typeof orientation === 'string') {
      const o = orientation.toLowerCase();
      return (
        o.includes('90') ||
        o.includes('270') ||
        o.includes('transpose') ||
        o.includes('transverse') ||
        o.includes('mirror horizontal and rotate') ||
        o.includes('mirror vertical and rotate')
      );
    }
    return false;
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

  // Fast path: read only timestamp and a few lightweight fields using exifr
  async function getTimestampOnlyExif(file: File) {
    const tags = await exifr.parse(file, {
      pick: [
        'DateTimeOriginal',
        'OffsetTimeOriginal',
        'Orientation',
        'ImageWidth',
        'ImageHeight',
        'ExifImageWidth',
        'ExifImageHeight',
        'InternalSerialNumber',
      ],
    });

    const orientation = (tags as any)?.Orientation ?? 1;
    const rotated = orientationRequiresSwap(orientation);

    // Build timestamp from DateTimeOriginal + OffsetTimeOriginal (if any)
    let timestamp: number;
    const dto = (tags as any)?.DateTimeOriginal;
    const tz = (tags as any)?.OffsetTimeOriginal as string | undefined;
    if (dto instanceof Date) {
      timestamp = dto.getTime();
    } else if (typeof dto === 'string' && dto.length > 0) {
      const dt = DateTime.fromFormat(dto, 'yyyy:MM:dd HH:mm:ss', { zone: tz });
      timestamp = dt.isValid ? dt.toMillis() : file.lastModified;
    } else {
      timestamp = file.lastModified;
    }

    const imageWidth =
      (tags as any)?.ImageWidth ?? (tags as any)?.ExifImageWidth ?? 0;
    const imageHeight =
      (tags as any)?.ImageHeight ?? (tags as any)?.ExifImageHeight ?? 0;

    return {
      key: file.webkitRelativePath,
      width: rotated ? imageHeight : imageWidth,
      height: rotated ? imageWidth : imageHeight,
      timestamp,
      cameraSerial: (tags as any)?.InternalSerialNumber ?? '',
      gpsData: null as GpsData | null,
      timezone: tz,
    };
  }

  const getGpsForFile = useCallback(
    (sourceFile: File): NormalizedGps | null => {
      const exifmeta = exifData[sourceFile.webkitRelativePath];
      if (!exifmeta) {
        return null;
      }

      const pickFromExif = () => {
        const gps = exifmeta.gpsData;
        if (!gps) return null;
        const latNum = typeof gps.lat === 'number' ? gps.lat : Number(gps.lat);
        const lngNum = typeof gps.lng === 'number' ? gps.lng : Number(gps.lng);
        const altNum =
          gps.alt === undefined || gps.alt === null ? undefined : Number(gps.alt);
        if (!hasValidLatLng(latNum, lngNum)) {
          return null;
        }
        const normalized: NormalizedGps = {
          lat: latNum,
          lng: lngNum,
          alt:
            altNum !== undefined && Number.isFinite(altNum)
              ? convertAltitude(altNum)
              : undefined,
        };
        return normalized;
      };

      if (!csvData || csvData.data.length === 0) {
        return pickFromExif();
      }

      if (associateByTimestamp) {
        const timestamp = exifmeta.timestamp;
        const exactRow = csvData.data.find((row) => row.timestamp === timestamp);
        if (exactRow && hasValidLatLng(exactRow.lat, exactRow.lng)) {
          const alt =
            typeof exactRow.alt === 'number' && Number.isFinite(exactRow.alt)
              ? exactRow.alt
              : undefined;
          const normalized: NormalizedGps = {
            lat: exactRow.lat,
            lng: exactRow.lng,
            alt,
          };
          return normalized;
        }

        if (
          typeof timestamp === 'number' &&
          csvData.data.some((row) => typeof row.timestamp === 'number') &&
          timestamp >= minTimestamp &&
          timestamp <= maxTimestamp
        ) {
          try {
            const interpolationSource = csvData.data
              .filter((row): row is { timestamp: number; lat: number; lng: number; alt: number } =>
                typeof row.timestamp === 'number'
              )
              .map((row) => ({
                timestamp: row.timestamp,
                lat: row.lat,
                lng: row.lng,
                alt: row.alt,
              }));

            if (interpolationSource.length >= 2) {
              const interpolated = interpolateGpsData(
                interpolationSource,
                timestamp
              );
              if (hasValidLatLng(interpolated.lat, interpolated.lng)) {
                const alt =
                  typeof interpolated.alt === 'number' &&
                  Number.isFinite(interpolated.alt)
                    ? interpolated.alt
                    : undefined;
                const normalized: NormalizedGps = {
                  lat: interpolated.lat,
                  lng: interpolated.lng,
                  alt,
                };
                return normalized;
              }
            }
          } catch {
            return null;
          }
        }

        return null;
      }

      const csvRow = csvData.data.find(
        (row) =>
          row.filepath?.toLowerCase() ===
          sourceFile.webkitRelativePath.toLowerCase()
      );

      if (csvRow && hasValidLatLng(csvRow.lat, csvRow.lng)) {
        const alt =
          typeof csvRow.alt === 'number' && Number.isFinite(csvRow.alt)
            ? csvRow.alt
            : undefined;
        const normalized: NormalizedGps = {
          lat: csvRow.lat,
          lng: csvRow.lng,
          alt,
        };
        return normalized;
      }

      return null;
    },
    [associateByTimestamp, csvData, exifData, minTimestamp, maxTimestamp]
  );

  const invalidGpsFiles = useMemo(() => {
    if (filteredImageFiles.length === 0) {
      return [] as string[];
    }

    return filteredImageFiles
      .filter((file) => !getGpsForFile(file))
      .map((file) => file.webkitRelativePath);
  }, [filteredImageFiles, getGpsForFile]);

  const hasValidGpsForAllImages =
    filteredImageFiles.length > 0 && invalidGpsFiles.length === 0;

  useEffect(() => {
    if (setGpsDataReady) {
      setGpsDataReady(
        !scanningEXIF &&
          hasValidGpsForAllImages &&
          Boolean(csvData && csvData.data.length > 0)
      );
    }
  }, [setGpsDataReady, scanningEXIF, hasValidGpsForAllImages, csvData]);

  useEffect(() => {
    const hasData =
      hasValidGpsForAllImages && Boolean(csvData && csvData.data.length > 0);
    setReadyToSubmit(hasData);
  }, [hasValidGpsForAllImages, csvData, setReadyToSubmit]);

  // Simple concurrency limiter for mapping large arrays without blocking UI
  async function mapWithLimit<T, U>(
    items: T[],
    limit: number,
    mapper: (item: T, index: number) => Promise<U>,
    onProgress?: (index: number) => void
  ): Promise<U[]> {
    const results: U[] = new Array(items.length);
    let nextIndex = 0;
    let active = 0;

    return new Promise<U[]>((resolve, reject) => {
      const launch = () => {
        while (active < limit && nextIndex < items.length) {
          const current = nextIndex++;
          active++;
          mapper(items[current], current)
            .then((res) => {
              results[current] = res;
              if (onProgress) onProgress(current);
            })
            .then(() => {
              active--;
              if (
                results.length === items.length &&
                nextIndex >= items.length &&
                active === 0
              ) {
                resolve(results);
              } else {
                launch();
              }
            })
            .catch((err) => reject(err));
        }
        if (nextIndex >= items.length && active === 0) {
          resolve(results);
        }
      };
      launch();
    });
  }

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

      if (invalidGpsFiles.length > 0) {
        const sample = invalidGpsFiles.slice(0, 5);
        alert(
          `GPS coordinates are missing or invalid for ${invalidGpsFiles.length} image${
            invalidGpsFiles.length === 1 ? '' : 's'
          }. Example${sample.length === 1 ? '' : 's'}: ${sample.join(', ')}`
        );
        return;
      }

      const allCameras: Schema['Camera']['type'][] = [];

      const existingCameras =
        (
          await client.models.Camera.camerasByProjectId({
            projectId,
          })
        ).data || [];

      for (const camera of existingCameras) {
        allCameras.push(camera);
      }

      for (const [name, spec] of Object.entries(cameraSpecs)) {
        const existingCamera = existingCameras.find((c) => c.name === name);
        if (existingCamera) {
          await client.models.Camera.update({
            id: existingCamera.id,
            name: name,
            focalLengthMm: spec.focalLengthMm || 0,
            sensorWidthMm: spec.sensorWidthMm || 0,
            tiltDegrees: spec.tiltDegrees || 0,
          });
        } else {
          const { data: newCamera } = await client.models.Camera.create({
            name: name,
            projectId: projectId,
            focalLengthMm: spec.focalLengthMm || 0,
            sensorWidthMm: spec.sensorWidthMm || 0,
            tiltDegrees: spec.tiltDegrees || 0,
          });
          if (newCamera) {
            allCameras.push(newCamera);
          }
        }
      }

      for (const overlap of overlaps) {
        const cameraA = allCameras.find((c) => c.name === overlap.cameraA);

        const cameraB = allCameras.find((c) => c.name === overlap.cameraB);

        if (cameraA && cameraB) {
          const existingOverlap = (
            await client.models.CameraOverlap.get({
              cameraAId: cameraA.id,
              cameraBId: cameraB.id,
            })
          ).data;

          if (!existingOverlap) {
            await client.models.CameraOverlap.create({
              cameraAId: cameraA.id,
              cameraBId: cameraB.id,
              projectId: projectId,
            });
          }
        }
      }

      // Simplify return type to avoid complex union
      const imageSets = await fetchAllPaginatedResults(
        client.models.ImageSet.list,
        { filter: { projectId: { eq: projectId } }, selectionSet: ['id'] }
      );

      // only one image set exists for a survey
      if (imageSets.length === 0) {
        await client.models.ImageSet.create({
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

      const images = [] as {
        width: number;
        height: number;
        timestamp: number;
        cameraSerial: string;
        originalPath: string;
        latitude: number;
        longitude: number;
        altitude_egm96?: number;
        altitude_wgs84?: number;
        altitude_agl?: number;
      }[];

      for (const file of gpsFilteredImageFiles) {
        const exifmeta = exifData[file.webkitRelativePath];
        const gpsData = getGpsForFile(file);

        if (!exifmeta || !gpsData) {
          console.warn(
            `Skipping image ${file.webkitRelativePath} due to missing GPS metadata.`
          );
          continue;
        }

        const altitudeValue = gpsData.alt;

        images.push({
          width: exifmeta.width,
          height: exifmeta.height,
          timestamp: Math.floor(exifmeta.timestamp / 1000),
          cameraSerial: exifmeta.cameraSerial,
          originalPath: file.webkitRelativePath,
          latitude: gpsData.lat,
          longitude: gpsData.lng,
          altitude_egm96:
            altitudeType.value === 'egm96' ? altitudeValue : undefined,
          altitude_wgs84:
            altitudeType.value === 'wgs84' ? altitudeValue : undefined,
          altitude_agl:
            altitudeType.value === 'agl' ? altitudeValue : undefined,
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
    [
      filteredImageFiles,
      exifData,
      getGpsForFile,
      altitudeType,
      csvData,
      invalidGpsFiles,
      cameraSpecs,
      overlaps,
      client,
      name,
      model,
      masks,
      setTask,
      newProject,
    ]
  );

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
              alt: convertAltitude(point.elevation || 0),
            }))
          )
          .filter((point) => {
            // Validate GPS coordinates are valid numbers and in range
            return (
              Number.isFinite(point.lat) &&
              Number.isFinite(point.lng) &&
              Number.isFinite(point.alt) &&
              point.lat >= -90 &&
              point.lat <= 90 &&
              point.lng >= -180 &&
              point.lng <= 180
            );
          })
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
        const dayGroups: { [day: number]: number[] } = {};

        imagePoints.forEach(({ timestamp }) => {
          const date = new Date(timestamp!);
          const day = date.getUTCDate();
          const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
          if (!dayGroups[day]) dayGroups[day] = [];
          dayGroups[day].push(minutes);
        });

        Object.keys(dayGroups).forEach((dayStr) => {
          const day = parseInt(dayStr);
          const times = dayGroups[day];
          const minTime = Math.min(...times);
          const maxTime = Math.max(...times);
          initialRanges[day] = {
            start: minutesToTime(minTime),
            end: minutesToTime(maxTime),
          };
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
            if (!useUtm) {
              if (columnMapping.lat)
                newRow['Latitude'] = row[columnMapping.lat];
              if (columnMapping.lng)
                newRow['Longitude'] = row[columnMapping.lng];
            } else if (utmColumn) {
              newRow['UTM'] = row[utmColumn];
            }
            if (columnMapping.alt) newRow['Altitude'] = row[columnMapping.alt];
            return newRow;
          });
          results.data = mappedData;

          const hasTimestamp = results.data.some(
            (row: any) => row['Timestamp']
          );
          const hasFilepath = results.data.some((row: any) => row['FilePath']);
          const hasUtm = useUtm && results.data.some((row: any) => row['UTM']);
          setAssociateByTimestamp(hasTimestamp && !hasFilepath);
          // Build raw CSV data
          const rawData = results.data
            .map((row: any) => {
              let lat: number | undefined;
              let lng: number | undefined;
              if (hasUtm) {
                const conv = parseUtmString(row['UTM']);
                if (conv) {
                  lat = conv.lat;
                  lng = conv.lng;
                }
              } else {
                lat = Number(row['Latitude']);
                lng = Number(row['Longitude']);
              }
              return {
                timestamp: hasTimestamp
                  ? detectAndParseTimestamp(row['Timestamp'], commonTimezone) ??
                    undefined
                  : undefined,
                filepath: hasFilepath ? row['FilePath'] : undefined,
                lat: lat as number,
                lng: lng as number,
                alt: convertAltitude(Number(row['Altitude'])),
              };
            })
            .filter((row) => {
              // Validate timestamp if present
              if (hasTimestamp && row.timestamp === null) {
                return false;
              }
              // Validate GPS coordinates are valid numbers
              if (!Number.isFinite(row.lat) || !Number.isFinite(row.lng)) {
                return false;
              }
              // Validate lat is in valid range (-90 to 90)
              if (row.lat < -90 || row.lat > 90) {
                return false;
              }
              // Validate lng is in valid range (-180 to 180)
              if (row.lng < -180 || row.lng > 180) {
                return false;
              }
              return true;
            })
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
            const initialRanges: {
              [day: number]: { start: string; end: string };
            } = {};
            const dayGroups: { [day: number]: number[] } = {};

            imagePoints.forEach(({ timestamp }) => {
              const date = new Date(timestamp!);
              const day = date.getUTCDate();
              const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
              if (!dayGroups[day]) dayGroups[day] = [];
              dayGroups[day].push(minutes);
            });

            Object.keys(dayGroups).forEach((dayStr) => {
              const day = parseInt(dayStr);
              const times = dayGroups[day];
              const minTime = Math.min(...times);
              const maxTime = Math.max(...times);
              initialRanges[day] = {
                start: minutesToTime(minTime),
                end: minutesToTime(maxTime),
              };
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
              const initialRanges: {
                [day: number]: { start: string; end: string };
              } = {};
              const dayGroups: { [day: number]: number[] } = {};

              rawData.forEach(({ timestamp }) => {
                if (timestamp === undefined) return;
                const date = new Date(timestamp!);
                const day = date.getUTCDate();
                const minutes = date.getUTCHours() * 60 + date.getUTCMinutes();
                if (!dayGroups[day]) dayGroups[day] = [];
                dayGroups[day].push(minutes);
              });

              Object.keys(dayGroups).forEach((dayStr) => {
                const day = parseInt(dayStr);
                const times = dayGroups[day];
                const minTime = Math.min(...times);
                const maxTime = Math.max(...times);
                initialRanges[day] = {
                  start: minutesToTime(minTime),
                  end: minutesToTime(maxTime),
                };
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

  // Helper: converts total minutes to "HH:mm" string.
  const minutesToTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins
      .toString()
      .padStart(2, '0')}`;
  };

  // Helper: gets the actual time range for a specific day from the data
  const getDayTimeRange = (day: number, data: CsvFile) => {
    const dayData = data.filter((row) => {
      if (row.timestamp === undefined) return false;
      const date = new Date(row.timestamp!);
      return date.getUTCDate() === day;
    });

    if (dayData.length === 0) return { min: 0, max: 1439 }; // fallback to full day

    const times = dayData.map((row) => {
      const date = new Date(row.timestamp!);
      return date.getUTCHours() * 60 + date.getUTCMinutes();
    });

    return {
      min: Math.min(...times),
      max: Math.max(...times),
    };
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
    if (
      associateByTimestamp ||
      (fullCsvData && fullCsvData.some((row) => row.timestamp))
    ) {
      applyTimeFilter();
    }
  }, [timeRanges, fullCsvData, associateByTimestamp]);

  // Common UI elements shared between modal and form versions
  return (
    <>
      <Form.Group>
        <Form.Label className="mb-0">Model</Form.Label>
        <Form.Text
          className="d-block text-muted mt-0 mb-1"
          style={{ fontSize: 12 }}
        >
          Select the model you wish to use to guide annotation.
        </Form.Text>
        <Select
          className="text-black"
          value={model}
          options={[
            { label: 'ScoutBot', value: 'scoutbot' },
            {
              label: 'Elephant Detection Nadir',
              value: 'elephant-detection-nadir',
            },
            {
              label: 'Marine Animal Detector (MAD AI)',
              value: 'mad',
            },
            {
              label: 'Manual (images may be processed later)',
              value: 'manual',
            },
          ]}
          onChange={(e) => {
            if (e) setModel(e);
          }}
          placeholder="Select a model"
        />
      </Form.Group>
      <Form.Group>
        <Form.Label className="mb-0">Files to Upload</Form.Label>
        <p className="text-muted mb-1" style={{ fontSize: 12 }}>
          Upload the survey files by selecting the entire folder you wish to
          upload.
        </p>
        <div
          className="p-2 mb-2 bg-white text-black"
          style={{ minHeight: '136px', overflow: 'auto' }}
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
              id="filepicker"
              webkitdirectory=""
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
        <div className="mt-3 mb-0">
          <p className="mb-0">
            Scanning images for GPS data: {`${scanCount}/${scanTotal}`}
          </p>
        </div>
      ) : Object.keys(exifData).length > 0 && imageFiles.length > 0 ? (
        <Form.Group className="mt-3 d-flex flex-column gap-2">
          <div>
            <Form.Label className="mb-0">
              {missingGpsData ? 'Missing GPS data' : 'GPS data found'}
            </Form.Label>
            <Form.Text className="d-block mb-0" style={{ fontSize: '12px' }}>
              {missingGpsData
                ? 'Some images do not have GPS data. Please upload the gpx or csv file containing the GPS data for all images.'
                : 'The selected images have GPS data. Would you like to upload a separate file containing the GPS data for all images?'}
            </Form.Text>
            <Form.Text className="d-block mb-0" style={{ fontSize: '12px' }}>
              Your CSV file should have the following columns (their headings
              may be different):
              <ul className="mb-0">
                <li>timestamp and/or filepath</li>
                <li>lat</li>
                <li>lng</li>
                <li>alt</li>
              </ul>
            </Form.Text>
            <Form.Text className="d-block mb-0" style={{ fontSize: '12px' }}>
              If your data contains file paths instead of timestamps, the format
              should be:{' '}
              <code className="text-primary" style={{ fontSize: '14px' }}>
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
      {headerFields && !mappingConfirmed && (
        <Form.Group className="mt-3">
          <Form.Label className="mb-0">Confirm File Structure</Form.Label>
          <p className="text-muted mb-1" style={{ fontSize: 12 }}>
            Select which columns from your file correspond to the following
            fields:
          </p>
          <div
            className="d-flex flex-column gap-2 border border-dark p-2 shadow-sm"
            style={{ backgroundColor: '#697582' }}
          >
            <div className="d-flex flex-row gap-2 align-items-center">
              <div style={{ flex: 0.5 }}>
                <Form.Label className="mb-0">FilePath</Form.Label>
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
                  placeholder="Select FilePath column"
                  className="text-black"
                />
              </div>
              <p
                className="mb-0"
                style={{ width: '50px', textAlign: 'center' }}
              >
                or
              </p>
              <div style={{ flex: 0.5 }}>
                <Form.Label className="mb-0">Timestamp</Form.Label>
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
                  placeholder="Select Timestamp column"
                  className="text-black"
                />
              </div>
            </div>
            <div className="d-flex flex-row gap-2 align-items-start mt-2">
              <div style={{ flex: 0.5 }}>
                <Form.Label className="mb-0">Latitude</Form.Label>
                <Select
                  options={headerFields.map((f) => ({ label: f, value: f }))}
                  value={
                    columnMapping.lat
                      ? { label: columnMapping.lat, value: columnMapping.lat }
                      : null
                  }
                  onChange={(opt) => {
                    setUseUtm(false);
                    setColumnMapping({
                      ...columnMapping,
                      lat: opt ? opt.value : undefined,
                    });
                  }}
                  placeholder="Select Latitude column"
                  className="text-black"
                />
                <div className="mt-2">
                  <Form.Label className="mb-0">Longitude</Form.Label>
                  <Select
                    options={headerFields.map((f) => ({ label: f, value: f }))}
                    value={
                      columnMapping.lng
                        ? { label: columnMapping.lng, value: columnMapping.lng }
                        : null
                    }
                    onChange={(opt) => {
                      setUseUtm(false);
                      setColumnMapping({
                        ...columnMapping,
                        lng: opt ? opt.value : undefined,
                      });
                    }}
                    placeholder="Select Longitude column"
                    className="text-black"
                  />
                </div>
              </div>
              <p
                className="mb-0"
                style={{
                  width: '50px',
                  textAlign: 'center',
                  alignSelf: 'center',
                }}
              >
                or
              </p>
              <div style={{ flex: 0.5, alignSelf: 'center' }}>
                <Form.Label className="mb-0">UTM</Form.Label>
                <Select
                  options={[
                    { label: 'None', value: '' },
                    ...headerFields.map((f) => ({ label: f, value: f })),
                  ]}
                  value={
                    utmColumn
                      ? { label: utmColumn, value: utmColumn }
                      : { label: 'None', value: '' }
                  }
                  onChange={(opt) => {
                    const val = opt && opt.value ? opt.value : undefined;
                    setUtmColumn(val);
                    setUseUtm(Boolean(val));
                  }}
                  placeholder="None"
                  className="text-black"
                />
              </div>
            </div>
            <div>
              <div className="d-flex flex-row gap-3 align-items-center">
                <Form.Label className="mb-0">Altitude (optional)</Form.Label>
                <div className="d-flex flex-row gap-1 align-items-center">
                  <label className="me-2">ft</label>
                  <Form.Check
                    type="switch"
                    id="altitude-in-meters"
                    checked={altitudeInMeters}
                    onChange={(e) => setAltitudeInMeters(e.target.checked)}
                  />
                  <label>m</label>
                </div>
              </div>
              <div className="d-flex flex-row gap-2 align-items-center">
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
                  placeholder="Select Altitude column"
                  className="text-black flex-grow-1"
                />
                <Select
                  options={altitudeTypeOptions}
                  value={altitudeType}
                  onChange={(opt) =>
                    setAltitudeType(opt ?? { label: 'EGM96', value: 'egm96' })
                  }
                  placeholder="Select Altitude Type"
                  className="text-black"
                />
              </div>
            </div>
          </div>
          <Button
            variant="primary"
            className="mt-2"
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
            onShapefileParsed={onShapefileParsed}
          />
          {(associateByTimestamp ||
            (csvData &&
              fullCsvData &&
              fullCsvData.some((row) => row.timestamp))) && (
            <Form.Group>
              <Form.Label className="mb-0">
                Filter Data by Time Range (Optional)
              </Form.Label>
              <Form.Text
                className="d-block mb-1 mt-0"
                style={{ fontSize: '12px' }}
              >
                Select the effective time range for each day. The default range
                is the earliest and latest timestamp recorded for that day.
              </Form.Text>
              <Form.Text
                className="d-block mb-1"
                style={{ fontSize: '12px', fontStyle: 'italic' }}
              >
                All times shown in UTC.
              </Form.Text>
              <div className="d-flex flex-column gap-2">
                {Array.from(
                  new Set(
                    (fullCsvData || csvData.data).map((row) =>
                      new Date(row.timestamp!).getUTCDate()
                    )
                  )
                )
                  .sort((a: number, b: number) => a - b)
                  .map((day: number) => {
                    const data = fullCsvData || csvData.data;
                    const dayRange = getDayTimeRange(day, data);
                    const startMinutes = timeToMinutes(
                      timeRanges[day]?.start || minutesToTime(dayRange.min)
                    );
                    const endMinutes = timeToMinutes(
                      timeRanges[day]?.end || minutesToTime(dayRange.max)
                    );

                    const handleStartTimeChange = (timeStr: string) => {
                      const newStartMinutes = timeToMinutes(timeStr);
                      if (newStartMinutes <= endMinutes) {
                        updateTimeRange(
                          day,
                          timeStr,
                          timeRanges[day]?.end || minutesToTime(dayRange.max)
                        );
                      }
                    };

                    const handleEndTimeChange = (timeStr: string) => {
                      const newEndMinutes = timeToMinutes(timeStr);
                      if (newEndMinutes >= startMinutes) {
                        updateTimeRange(
                          day,
                          timeRanges[day]?.start || minutesToTime(dayRange.min),
                          timeStr
                        );
                      }
                    };

                    return (
                      <div
                        key={`day-${day}`}
                        className="d-flex flex-column gap-2 mt-2"
                      >
                        <span className="fw-bold">
                          {new Date(data[0].timestamp!).toLocaleDateString()}
                        </span>
                        <div className="d-flex align-items-center gap-2">
                          <label className="mb-0">Start:</label>
                          <input
                            type="time"
                            className="form-control"
                            style={{ width: '120px' }}
                            value={minutesToTime(startMinutes)}
                            onChange={(e) =>
                              handleStartTimeChange(e.target.value)
                            }
                          />
                          <label className="mb-0">End:</label>
                          <input
                            type="time"
                            className="form-control"
                            style={{ width: '120px' }}
                            value={minutesToTime(endMinutes)}
                            onChange={(e) =>
                              handleEndTimeChange(e.target.value)
                            }
                          />
                          <div className="flex-grow-1">
                            <Slider
                              range
                              min={dayRange.min}
                              max={dayRange.max}
                              value={[startMinutes, endMinutes]}
                              onChange={(vals) => {
                                if (Array.isArray(vals)) {
                                  const [s, e] = vals as [number, number];
                                  updateTimeRange(
                                    day,
                                    minutesToTime(s),
                                    minutesToTime(e)
                                  );
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </Form.Group>
          )}
          <div className="mt-3">
            {(() => {
              if (invalidGpsFiles.length > 0) {
                const sample = invalidGpsFiles.slice(0, 5);
                return (
                  <div className="alert alert-danger mb-0">
                    Missing GPS coordinates for {invalidGpsFiles.length} image
                    {invalidGpsFiles.length === 1 ? '' : 's'}. Example
                    {sample.length === 1 ? '' : 's'}: {sample.join(', ')}
                  </div>
                );
              }
              let message = '';
              const hasTimestampData =
                csvData &&
                fullCsvData &&
                fullCsvData.some((row) => row.timestamp);
              if (associateByTimestamp || hasTimestampData) {
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
                <div className={`alert ${alertClass} mb-0`}>
                  {displayMessage}
                </div>
              );
            })()}
          </div>
          <Form.Group className="mt-3">
            <Form.Label className="mb-0">Camera Definition</Form.Label>
            <span
              className="text-muted d-block mb-1"
              style={{ fontSize: '12px' }}
            >
              Does your survey have only one camera or multiple cameras?
            </span>
            <LabeledToggleSwitch
              leftLabel="Single Camera"
              rightLabel="Multiple Cameras"
              checked={multipleCameras}
              onChange={(e) => setMultipleCameras(e)}
            />
            {multipleCameras && (
              <>
                <FolderStructure
                  files={scannedFiles}
                  onCameraLevelChange={setCameraSelection}
                />
                {cameraSelection && (
                  <CameraOverlap
                    cameraSelection={cameraSelection}
                    overlaps={overlaps}
                    setOverlaps={setOverlaps}
                  />
                )}
              </>
            )}
            {/* Existing vs New camera notice */}
            {(() => {
              if (!cameraSelection) return null;
              const currentNames = cameraSelection[1];
              const existingSet = new Set(existingCameraNames);
              const matched = currentNames.filter((n) => existingSet.has(n));
              const newOnes = currentNames.filter((n) => !existingSet.has(n));
              const hasAny = currentNames.length > 0;
              if (!hasAny || loadingExistingCameras) return null;
              return (
                <div className="mt-2">
                  {matched.length > 0 && (
                    <div className="alert alert-info mb-2">
                      These cameras already exist and will be linked by name:{' '}
                      {matched.join(', ')}
                    </div>
                  )}
                  {matched.length === 0 && newOnes.length === 0 && (
                    <div className="alert alert-warning mb-2">
                      No cameras detected from folder structure.
                    </div>
                  )}
                </div>
              );
            })()}
            {(() => {
              if (!cameraSelection) return null;
              const names = (cameraSelection || [
                'Survey Level',
                ['Survey Camera'],
              ])[1];
              const existingSet = new Set(existingCameraNames);
              const onlyNew = names.filter((n) => !existingSet.has(n));
              if (onlyNew.length === 0) return null;
              return (
                <CameraSpecification
                  cameraSelection={[
                    (cameraSelection || ['Survey Level', ['Survey Camera']])[0],
                    onlyNew,
                  ]}
                  cameraSpecs={cameraSpecs}
                  setCameraSpecs={setCameraSpecs}
                />
              );
            })()}
          </Form.Group>
        </>
      )}
      {filteredImageFiles.length > 0 && csvData && (
        <ImageMaskEditor setMasks={setMasks} />
      )}
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  // Modal version needs to handle its own submit
  const handleModalSubmit = async () => {
    if (!uploadSubmitFn || !project?.id) return;
    setIsSubmitting(true);
    try {
      try {
        await client.models.Project.update({
          id: project.id,
          status: 'uploading',
        });
        try {
          await client.mutations.updateProjectMemberships({
            projectId: project.id,
          });
        } catch {
          /* noop: membership ping best-effort */
        }
      } catch {
        /* noop: status update will be enforced by UploadManager */
      }

      handleClose();

      await uploadSubmitFn(project.id, fromStaleUpload);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      show={show}
      onHide={handleClose}
      size="xl"
      backdrop="static"
      keyboard={false}
    >
      <Modal.Header>
        <Modal.Title>
          {fromStaleUpload ? 'Resume upload: ' : 'Add files: '}
          {project?.name}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          {fromStaleUpload && (
            <p className="mb-2 text-warning">
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
          variant="primary"
          disabled={!readyToSubmit || isSubmitting || isClosing}
          onClick={handleModalSubmit}
        >
          Submit
        </Button>
        <Button
          variant="dark"
          disabled={isSubmitting || isClosing}
          onClick={() => {
            setIsClosing(true);
            handleClose();
          }}
        >
          Cancel
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
