import { useState, useEffect, useCallback, useRef } from 'react';
import type { ImageType } from '../schemaTypes';

/**
 * Pair manifest entry as downloaded from S3.
 */
export type ManifestPair = {
  image1: {
    id: string;
    width: number;
    height: number;
    timestamp: number | null;
    lat: number | null;
    lon: number | null;
    altitude: number | null;
  };
  image2: {
    id: string;
    width: number;
    height: number;
    timestamp: number | null;
    lat: number | null;
    lon: number | null;
    altitude: number | null;
  };
  existingHomography: number[] | null;
};

export type PairState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; images: [ImageType, ImageType]; existingHomography: number[] | null }
  | { status: 'error'; error: Error };

/**
 * Custom preloader that maintains a sliding window of pair slots.
 * Loads image metadata for pairs around the current index.
 */
export function useHomographyPreloader(
  pairs: ManifestPair[],
  currentIndex: number,
  client: any,
) {
  const [pairStates, setPairStates] = useState<Map<number, PairState>>(new Map());
  const loadingRef = useRef<Set<number>>(new Set());
  // Track saved homographies from this session
  const [savedHomographies, setSavedHomographies] = useState<Map<number, number[]>>(new Map());

  const loadPair = useCallback(async (index: number) => {
    if (index < 0 || index >= pairs.length) return;
    if (loadingRef.current.has(index)) return;

    const current = pairStates.get(index);
    if (current?.status === 'ready' || current?.status === 'loading') return;

    loadingRef.current.add(index);
    setPairStates(prev => new Map(prev).set(index, { status: 'loading' }));

    try {
      const pair = pairs[index];
      const [img1Resp, img2Resp] = await Promise.all([
        client.models.Image.get({ id: pair.image1.id }),
        client.models.Image.get({ id: pair.image2.id }),
      ]);

      const img1 = img1Resp?.data as ImageType | null;
      const img2 = img2Resp?.data as ImageType | null;

      if (!img1 || !img2) {
        throw new Error(`Image not found: ${!img1 ? pair.image1.id : pair.image2.id}`);
      }

      const existingH = savedHomographies.get(index) ?? pair.existingHomography ?? null;

      setPairStates(prev => new Map(prev).set(index, {
        status: 'ready',
        images: [img1, img2],
        existingHomography: existingH,
      }));
    } catch (error) {
      setPairStates(prev => new Map(prev).set(index, {
        status: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    } finally {
      loadingRef.current.delete(index);
    }
  }, [pairs, client, pairStates, savedHomographies]);

  // Load pairs in the window around currentIndex
  useEffect(() => {
    const windowStart = Math.max(0, currentIndex - 2);
    const windowEnd = Math.min(pairs.length - 1, currentIndex + 2);
    const windowIndices = new Set<number>();

    for (let i = windowStart; i <= windowEnd; i++) {
      windowIndices.add(i);
      loadPair(i);
    }

    // Clear entries outside the window
    setPairStates(prev => {
      const next = new Map(prev);
      for (const [idx] of next) {
        if (!windowIndices.has(idx)) {
          next.delete(idx);
        }
      }
      return next;
    });
  }, [currentIndex, pairs.length]);

  const currentPair = pairStates.get(currentIndex) ?? { status: 'idle' as const };

  const recordSavedHomography = useCallback((index: number, H: number[]) => {
    setSavedHomographies(prev => new Map(prev).set(index, H));
    // Update the pair state if it's loaded
    setPairStates(prev => {
      const current = prev.get(index);
      if (current?.status === 'ready') {
        return new Map(prev).set(index, { ...current, existingHomography: H });
      }
      return prev;
    });
  }, []);

  return {
    currentPair,
    pairStates,
    recordSavedHomography,
  };
}
