/**
 * Public surface of the individual-id workflow.
 *
 * Wire `<IndividualIdHarness />` into a route, e.g.
 *
 *   path: '/surveys/:projectId/individual-id'
 *   element: <IndividualIdHarness />
 *
 * The harness reads `transectId`, `categoryId` and (optionally)
 * `annotationSetId` and `leniency` from the query string.
 */
export { IndividualIdHarness } from './IndividualIdHarness';
export { IndividualIdMapPair } from './IndividualIdMapPair';
export type { MatchCandidate, NeighbourPair, PairCompletionState } from './types';
