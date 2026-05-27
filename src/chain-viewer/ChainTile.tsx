import { useEffect, useRef, useState } from 'react';
import { ExternalLink, EyeOff, RotateCw } from 'lucide-react';
import { CHAIN_TILE_SIZE, fetchCenteredCrop } from './utils/tileCrop';
import type { AnnotationImageMeta, ChainAnnotation } from './types';

interface Props {
  annotation: ChainAnnotation;
  meta: AnnotationImageMeta | undefined;
  /** Loading state of the chain's image metadata (drives the hover popup). */
  metaLoading: boolean;
  categoryColor: string;
  /** Rotation in 90° steps. 0 = no rotation, 1 = -90°, 2 = -180°, 3 = -270°. */
  rotation: number;
  onRotate: () => void;
  /** Target for the "open image" button — uses the ImageLoader route. */
  openImageHref: string;
}

/**
 * Renders the centred thumbnail for a single annotation in the current chain.
 * The tile is composed in a canvas-backed `<img>` (object URL) once we have
 * the image's dimensions and sourceKey — both come from the chain meta-fetch
 * the harness kicks off on chain change.
 *
 * Hovering the tile reveals a bottom-overlay popup with the annotation's
 * image path and camera name. The popup is rendered inside the tile (rather
 * than above it) so the scroll container can't clip it.
 *
 * A small rotate button in the top-right rotates the image -90° per click;
 * the parent persists the rotation per camera so all tiles from the same
 * camera rotate together and the choice survives chain navigation.
 */
export function ChainTile({
  annotation,
  meta,
  metaLoading,
  categoryColor,
  rotation,
  onRotate,
  openImageHref,
}: Props) {
  const [imgSrc, setImgSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!meta || !meta.sourceKey) {
      setImgSrc(null);
      return;
    }
    let cancelled = false;
    setError(null);
    setImgSrc(null);
    fetchCenteredCrop({
      sourceKey: meta.sourceKey,
      imageWidth: meta.width,
      imageHeight: meta.height,
      x: annotation.x,
      y: annotation.y,
    })
      .then(({ canvas, markerX, markerY }) => {
        if (cancelled) return;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.beginPath();
          ctx.arc(markerX, markerY, 8, 0, Math.PI * 2);
          ctx.strokeStyle = categoryColor;
          ctx.lineWidth = 2;
          ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
          ctx.shadowBlur = 3;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
        canvas.toBlob((blob) => {
          if (cancelled || !blob) return;
          const url = URL.createObjectURL(blob);
          if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
          objectUrlRef.current = url;
          setImgSrc(url);
        });
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, [annotation.id, annotation.x, annotation.y, meta, categoryColor]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const popupPath = meta?.originalPath ?? null;
  const popupCamera = meta?.cameraName ?? meta?.cameraSerial ?? null;
  const rotationDeg = (rotation % 4) * 90;

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '1 / 1',
        background: '#1f2933',
        borderRadius: 6,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.1)',
      }}
      className='chain-viewer-tile'
    >
      {imgSrc ? (
        <img
          src={imgSrc}
          alt={`Annotation ${annotation.id}`}
          width={CHAIN_TILE_SIZE}
          height={CHAIN_TILE_SIZE}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            objectFit: 'cover',
            transform: `rotate(${rotationDeg}deg)`,
            transition: 'transform 180ms ease',
          }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#bcccdc',
            fontSize: 12,
          }}
        >
          {error ? 'Tile unavailable' : 'Loading…'}
        </div>
      )}
      {annotation.obscured && (
        <div
          className='chain-viewer-obscured-badge'
          title='Annotation marked as obscured'
        >
          <EyeOff size={11} strokeWidth={2.5} />
          <span>Obscured</span>
        </div>
      )}
      <button
        type='button'
        className='chain-viewer-tile-action chain-viewer-tile-action-1'
        onClick={(e) => {
          e.stopPropagation();
          onRotate();
        }}
        title='Rotate tile (and all tiles from this camera) 90°'
        aria-label='Rotate 90 degrees'
      >
        <RotateCw size={14} strokeWidth={2.5} />
      </button>
      <a
        className='chain-viewer-tile-action chain-viewer-tile-action-2'
        href={openImageHref}
        target='_blank'
        rel='noopener noreferrer'
        onClick={(e) => e.stopPropagation()}
        title='Open image in a new tab'
        aria-label='Open image in a new tab'
      >
        <ExternalLink size={14} strokeWidth={2.5} />
      </a>
      <div className='chain-viewer-tile-popup'>
        {metaLoading && !meta ? (
          <span style={{ fontStyle: 'italic', opacity: 0.7 }}>
            Loading image info…
          </span>
        ) : (
          <>
            <div style={{ fontWeight: 600, wordBreak: 'break-all' }}>
              {popupPath ?? 'Unknown path'}
            </div>
            <div style={{ opacity: 0.85, marginTop: 2 }}>
              Camera: {popupCamera ?? 'Unknown'}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
