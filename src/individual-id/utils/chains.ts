import type { AnnotationType } from '../../schemaTypes';

type ImageAge = {
  timestamp?: number | null;
  originalPath?: string | null;
};

export interface ChainSplitPlan {
  chainSize: number;
  splitCount: number;
  retainedCount: number;
  newRootId: string;
  updates: Array<{ id: string; patch: Partial<AnnotationType> }>;
}

function isOlder(a: ImageAge, b: ImageAge): boolean {
  const at = a.timestamp ?? null;
  const bt = b.timestamp ?? null;
  if (at !== null && bt !== null) {
    if (at !== bt) return at < bt;
  } else {
    return false;
  }
  if (a.originalPath && b.originalPath) {
    return a.originalPath < b.originalPath;
  }
  return false;
}

export function buildChainSplitPlan(
  annotations: AnnotationType[],
  annotationId: string,
  ageOf: (imageId: string) => ImageAge
): ChainSplitPlan | null {
  const target = annotations.find((a) => a.id === annotationId);
  if (!target) return null;

  const chainKey = target.objectId ?? target.id;
  const chainMembers = annotations.filter(
    (a) => a.objectId === chainKey || a.id === chainKey
  );
  if (chainMembers.length <= 1) return null;

  const targetAge = ageOf(target.imageId);
  const retained = chainMembers.filter((a) =>
    isOlder(ageOf(a.imageId), targetAge)
  );
  if (retained.length === 0) return null;

  const split = chainMembers.filter((a) => !isOlder(ageOf(a.imageId), targetAge));
  if (split.length === 0 || split.length === chainMembers.length) return null;

  const newRootId = target.id;
  const updates = split
    .filter((a) => a.objectId !== newRootId)
    .map((a) => ({ id: a.id, patch: { objectId: newRootId } }));
  if (updates.length === 0) return null;

  return {
    chainSize: chainMembers.length,
    splitCount: split.length,
    retainedCount: retained.length,
    newRootId,
    updates,
  };
}
