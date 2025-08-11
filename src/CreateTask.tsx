import {
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import { UserContext, GlobalContext } from './Context';
import { useUpdateProgress } from './useUpdateProgress';
import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { fetchAllPaginatedResults } from './utils';
import LabeledToggleSwitch from './LabeledToggleSwitch';
import Papa from 'papaparse';
import { makeTransform, array2Matrix } from './utils';
import { inv } from 'mathjs';
import { MultiValue } from 'react-select';
import { Schema } from '../amplify/data/resource';
const thresholdRange = {
  ivx: { min: 1, max: 10, step: 1 },
  scoutbot: { min: 0, max: 1, step: 0.01 },
  scoutbotV3: { min: 0, max: 1, step: 0.01 },
};

type Nullable<T> = T | null;

type TaskType = 'tiled' | 'model' | 'annotation';

interface CreateTaskProps {
  imageSets: string[];
  taskType: TaskType;
  name: string;
  projectId: string;
  labels: Schema['Category']['type'][];
  setHandleCreateTask?: React.Dispatch<
    React.SetStateAction<(() => Promise<string>) | null>
  >;
  setLaunchDisabled: React.Dispatch<React.SetStateAction<boolean>>;
}

interface ImageDimensions {
  width: number;
  height: number;
}

function CreateTask({
  imageSets,
  name,
  taskType,
  projectId,
  labels,
  setHandleCreateTask,
  setLaunchDisabled,
}: CreateTaskProps) {
  const { client, backend } = useContext(GlobalContext)!;
  const { getSqsClient } = useContext(UserContext)!;
  const [minX, setMinX] = useState<number>(0);
  const [maxX, setMaxX] = useState<number>(0);
  const [minY, setMinY] = useState<number>(0);
  const [maxY, setMaxY] = useState<number>(0);
  const [specifyTileDimensions, setSpecifyTileDimensions] =
    useState<boolean>(false);
  const [specifyBorderPercentage, setSpecifyBorderPercentage] =
    useState<boolean>(false);
  const [specifyBorders, setSpecifyBorders] = useState<boolean>(false);
  const [imageWidth, setImageWidth] = useState<number | undefined>(undefined);
  const [imageHeight, setImageHeight] = useState<number | undefined>(undefined);
  const [specifyOverlapInPercentage, setSpecifyOverlapInPercentage] =
    useState<boolean>(false);
  const [minOverlap, setMinOverlap] = useState<number>(0);
  const [minSidelap, setMinSidelap] = useState<number>(0);
  const [minOverlapPercentage, setMinOverlapPercentage] = useState<number>(0);
  const [minSidelapPercentage, setMinSidelapPercentage] = useState<number>(0);
  const [allImages, setAllImages] = useState<
    {
      timestamp: Nullable<number>;
      width: number;
      height: number;
      id: string;
      transectId: Nullable<string>;
      latitude: Nullable<number>;
      longitude: Nullable<number>;
      originalPath: string;
    }[]
  >([]);
  const [width, setWidth] = useState<number>(1024);
  const [height, setHeight] = useState<number>(1024);
  const [horizontalTiles, setHorizontalTiles] = useState<number>(3);
  const [verticalTiles, setVerticalTiles] = useState<number>(5);
  const [modelId, setModelId] = useState<string>('ivx');
  const [scoutbotFile, setScoutbotFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const effectiveImageWidth = maxX - minX;
  const effectiveImageHeight = maxY - minY;
  const [selectedCategories, setSelectedCategories] = useState<
    MultiValue<CategoryOption> | SingleValue<CategoryOption>
  >([]);
  const [loadingImages, setLoadingImages] = useState<boolean>(false);
  const [launching, setLaunching] = useState<boolean>(false);

  // Dev-only: per-transect subsetting based on geo + timestamps
  const hasDevGeoTransect = useMemo(() => {
    if (process.env.NODE_ENV !== 'development') return false;
    if (!allImages || allImages.length === 0) return false;
    return allImages.every(
      (img) =>
        img != null &&
        img.timestamp != null &&
        img.transectId != null &&
        img.latitude != null &&
        img.longitude != null
    );
  }, [allImages]);

  // Function to convert degrees to radians
  function toRad(deg: number) {
    return (deg * Math.PI) / 180;
  }

  // More accurate ellipsoidal estimate of distance based on the WGS84 model
  function vincentyDistanceKm(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) {
    // WGS-84 ellipsiod parameters
    const a = 6378137;
    const b = 6356752.314245;
    const f = 1 / 298.257223563;

    const L = toRad(lon2 - lon1);
    const U1 = Math.atan((1 - f) * Math.tan(toRad(lat1)));
    const U2 = Math.atan((1 - f) * Math.tan(toRad(lat2)));

    const sinU1 = Math.sin(U1),
      cosU1 = Math.cos(U1);
    const sinU2 = Math.sin(U2),
      cosU2 = Math.cos(U2);

    let λ = L;
    let λP,
      iterLimit = 100;
    let cosSqAlpha, sinSigma, cos2SigmaM, cosSigma, sigma;

    do {
      const sinλ = Math.sin(λ),
        cosλ = Math.cos(λ);
      sinSigma = Math.sqrt(
        cosU2 * sinλ * (cosU2 * sinλ) +
          (cosU1 * sinU2 - sinU1 * cosU2 * cosλ) *
            (cosU1 * sinU2 - sinU1 * cosU2 * cosλ)
      );

      if (sinSigma === 0) return 0; // co-incident points

      cosSigma = sinU1 * sinU2 + cosU1 * cosU2 * cosλ;
      sigma = Math.atan2(sinSigma, cosSigma);
      const sinAlpha = (cosU1 * cosU2 * sinλ) / sinSigma;
      cosSqAlpha = 1 - sinAlpha * sinAlpha;
      cos2SigmaM = cosSigma - (2 * sinU1 * sinU2) / cosSqAlpha;

      if (isNaN(cos2SigmaM)) cos2SigmaM = 0; // equatorial line

      const C = (f / 16) * cosSqAlpha * (4 + f * (4 - 3 * cosSqAlpha));
      λP = λ;
      λ =
        L +
        (1 - C) *
          f *
          sinAlpha *
          (sigma +
            C *
              sinSigma *
              (cos2SigmaM + C * cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM)));
    } while (Math.abs(λ - λP) > 1e-12 && --iterLimit > 0);

    if (iterLimit === 0) return NaN; // formula failed to converge

    const uSq = (cosSqAlpha * (a * a - b * b)) / (b * b);
    const A =
      1 + (uSq / 16384) * (4096 + uSq * (-768 + uSq * (320 - 175 * uSq)));
    const B = (uSq / 1024) * (256 + uSq * (-128 + uSq * (74 - 47 * uSq)));

    const deltaSigma =
      B *
      sinSigma *
      (cos2SigmaM +
        (B / 4) *
          (cosSigma * (-1 + 2 * cos2SigmaM * cos2SigmaM) -
            (B / 6) *
              cos2SigmaM *
              (-3 + 4 * sinSigma * sinSigma) *
              (-3 + 4 * cos2SigmaM * cos2SigmaM)));

    const s = b * A * (sigma - deltaSigma);

    return s / 1000; // distance in kilometers
  }

  const transectGroupStats = useMemo(() => {
    if (!hasDevGeoTransect) return [] as any[];

    // Group images by transectId
    const groups: Record<string, any[]> = {};
    for (const img of allImages) {
      const tId = String(img.transectId);
      if (!groups[tId]) groups[tId] = [];
      groups[tId].push(img);
    }

    // Compute distance and speed for each transect
    const results = Object.entries(groups).map(([transectId, imgs]) => {
      const sorted = imgs
        .slice()
        .sort((a, b) => (a.timestamp as number) - (b.timestamp as number));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const distanceKm = vincentyDistanceKm(
        first.latitude as number,
        first.longitude as number,
        last.latitude as number,
        last.longitude as number
      );
      const timeSeconds = Math.abs(
        (last.timestamp as number) - (first.timestamp as number)
      );
      const speedKmh = timeSeconds > 0 ? distanceKm / (timeSeconds / 3600) : 0;
      return {
        transectId,
        images: sorted,
        imageCount: sorted.length,
        distanceKm,
        speedKmh,
      };
    });
    return results;
  }, [hasDevGeoTransect, allImages]);

  const [transectSubsetSteps, setTransectSubsetSteps] = useState<
    Record<string, number>
  >({});

  useEffect(() => {
    if (!hasDevGeoTransect) return;

    // Set the subset step for each transect
    setTransectSubsetSteps((prev) => {
      const next = { ...prev };
      for (const g of transectGroupStats as any[]) {
        if (next[g.transectId] == null) next[g.transectId] = 1;
      }
      return next;
    });
  }, [hasDevGeoTransect, transectGroupStats]);

  // Compute the expected number of images for each transect
  const expectedCounts = useMemo(() => {
    if (!hasDevGeoTransect)
      return { per: {} as Record<string, number>, total: 0 };
    const per: Record<string, number> = {};
    let total = 0;
    for (const g of transectGroupStats as any[]) {
      const step = Math.max(
        1,
        Number(transectSubsetSteps[g.transectId] ?? 1) || 1
      );
      const count = Math.floor((g.imageCount as number) / step);
      per[g.transectId] = count;
      total += count;
    }
    return { per, total };
  }, [hasDevGeoTransect, transectGroupStats, transectSubsetSteps]);

  const getImageId = useMemo(() => {
    const cache: { [path: string]: string } = {};

    return async function (path: string): Promise<string> {
      if (cache[path]) {
        return cache[path];
      }

      const { data } = await client.models.ImageFile.imagesByPath(
        { path },
        { selectionSet: ['imageId'] }
      );

      if (data && data.length > 0 && data[0].imageId) {
        const id = data[0].imageId;
        cache[path] = id;
        return id;
      }

      throw new Error(`No image found for path: ${path}`);
    };
  }, [client.models.ImageFile]);

  function calculateTileSizeAbsoluteOverlap(
    effectiveSize: number,
    tileCount: number,
    overlap: number
  ) {
    return Math.ceil((effectiveSize + (tileCount - 1) * overlap) / tileCount);
  }

  function calculateTileSizePercentageOverlap(
    effectiveSize: number,
    tileCount: number,
    overlap: number
  ) {
    return Math.ceil(
      effectiveSize / (tileCount - (overlap / 100) * (tileCount - 1))
    );
  }

  function calculateTileCountAbsoluteOverlap(
    effectiveSize: number,
    tileSize: number,
    overlap: number
  ) {
    return Math.ceil((effectiveSize - tileSize) / (tileSize - overlap)) + 1;
  }

  function calculateTileCountPercentageOverlap(
    effectiveSize: number,
    tileSize: number,
    overlap: number
  ) {
    return Math.ceil(
      (effectiveSize - tileSize) / (tileSize * (1 - overlap / 100)) + 1
    );
  }

  function getSidelapPixels() {
    return Math.floor(
      (horizontalTiles * width - effectiveImageWidth) / (horizontalTiles - 1)
    );
  }

  function getOverlapPixels() {
    return Math.floor(
      (verticalTiles * height - effectiveImageHeight) / (verticalTiles - 1)
    );
  }

  function getSidelapPercent() {
    return (getSidelapPixels() / width) * 100;
  }

  function getOverlapPercent() {
    return (getOverlapPixels() / height) * 100;
  }

  // Ensure that the minsidelap constraint is met
  useEffect(() => {
    if (!specifyOverlapInPercentage) {
      if (!specifyTileDimensions) {
        setWidth(
          calculateTileSizeAbsoluteOverlap(
            effectiveImageWidth,
            horizontalTiles,
            minSidelap
          )
        );
      } else {
        setHorizontalTiles(
          calculateTileCountAbsoluteOverlap(
            effectiveImageWidth,
            width,
            minSidelap
          )
        );
      }
      setMinSidelapPercentage((minSidelap / width) * 100);
    }
  }, [
    minSidelap,
    specifyTileDimensions,
    horizontalTiles,
    effectiveImageWidth,
    width,
  ]);

  //Ensure that the minoverlap constraint is met
  useEffect(() => {
    if (!specifyOverlapInPercentage) {
      if (!specifyTileDimensions) {
        setHeight(
          calculateTileSizeAbsoluteOverlap(
            effectiveImageHeight,
            verticalTiles,
            minOverlap
          )
        );
      } else {
        setVerticalTiles(
          calculateTileCountAbsoluteOverlap(
            effectiveImageHeight,
            height,
            minOverlap
          )
        );
      }
      setMinOverlapPercentage((minOverlap / height) * 100);
    }
  }, [
    minOverlap,
    specifyTileDimensions,
    verticalTiles,
    effectiveImageHeight,
    height,
  ]);

  //Ensure that the minsidelapPercentage constraint is met
  useEffect(() => {
    if (specifyOverlapInPercentage) {
      if (!specifyTileDimensions) {
        setWidth(
          calculateTileSizePercentageOverlap(
            effectiveImageWidth,
            horizontalTiles,
            minSidelapPercentage
          )
        );
      } else {
        setHorizontalTiles(
          calculateTileCountPercentageOverlap(
            effectiveImageWidth,
            width,
            minSidelapPercentage
          )
        );
      }
      setMinSidelap(Math.ceil((minSidelapPercentage * width) / 100));
    }
  }, [
    minSidelapPercentage,
    specifyTileDimensions,
    horizontalTiles,
    effectiveImageWidth,
    width,
  ]);

  //Ensure that the minoverlapPercentage constraint is met
  useEffect(() => {
    if (specifyOverlapInPercentage) {
      if (!specifyTileDimensions) {
        setHeight(
          calculateTileSizePercentageOverlap(
            effectiveImageHeight,
            verticalTiles,
            minOverlapPercentage
          )
        );
      } else {
        setVerticalTiles(
          calculateTileCountPercentageOverlap(
            effectiveImageHeight,
            height,
            minOverlapPercentage
          )
        );
      }
      setMinOverlap(Math.ceil((minOverlapPercentage * height) / 100));
    }
  }, [
    minOverlapPercentage,
    specifyTileDimensions,
    verticalTiles,
    effectiveImageHeight,
    height,
  ]);

  useEffect(() => {
    async function getAllImages() {
      setLoadingImages(true);

      // Gather all images across image sets
      const imagesArr: {
        timestamp: Nullable<number>;
        width: number;
        height: number;
        id: string;
        originalPath: string;
      }[] = [];
      for (const imageSetId of imageSets) {
        let nextToken: string | undefined = undefined;
        do {
          const { data: images, nextToken: nextNextToken } =
            await client.models.ImageSetMembership.imageSetMembershipsByImageSetId(
              { imageSetId },
              {
                selectionSet: [
                  'image.width',
                  'image.height',
                  'image.id',
                  'image.timestamp',
                  'image.originalPath',
                  'image.transectId',
                  'image.latitude',
                  'image.longitude',
                ],
                nextToken,
                limit: 1000,
              }
            );
          nextToken = nextNextToken ?? undefined;
          imagesArr.push(...images.map(({ image }) => image));
        } while (nextToken);
      }
      // Update state with all images
      setAllImages(imagesArr);

      if (imagesArr.length === 0) {
        return;
      }
      // Use first image dimensions as reference
      const firstWidth = imagesArr[0].width;
      const firstHeight = imagesArr[0].height;
      // Ensure all images match either orientation of first image
      const allMatch = imagesArr.every(
        (img) =>
          (img.width === firstWidth && img.height === firstHeight) ||
          (img.width === firstHeight && img.height === firstWidth)
      );
      if (!allMatch) {
        console.log('Inconsistent image sizes detected');
        setImageWidth(undefined);
        setImageHeight(undefined);
        setMaxX(undefined);
        setMaxY(undefined);
      } else {
        // Use first image dimensions for overlap calculations
        setImageWidth(firstWidth);
        setImageHeight(firstHeight);
        setMinX(0);
        setMinY(0);
        setMaxX(firstWidth);
        setMaxY(firstHeight);
      }

      setLoadingImages(false);
    }

    if (imageSets && imageSets.length > 0) {
      getAllImages();
    }
  }, [imageSets, client.models.ImageSetMembership]);

  useEffect(() => {
    if (loadingImages) {
      setLaunchDisabled(true);
    } else {
      setLaunchDisabled(false);
    }
  }, [loadingImages]);

  const [setImagesCompleted, setTotalImages] = useUpdateProgress({
    taskId: `Create task (model guided)`,
    indeterminateTaskName: `Loading images`,
    determinateTaskName: 'Processing images',
    stepFormatter: (x: number) => `${x} images`,
  });

  const [threshold, setThreshold] = useState(5); // New state variable for threshold
  // Add development subset number for selecting images in development mode
  const [subsetN, setSubsetN] = useState<number>(1);

  const handleSubmit = useCallback(
    async ({
      setLocationsCompleted,
      setTotalLocations,
    }: {
      setLocationsCompleted: (steps: number) => void;
      setTotalLocations: (steps: number) => void;
    }) => {
      setLaunching(true);

      // Development mode: subset images globally or per-transect with geo data
      let imagesToUse = allImages;
      if (process.env.NODE_ENV === 'development') {
        if (hasDevGeoTransect) {
          const selected: typeof allImages = [];
          for (const g of transectGroupStats as any[]) {
            const stepRaw = transectSubsetSteps[g.transectId];
            const step = Math.max(1, Number(stepRaw) || 1);
            const subset = (g.images as any[]).filter(
              (_: any, idx: number) => (idx + 1) % step === 0
            );
            selected.push(...subset);
          }
          imagesToUse = selected;
        } else if (subsetN > 1) {
          const sortedImages = [...allImages].sort((a, b) => {
            if (a.timestamp != null && b.timestamp != null) {
              return (a.timestamp as number) - (b.timestamp as number);
            } else if (a.timestamp != null) {
              return -1;
            } else if (b.timestamp != null) {
              return 1;
            }
            return 0;
          });
          imagesToUse = sortedImages.filter(
            (_, idx) => (idx + 1) % subsetN === 0
          );
        }
      }

      const {
        data: { id: locationSetId },
      } = await client.models.LocationSet.create({
        name,
        projectId: projectId,
        locationCount:
          taskType !== 'model'
            ? allImages.length * horizontalTiles * verticalTiles
            : 0,
      });

      switch (taskType) {
        case 'model':
          if (modelId === 'ivx') {
            allImages.map(async (image) => {
              const key = image.originalPath.replace('images', 'heatmaps');
              const sqsClient = await getSqsClient();
              await sqsClient.send(
                new SendMessageCommand({
                  QueueUrl: backend.custom.pointFinderTaskQueueUrl,
                  MessageBody: JSON.stringify({
                    imageId: image.id,
                    projectId: projectId,
                    key: 'heatmaps/' + key + '.h5',
                    width: 1024,
                    height: 1024,
                    threshold: 1 - Math.pow(10, -threshold),
                    bucket: backend.storage.buckets[0].bucket_name,
                    setId: locationSetId,
                  }),
                })
              );
              setImagesCompleted((s: number) => s + 1);
            });
          }
          if (modelId === 'scoutbotV3') {
            // Chunk allImages into groups of 4
            const chunkSize = 4;
            for (let i = 0; i < allImages.length; i += chunkSize) {
              const chunk = allImages.slice(i, i + chunkSize);

              const sqsClient = await getSqsClient();
              await sqsClient.send(
                new SendMessageCommand({
                  QueueUrl: backend.custom.scoutbotTaskQueueUrl,
                  MessageBody: JSON.stringify({
                    images: chunk.map((image) => ({
                      imageId: image.id,
                      key: 'images/' + image.originalPath,
                    })),
                    projectId: projectId,
                    bucket: backend.storage.buckets[1].bucket_name,
                    setId: locationSetId,
                  }),
                })
              );

              // Update progress for the entire chunk
              setImagesCompleted((s: number) => s + chunk.length);
            }
          }
          if (modelId === 'scoutbot') {
            Papa.parse(scoutbotFile!, {
              complete: (result: {
                data: {
                  'Label Confidence': string;
                  'Image Filename': string;
                  'Box X': string;
                  'Box Y': string;
                  'Box W': string;
                  'Box H': string;
                }[];
              }) => {
                // Handle the parsed data here
                console.log('Parsed CSV data:', result.data);
                for (const row of result.data) {
                  if (Number(row['Label Confidence']) > threshold) {
                    getImageId(row['Image Filename'])
                      .then(async (id) => {
                        await client.models.Location.create({
                          x:
                            Math.round(Number(row['Box X'])) +
                            Math.round(Number(row['Box W']) / 2),
                          y:
                            Math.round(Number(row['Box Y'])) +
                            Math.round(Number(row['Box H']) / 2),
                          width: Math.round(Number(row['Box W'])),
                          height: Math.round(Number(row['Box H'])),
                          confidence: 1,
                          imageId: id,
                          projectId: projectId,
                          source: 'manual',
                          setId: locationSetId,
                        });
                      })
                      .then(() => setLocationsCompleted((fc: any) => fc + 1));
                  }
                }
              },
              header: true, // Assumes the first row of the CSV is headers
              skipEmptyLines: true,
              error: (error) => {
                console.error('Error parsing CSV:', error);
              },
            });
          }
          break;
        case 'tiled':
          setTotalLocations(
            imagesToUse.length * horizontalTiles * verticalTiles
          );
          const promises: Promise<void>[] = [];
          for (const {
            id,
            width: imgWidth,
            height: imgHeight,
          } of imagesToUse) {
            const effW = imgWidth;
            const effH = imgHeight;
            const xStepSize = (effW - width) / (horizontalTiles - 1);
            const yStepSize = (effH - height) / (verticalTiles - 1);
            for (let xStep = 0; xStep < horizontalTiles; xStep++) {
              for (let yStep = 0; yStep < verticalTiles; yStep++) {
                const x = Math.round(
                  (xStepSize ? xStep * xStepSize : 0) + width / 2
                );
                const y = Math.round(
                  (yStepSize ? yStep * yStepSize : 0) + height / 2
                );
                promises.push(
                  client.models.Location.create({
                    x,
                    y,
                    width,
                    height,
                    imageId: id,
                    projectId,
                    confidence: 1,
                    source: 'manual',
                    setId: locationSetId,
                  }).then(() => setLocationsCompleted((s: number) => s + 1))
                );
              }
            }
          }
          await Promise.all(promises);
          break;
        case 'annotation':
          const newLocations = [];
          //Iterate over the selected categories
          for (const category of selectedCategories) {
            //Get all annotations of the selected category
            const annotations = await fetchAllPaginatedResults(
              client.models.Annotation.annotationsByCategoryId,
              {
                categoryId: category.value,
              }
            );
            // Now we create a dictionary with the imageId as the key and a list of annotation coordinates as the value
            let imageAnnotations = {};
            for (const annotation of annotations) {
              imageAnnotations[annotation.imageId] =
                imageAnnotations[annotation.imageId] || [];
              imageAnnotations[annotation.imageId].push({
                x: annotation.x,
                y: annotation.y,
              });
            }
            // Now we iterate through the imageAnnotations dictionary
            for (const imageId in imageAnnotations) {
              const { data: image } = await client.models.Image.get({
                id: imageId,
              });
              // Now we find all images that have a defined homography between themselves and the current image
              const { data: nextNeighbors } =
                await client.models.ImageNeighbour.imageNeighboursByImage1key({
                  image1Id: imageId,
                });
              const { data: previousNeighbors } =
                await client.models.ImageNeighbour.imageNeighboursByImage2key({
                  image2Id: imageId,
                });
              const neighbors = [
                ...nextNeighbors
                  .filter((n) => n.homography)
                  .map((n) => ({
                    transform: makeTransform(array2Matrix(n.homography)),
                    imageId: n.image2Id,
                  })),
                ...previousNeighbors
                  .filter((n) => n.homography)
                  .map((n) => ({
                    transform: makeTransform(inv(array2Matrix(n.homography))),
                    imageId: n.image1Id,
                  })),
              ];
              //Iterate over the neighbors
              for (const neighbor of neighbors) {
                //Iterate over the annotations of the current image
                for (const annotation of imageAnnotations[imageId]) {
                  const transformedAnnotation = neighbor.transform([
                    annotation.x,
                    annotation.y,
                  ]);
                  //Check if the transformed annotation is inside the image bounds
                  if (
                    transformedAnnotation[0] >= 0 &&
                    transformedAnnotation[0] <= image.width &&
                    transformedAnnotation[1] >= 0 &&
                    transformedAnnotation[1] <= image.height
                  ) {
                    newLocations.push({
                      x: Math.round(transformedAnnotation[0]),
                      y: Math.round(transformedAnnotation[1]),
                      imageId: neighbor.imageId,
                      width: 100,
                      height: 100,
                      projectId: projectId,
                      confidence: 1,
                      source: 'other annotation',
                      setId: locationSetId,
                    });
                  }
                }
              }
            }
          }
          await Promise.all(
            newLocations.map((l) => client.models.Location.create(l))
          );
          break;
      }

      setLaunching(false);

      return locationSetId;
    },
    [
      // There should be a beter way to do this, but while prototyping, here is an endless list of dependencies
      allImages,
      backend,
      client,
      effectiveImageHeight,
      effectiveImageWidth,
      getImageId,
      getSqsClient,
      hasDevGeoTransect,
      height,
      horizontalTiles,
      minX,
      minY,
      modelId,
      name,
      projectId,
      scoutbotFile,
      selectedCategories,
      setImagesCompleted,
      taskType,
      transectGroupStats,
      transectSubsetSteps,
      threshold,
      verticalTiles,
      width,
      subsetN,
    ]
  );

  useEffect(() => {
    if (setHandleCreateTask) {
      setHandleCreateTask(() => handleSubmit);
    }
  }, [setHandleCreateTask, handleSubmit]);

  switch (taskType) {
    case 'tiled':
      return (
        <>
          <Form.Group className='d-flex flex-column gap-3 mt-2'>
            {process.env.NODE_ENV === 'development' && (
              <Form.Group
                className='p-2 border border-dark mb-2 shadow-sm'
                style={{ backgroundColor: '#697582' }}
              >
                {hasDevGeoTransect ? (
                  <>
                    <Form.Label className='mb-0'>
                      Per-transect subset steps
                    </Form.Label>
                    <span
                      className='d-block text-muted mb-2'
                      style={{ fontSize: '12px' }}
                    >
                      Computed distance (vincenty) and speed are based on the
                      first and last image of each transect. Steps use 1-based
                      indexing.
                    </span>
                    {transectGroupStats.map((g: any, idx: number) => (
                      <div
                        key={g.transectId}
                        className='d-flex align-items-center justify-content-between mb-2'
                      >
                        <div
                          className='me-3 text-white'
                          style={{ fontSize: '14px' }}
                        >
                          Transect {idx + 1}: {g.imageCount} images -{' '}
                          {g.distanceKm.toFixed(2)} km - {g.speedKmh.toFixed(2)}{' '}
                          km/h
                        </div>
                        <Form.Control
                          type='number'
                          style={{ maxWidth: 120 }}
                          value={transectSubsetSteps[g.transectId] ?? 1}
                          onChange={(e) =>
                            setTransectSubsetSteps((prev) => ({
                              ...prev,
                              [g.transectId]: Number(
                                (e.target as HTMLInputElement).value
                              ),
                            }))
                          }
                        />
                      </div>
                    ))}
                    <div
                      className='mt-2 text-white border-top border-dark pt-2'
                      style={{ fontSize: '12px' }}
                    >
                      {transectGroupStats.map((g: any, idx: number) => (
                        <div key={`exp-${g.transectId}`}>
                          Transect {idx + 1} expected images:{' '}
                          {expectedCounts.per[g.transectId] ?? 0}
                        </div>
                      ))}
                      <div className='fw-bold'>
                        Total expected images: {expectedCounts.total}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <Form.Label className='mb-0'>
                      Image Subset Step (n)
                    </Form.Label>
                    <span
                      className='d-block text-muted mb-2'
                      style={{ fontSize: '12px' }}
                    >
                      1-based indexing
                    </span>
                    <Form.Control
                      type='number'
                      value={subsetN}
                      disabled={loadingImages}
                      onChange={({ target: { value } }) =>
                        setSubsetN(Number(value))
                      }
                    />
                  </>
                )}
              </Form.Group>
            )}
          </Form.Group>
          <Form.Group
            className='border border-dark shadow-sm p-2'
            style={{ backgroundColor: '#697582' }}
          >
            {loadingImages ? (
              <div className='d-flex justify-content-center align-items-center text-white'>
                <Spinner animation='border' size='sm' className='me-2' />{' '}
                Loading images...
              </div>
            ) : (
              <Form.Label
                className='text-center'
                style={{ fontSize: 'smaller' }}
              >
                Detected image dimensions : {imageWidth}x{imageHeight}
              </Form.Label>
            )}
            <Form.Group className='mb-3 mt-3'>
              <LabeledToggleSwitch
                leftLabel='Specify number of tiles'
                rightLabel='Specify tile dimensions'
                checked={specifyTileDimensions}
                onChange={(checked) => {
                  setSpecifyTileDimensions(checked);
                }}
                disabled={loadingImages}
              />

              <div className='row'>
                <InputBox
                  label='Horizontal Tiles'
                  enabled={!specifyTileDimensions && !loadingImages}
                  getter={() => horizontalTiles}
                  setter={(x) => setHorizontalTiles(x)}
                />
                <InputBox
                  label='Vertical Tiles'
                  enabled={!specifyTileDimensions && !loadingImages}
                  getter={() => verticalTiles}
                  setter={(x) => setVerticalTiles(x)}
                />
                <InputBox
                  label='Width'
                  enabled={specifyTileDimensions && !loadingImages}
                  getter={() => width}
                  setter={(x) => setWidth(x)}
                />
                <InputBox
                  label='Height'
                  enabled={specifyTileDimensions && !loadingImages}
                  getter={() => height}
                  setter={(x) => setHeight(x)}
                />
              </div>
            </Form.Group>
            <Form.Group className='mb-3 mt-3'>
              <LabeledToggleSwitch
                leftLabel='Specify overlap (px)'
                rightLabel='Specify overlap (%)'
                checked={specifyOverlapInPercentage}
                onChange={(checked) => {
                  setSpecifyOverlapInPercentage(checked);
                }}
                disabled={loadingImages}
              />
              <div className='row'>
                <InputBox
                  label='Minimum sidelap (px)'
                  enabled={!specifyOverlapInPercentage && !loadingImages}
                  getter={() => minSidelap}
                  setter={(x) => setMinSidelap(x)}
                />
                <InputBox
                  label='Minimum overlap (px)'
                  enabled={!specifyOverlapInPercentage && !loadingImages}
                  getter={() => minOverlap}
                  setter={(x) => setMinOverlap(x)}
                />
                <InputBox
                  label='Minimum sidelap (%)'
                  enabled={specifyOverlapInPercentage && !loadingImages}
                  getter={() => minSidelapPercentage}
                  setter={(x) => setMinSidelapPercentage(x)}
                />
                <InputBox
                  label='Minimum overlap (%)'
                  enabled={specifyOverlapInPercentage && !loadingImages}
                  getter={() => minOverlapPercentage}
                  setter={(x) => setMinOverlapPercentage(x)}
                />
              </div>
              <div className='row'>
                <InputBox
                  label='Actual sidelap (px)'
                  enabled={false}
                  getter={() => getSidelapPixels()}
                />
                <InputBox
                  label='Actual overlap (px)'
                  enabled={false}
                  getter={() => getOverlapPixels()}
                />
                <InputBox
                  label='Actual sidelap (%)'
                  enabled={false}
                  getter={() => getSidelapPercent().toFixed(2)}
                />
                <InputBox
                  label='Actual overlap (%)'
                  enabled={false}
                  getter={() => getOverlapPercent().toFixed(2)}
                />
              </div>
            </Form.Group>
            <Form.Group className='mb-3 mt-3'>
              <LabeledToggleSwitch
                leftLabel='Process Entire Image'
                rightLabel='Specify Processing Borders'
                checked={specifyBorders}
                onChange={(checked) => {
                  setSpecifyBorders(checked);
                  setMinX(0);
                  setMaxX(imageWidth!);
                  setMinY(0);
                  setMaxY(imageHeight!);
                }}
                disabled={loadingImages}
              />
              {specifyBorders && (
                <>
                  <LabeledToggleSwitch
                    leftLabel='Specify Borders (px)'
                    rightLabel='Specify Borders (%)'
                    checked={specifyBorderPercentage}
                    onChange={(checked) => {
                      setSpecifyBorderPercentage(checked);
                    }}
                    disabled={loadingImages}
                  />
                  <div className='row'>
                    <InputBox
                      label='Minimum X (px)'
                      enabled={!specifyBorderPercentage && !loadingImages}
                      getter={() => minX}
                      setter={(x) => setMinX(x)}
                    />
                    <InputBox
                      label='Minimum Y (px)'
                      enabled={!specifyBorderPercentage && !loadingImages}
                      getter={() => minY}
                      setter={(x) => setMinY(x)}
                    />
                    <InputBox
                      label='Minimum X (%)'
                      enabled={specifyBorderPercentage && !loadingImages}
                      getter={() => Math.round((minX / imageWidth!) * 100)}
                      setter={(x) =>
                        setMinX(Math.round((imageWidth! * x) / 100))
                      }
                    />
                    <InputBox
                      label='Minimum Y (%)'
                      enabled={specifyBorderPercentage && !loadingImages}
                      getter={() => Math.round((minY / imageHeight!) * 100)}
                      setter={(x) =>
                        setMinY(Math.round((imageHeight! * x) / 100))
                      }
                    />
                  </div>
                  <div className='row'>
                    <InputBox
                      label='Maximum X (px)'
                      enabled={!specifyBorderPercentage && !loadingImages}
                      getter={() => maxX}
                      setter={(x) => setMaxX(x)}
                    />
                    <InputBox
                      label='Maximum Y (px)'
                      enabled={!specifyBorderPercentage && !loadingImages}
                      getter={() => maxY}
                      setter={(x) => setMaxY(x)}
                    />
                    <InputBox
                      label='Maximum X (%)'
                      enabled={specifyBorderPercentage && !loadingImages}
                      getter={() => Math.round((maxX / imageWidth!) * 100)}
                      setter={(x) =>
                        setMaxX(Math.round((imageWidth! * x) / 100))
                      }
                    />
                    <InputBox
                      label='Maximum Y (%)'
                      enabled={specifyBorderPercentage && !loadingImages}
                      getter={() => Math.round((maxY / imageHeight!) * 100)}
                      setter={(x) =>
                        setMaxY(Math.round((imageHeight! * x) / 100))
                      }
                    />
                  </div>
                </>
              )}
            </Form.Group>
            {launching && (
              <div className='d-flex justify-content-center align-items-center'>
                <Spinner animation='border' size='sm' className='me-2' />
                Preparing task...
              </div>
            )}
          </Form.Group>
        </>
      );
    case 'model':
      return (
        <div className='border border-dark shadow-sm p-2'>
          <Form.Group>
            <Form.Label>Model</Form.Label>
            <Form.Select
              aria-label='Select AI model to use to guide annotation'
              onChange={(e) => {
                setModelId(e.target.value);
                if (e.target.value !== 'scoutbot') {
                  setScoutbotFile(null);
                }
              }}
              value={modelId}
            >
              <option>Select AI model to use to guide annotation</option>
              <option value='ivx'>Elephant detection (nadir)</option>
              <option value='scoutbotV3'>ScoutBot v3</option>
              <option value='scoutbot'>ScoutBot export file</option>
            </Form.Select>
          </Form.Group>
          {modelId === 'scoutbot' && (
            <Form.Group className='mt-3'>
              <Form.Label>ScoutBot Input File</Form.Label>
              <div className='d-flex align-items-center'>
                <Form.Control
                  type='text'
                  readOnly
                  value={scoutbotFile ? scoutbotFile.name : ''}
                  placeholder='Select a ScoutBot export file'
                  onClick={() => fileInputRef.current?.click()}
                />
                <Button
                  variant='outline-primary'
                  onClick={() => fileInputRef.current?.click()}
                  className='ms-2'
                >
                  Browse
                </Button>
              </div>
              <Form.Control
                type='file'
                ref={fileInputRef}
                className='d-none'
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setScoutbotFile(file);
                  }
                }}
                accept='.csv'
              />
            </Form.Group>
          )}
        </div>
      );
    case 'annotation':
      return (
        <div className='border border-dark shadow-sm p-2'>
          <Form.Group>
            <Form.Label>Categories</Form.Label>
            <Form.Select
              onChange={(e) => {
                setSelectedCategories(e.target.value);
              }}
            >
              {labels.map((label) => (
                <option key={label.id} value={label.id}>
                  {label.name}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </div>
      );
  }
}

export default CreateTask;

function InputBox({
  label,
  enabled,
  getter,
  setter,
}: {
  label: string;
  enabled: boolean;
  getter: () => number | string;
  setter?: (x: number) => void;
}) {
  const [isFocused, setIsFocused] = useState(false);
  const [tempValue, setTempValue] = useState<string>('');

  const current = getter();

  return (
    <div className='col-md-3'>
      <Form.Group>
        <Form.Label>{label}</Form.Label>
        <Form.Control
          type='number'
          value={isFocused ? tempValue : current ?? ''}
          onFocus={() => {
            setIsFocused(true);
            setTempValue(current == null ? '' : String(current));
          }}
          onChange={(e) => {
            const value = (e.target as HTMLInputElement).value;
            setTempValue(value);
            if (!enabled || !setter) return;
            if (value === '') return; // allow empty while typing
            const parsed = Number(value);
            if (!Number.isNaN(parsed)) {
              setter(parsed);
            }
          }}
          onBlur={() => {
            setIsFocused(false);
            // Reset temp view to current external value on blur
            setTempValue('');
          }}
          disabled={!enabled}
        />
      </Form.Group>
    </div>
  );
}
