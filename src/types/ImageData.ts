import type { ImageOrientationGroup } from './Orientation';

export interface ImageData {
  width: number;
  height: number;
  timestamp: number;
  cameraSerial: string;
  originalPath: string;
  /** Source-shape group selected before any upload-time correction. */
  sourceOrientationGroup?: ImageOrientationGroup;
  latitude?: number;
  longitude?: number;
  altitude_wgs84?: number;
  altitude_egm96?: number;
  altitude_agl?: number;
}

export type UploadedFiles = string[];

export interface CreatedImage {
  id: string;
  originalPath: string;
  timestamp: number;
  cameraId?: string;
}
