import type { CreatedImage, ImageData } from '../../types/ImageData';
import type { CameraResolver } from './cameras';
import type { ElevationService } from './elevation';
import type { UploadClient } from './types';
import { unwrap, withRetry } from './retry';

export interface RecordWriterContext {
  client: UploadClient;
  projectId: string;
  organizationId?: string;
  imageSetId: string;
  makeKey: (originalPath: string) => string;
  elevation: ElevationService;
  cameras: CameraResolver;
  signal?: AbortSignal;
}

// Creates Image, ImageSetMembership, and ImageFile records for one image.
export class RecordWriter {
  constructor(private ctx: RecordWriterContext) {}

  async createImageRecords(
    imageData: ImageData,
    fileType: string,
    phash: string | undefined
  ): Promise<CreatedImage> {
    const {
      client,
      projectId,
      organizationId,
      imageSetId,
      makeKey,
      elevation,
      cameras,
      signal,
    } = this.ctx;

    let groundElevation = 0;
    if (
      imageData.latitude &&
      imageData.longitude &&
      !imageData.altitude_agl
    ) {
      groundElevation =
        (await elevation.getElevation(
          imageData.latitude,
          imageData.longitude
        )) ?? 0;
    }

    const altitude = imageData.altitude_egm96 ?? imageData.altitude_wgs84;
    const cameraId = cameras.resolveCameraId(imageData.originalPath);

    const img = unwrap(
      await withRetry(
        () =>
          client.models.Image.create({
            projectId,
            width: imageData.width,
            height: imageData.height,
            timestamp: imageData.timestamp,
            cameraSerial: imageData.cameraSerial,
            originalPath: imageData.originalPath,
            latitude: imageData.latitude,
            longitude: imageData.longitude,
            altitude_egm96: imageData.altitude_egm96,
            altitude_wgs84: imageData.altitude_wgs84,
            altitude_agl:
              imageData.altitude_agl ??
              (groundElevation > 0 && altitude
                ? altitude - groundElevation
                : undefined),
            cameraId,
            phash,
            group: organizationId,
          }),
        { signal }
      )
    );

    await withRetry(
      () =>
        client.models.ImageSetMembership.create({
          imageId: img.id,
          imageSetId,
          group: organizationId,
        }),
      { signal }
    );

    const finalKey = makeKey(img.originalPath!);
    await withRetry(
      () =>
        client.models.ImageFile.create({
          projectId,
          imageId: img.id,
          key: finalKey,
          path: finalKey,
          type: fileType,
          group: organizationId,
        }),
      { signal }
    );

    return {
      id: img.id,
      originalPath: img.originalPath!,
      timestamp: img.timestamp!,
      cameraId: img.cameraId ?? undefined,
    };
  }
}
