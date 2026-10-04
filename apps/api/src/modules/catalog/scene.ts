import type { MultiPolygon, Polygon } from 'geojson';

export type Sensor = 'EO' | 'SAR';

export interface Scene {
  id: string;
  sensor: Sensor;
  platform: string;
  acquiredAt: Date;
  cloudCover: number | null; // SAR는 항상 null
  gsdM: number;
  footprint: Polygon | MultiPolygon;
  thumbnailUrl: string | null;
  updatedAt: Date | null; // STAC properties.updated, 같은 id끼리 최신 판별용
  stac: unknown;
}
