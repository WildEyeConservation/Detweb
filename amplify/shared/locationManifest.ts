/** Location records written by tiling batches and consumed by queue launchers. */
export interface LocationManifestEntry {
  locationId: string;
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}
