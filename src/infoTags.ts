import type { DataClient } from '../amplify/shared/data-schema.generated';
import { fetchAllPaginatedResults } from './utils';

export const INFO_TAG_CSV_DELIMITER = '|';

export type InfoTagSetData = {
  tagIdsByAnnotation: Map<string, string[]>;
  nameById: Map<string, string>;
};

export function formatInfoTagsForDisplay(names: string[]): string {
  return names
    .slice()
    .sort((a, b) => a.localeCompare(b))
    .join(', ');
}

export function formatInfoTagsForCsv(names: string[]): string {
  return names
    .map((name) => name.replace(/[|,]/g, '/'))
    .sort((a, b) => a.localeCompare(b))
    .join(INFO_TAG_CSV_DELIMITER);
}

// Query by annotation set to avoid scanning the link table per annotation.
export async function fetchInfoTagDataForSet(
  client: DataClient,
  annotationSetId: string,
  onProgress?: (count: number) => void
): Promise<InfoTagSetData> {
  const [links, tags] = await Promise.all([
    fetchAllPaginatedResults(
      client.models.AnnotationInfoTag.annotationInfoTagsByAnnotationSetId,
      {
        annotationSetId,
        selectionSet: ['annotationId', 'infoTagId'] as const,
        limit: 10000,
      },
      onProgress
    ),
    fetchAllPaginatedResults(client.models.InfoTag.infoTagsByAnnotationSetId, {
      annotationSetId,
      selectionSet: ['id', 'name'] as const,
      limit: 1000,
    }),
  ]);

  const tagIdsByAnnotation = new Map<string, string[]>();
  for (const link of links) {
    const tagIds = tagIdsByAnnotation.get(link.annotationId);
    if (tagIds) tagIds.push(link.infoTagId);
    else tagIdsByAnnotation.set(link.annotationId, [link.infoTagId]);
  }

  return {
    tagIdsByAnnotation,
    nameById: new Map(tags.map((tag) => [tag.id, tag.name])),
  };
}

export function infoTagNamesFor(
  data: InfoTagSetData,
  annotationId: string
): string[] {
  return (data.tagIdsByAnnotation.get(annotationId) ?? [])
    .map((id) => data.nameById.get(id))
    .filter((name): name is string => Boolean(name))
    .sort((a, b) => a.localeCompare(b));
}

export async function fetchInfoTagsForAnnotations(
  client: DataClient,
  annotationSetId: string,
  annotationIds: string[]
): Promise<Map<string, string[]>> {
  const data = await fetchInfoTagDataForSet(client, annotationSetId);
  const result = new Map<string, string[]>();
  for (const annotationId of new Set(annotationIds)) {
    result.set(annotationId, infoTagNamesFor(data, annotationId));
  }
  return result;
}

export async function fetchAllInfoTagsForSet(
  client: DataClient,
  annotationSetId: string,
  onProgress?: (count: number) => void
): Promise<Map<string, string[]>> {
  const data = await fetchInfoTagDataForSet(client, annotationSetId, onProgress);
  const result = new Map<string, string[]>();
  for (const annotationId of data.tagIdsByAnnotation.keys()) {
    result.set(annotationId, infoTagNamesFor(data, annotationId));
  }
  return result;
}

export async function attachInfoTagsToAnnotations<T extends { id: string }>(
  client: DataClient,
  annotations: T[],
  annotationSetId: string
): Promise<Array<T & { infoTags?: string[] }>> {
  const data = await fetchInfoTagDataForSet(client, annotationSetId);
  if (data.nameById.size === 0) return annotations;
  return annotations.map((annotation) => ({
    ...annotation,
    infoTags: infoTagNamesFor(data, annotation.id),
  }));
}

export async function hasInfoTagsForSet(
  client: DataClient,
  annotationSetId: string
): Promise<boolean> {
  const { data } = await client.models.InfoTag.infoTagsByAnnotationSetId(
    { annotationSetId },
    { selectionSet: ['id'] as const, limit: 1 }
  );
  return data.length > 0;
}
