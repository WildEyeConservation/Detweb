import { useState, useCallback, useMemo, useContext } from 'react';
import BaseImage from '../BaseImage';
import LinkMaps from '../LinkMaps';
import L, { Map } from 'leaflet';
import type { ImageType } from '../schemaTypes';
import { ImageContext } from '../Context';
import { PointsOverlay, type Point } from '../ManualHomographyEditor';
import { Polygon, Polyline } from 'react-leaflet';

type Props = {
  images: [ImageType, ImageType];
  points: [Point[], Point[]];
  setPoints: [
    (updater: Point[] | ((prev: Point[]) => Point[])) => void,
    (updater: Point[] | ((prev: Point[]) => Point[])) => void,
  ];
  previewTransforms: [
    (c: [number, number]) => [number, number],
    (c: [number, number]) => [number, number],
  ] | null;
  onAction: () => void;
};

function LightImageContext({
  image,
  children,
}: {
  image: ImageType;
  children: React.ReactNode;
}) {
  const [zoom, setZoom] = useState(1);
  const [visibleTimestamp, setVisibleTimestamp] = useState<number | undefined>();
  const [fullyLoadedTimestamp, setFullyLoadedTimestamp] = useState<
    number | undefined
  >();

  const scale = useMemo(
    () =>
      Math.pow(
        2,
        Math.ceil(Math.log2(Math.max(image.width, image.height))) - 8
      ),
    [image.width, image.height]
  );

  const xy2latLng = useCallback(
    (
      input: L.Point | [number, number] | Array<L.Point | [number, number]>
    ): L.LatLng | L.LatLng[] => {
      if (Array.isArray(input)) {
        if (Array.isArray(input[0])) {
          return (input as [number, number][]).map((x) =>
            L.latLng(-x[1] / scale, x[0] / scale)
          );
        }
        const [lng, lat] = input as [number, number];
        return L.latLng(-lat / scale, lng / scale);
      }
      return L.latLng(-input.y / scale, input.x / scale);
    },
    [scale]
  );

  const latLng2xy = useCallback(
    (
      input: L.LatLng | [number, number] | Array<L.LatLng | [number, number]>
    ): L.Point | L.Point[] => {
      if (Array.isArray(input)) {
        if (Array.isArray(input[0])) {
          return (input as [number, number][]).map((x) =>
            L.point(x[1] * scale, -x[0] * scale)
          );
        }
        return L.point(
          (input as [number, number])[1] * scale,
          -(input as [number, number])[0] * scale
        );
      }
      return L.point(input.lng * scale, -input.lat * scale);
    },
    [scale]
  );

  return (
    <ImageContext.Provider
      value={
        {
          latLng2xy,
          xy2latLng,
          annotationsHook: {
            data: [],
            create: () => '',
            update: () => {},
            delete: () => {},
          },
          annoCount: 0,
          startLoadingTimestamp: Date.now(),
          visibleTimestamp,
          fullyLoadedTimestamp,
          setVisibleTimestamp,
          setFullyLoadedTimestamp,
          zoom,
          setZoom,
          prevImages: [],
          nextImages: [],
          queriesComplete: true,
        } as any
      }
    >
      {children}
    </ImageContext.Provider>
  );
}

const GRID_DIVISIONS = 8;
const GRID_SAMPLES_PER_LINE = 30;

function HomographyPreviewOverlay({
  otherImage,
  transform,
}: {
  otherImage: ImageType;
  transform: (c: [number, number]) => [number, number];
}) {
  const { xy2latLng } = useContext(ImageContext)!;

  const { outline, gridLines } = useMemo(() => {
    const w = otherImage.width;
    const h = otherImage.height;

    // Outline of the other image projected onto this image
    const corners: [number, number][] = [
      [0, 0],
      [w, 0],
      [w, h],
      [0, h],
    ];
    const outline = corners.map(transform);

    // Grid lines across the other image, projected onto this image
    const lines: [number, number][][] = [];

    // Vertical grid lines
    for (let i = 0; i <= GRID_DIVISIONS; i++) {
      const x = (w * i) / GRID_DIVISIONS;
      const line: [number, number][] = [];
      for (let j = 0; j <= GRID_SAMPLES_PER_LINE; j++) {
        const y = (h * j) / GRID_SAMPLES_PER_LINE;
        line.push(transform([x, y]));
      }
      lines.push(line);
    }

    // Horizontal grid lines
    for (let i = 0; i <= GRID_DIVISIONS; i++) {
      const y = (h * i) / GRID_DIVISIONS;
      const line: [number, number][] = [];
      for (let j = 0; j <= GRID_SAMPLES_PER_LINE; j++) {
        const x = (w * j) / GRID_SAMPLES_PER_LINE;
        line.push(transform([x, y]));
      }
      lines.push(line);
    }

    return { outline, gridLines: lines };
  }, [otherImage.width, otherImage.height, transform]);

  return (
    <>
      <Polygon
        pathOptions={{ color: '#00e5ff', weight: 3, fillOpacity: 0.05, dashArray: '8 4' }}
        positions={xy2latLng(outline) as L.LatLng[]}
      />
      {gridLines.map((line, idx) => (
        <Polyline
          key={idx}
          pathOptions={{ color: '#00e5ff', weight: 1, opacity: 0.4 }}
          positions={xy2latLng(line) as L.LatLng[]}
        />
      ))}
    </>
  );
}

export function HomographyPairViewer({
  images,
  points,
  setPoints,
  onAction,
  previewTransforms,
}: Props) {
  const [map1, setMap1] = useState<Map | null>(null);
  const [map2, setMap2] = useState<Map | null>(null);
  const [blocked, setBlocked] = useState(false);

  return (
    <div className='w-100 h-100 d-flex flex-row gap-3'>
      {images.map((image, i) => {
        const location = {
          id: `homography-${image.id}`,
          annotationSetId: 'stub',
          x: image.width / 2,
          y: image.height / 2,
          width: image.width,
          height: image.height,
          image,
        } as any;

        return (
          <div className='w-50 h-100' key={image.id}>
            <LightImageContext image={image}>
              <BaseImage
                image={image}
                visible={true}
                annotationSet={{ id: 'stub' } as any}
                location={location}
              >
                <PointsOverlay
                  points={points[i]}
                  setPoints={setPoints[i]}
                  onAction={onAction}
                />
                {previewTransforms && (
                  <>
                    <HomographyPreviewOverlay
                      otherImage={images[1 - i]}
                      transform={previewTransforms[1 - i]}
                    />
                    <LinkMaps
                      otherMap={[map2, map1][i]}
                      setMap={[setMap1, setMap2][i]}
                      transform={previewTransforms[i]}
                      blocked={blocked}
                      setBlocked={setBlocked}
                    />
                  </>
                )}
              </BaseImage>
            </LightImageContext>
          </div>
        );
      })}
    </div>
  );
}
