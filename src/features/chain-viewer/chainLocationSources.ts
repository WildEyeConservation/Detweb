import type { LocationSourceConfig } from '../individual-id/MapLocationOverlay';

/** Detection sources whose location boxes can be toggled on each map. */
export const CHAIN_LOCATION_SOURCES: LocationSourceConfig[] = [
  { source: 'scoutbotv3', label: 'ScoutBot', color: '#2f80ed' },
  { source: 'heatmap', label: 'Elephant Nadir', color: '#e67e22' },
  { source: 'mad-v2', label: 'MAD', color: '#27ae60' },
  { source: 'stormfly-testing', label: 'Stormfly (testing model)', color: '#9b59b6' },
  { source: 'owl-d', label: 'OWL-D', color: '#d45e43' },
];
