declare module 'shpjs' {
  import type { FeatureCollection } from 'geojson';
  export default function shp(input: ArrayBuffer | string): Promise<FeatureCollection | FeatureCollection[]>;
}
