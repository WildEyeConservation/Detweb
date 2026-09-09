/**
 * Map the user's currently selected category onto the annotation set actually
 * being written to. If the selected category belongs to another set, fall back
 * to the same-named category in the target set, then to that set's 'Unknown'.
 */
export function resolveCategoryIdForSet(
  currentCategory: {
    id: string;
    name: string;
    annotationSetId?: string | null;
  },
  categories: Array<{
    id: string;
    name: string;
    annotationSetId?: string | null;
  }>,
  targetSetId: string
): string {
  if (currentCategory.annotationSetId === targetSetId)
    return currentCategory.id;
  const sameName = categories.find(
    (c) => c.annotationSetId === targetSetId && c.name === currentCategory.name
  );
  if (sameName) return sameName.id;
  const unknown = categories.find(
    (c) =>
      c.annotationSetId === targetSetId && c.name.toLowerCase() === 'unknown'
  );
  return unknown?.id ?? currentCategory.id;
}
