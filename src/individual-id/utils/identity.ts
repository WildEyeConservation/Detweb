import {
  uniqueNamesGenerator,
  adjectives,
  names,
} from 'unique-names-generator';
import type { AnnotationType } from '../../schemaTypes';

/**
 * Deterministic two-word name (e.g. "Brave Sam") seeded by a candidate's
 * shared identity. Both sides of a linked pair share the same identityKey so
 * a hover on either side reveals the same name. Shared by the map popup and
 * the OOV side panel so the two stay consistent.
 */
export function nameFor(identityKey: string): string {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, names],
    seed: identityKey,
    style: 'capital',
    separator: ' ',
  });
}

/**
 * Whether an annotation is "out of view" (the animal is known to be on this
 * point but isn't visible in this image due to plane yaw/roll). OOV rows
 * carry no meaningful on-image position and are rendered in the side panel
 * instead of on the map.
 *
 * Reads via a cast because `oov` is a freshly-added schema field — the
 * generated `AnnotationType` won't include it until the backend is deployed
 * and types are regenerated. The cast is harmless once the field lands.
 */
export function isOov(
  a: AnnotationType | { oov?: boolean | null } | null | undefined
): boolean {
  return !!(a as { oov?: boolean | null } | null | undefined)?.oov;
}
