import type { MultiPolygon, Polygon } from 'geojson';
import type { Scene, Sensor } from '../interfaces/scene.interface.js';

// items.json의 STAC Item 중 우리가 읽는 필드만. 데이터는 깨끗하다고 보고 검사하지 않는다.
export interface StacItem {
  id: string;
  collection: string;
  geometry: Polygon | MultiPolygon;
  properties: {
    datetime: string;
    updated?: string;
    platform: string;
    'eo:cloud_cover'?: number;
    'sar:resolution_range'?: number;
  };
  assets: Record<string, { href: string; gsd?: number }>;
}

const SENSOR_BY_COLLECTION: Record<string, Sensor> = {
  'sentinel-2-l2a': 'EO',
  'sentinel-1-grd': 'SAR',
};

// S2 L2A id는 S2B_52SEH_20260717_1_L2A 꼴이고 가운데 숫자가 처리 번호다.
// 다른 컬렉션은 처리 번호가 없어서 id 그대로.
export function groupKeyOf(id: string): string {
  return id.replace(/_\d+_(?=L2A$)/, '_');
}

export function toScene(item: StacItem): Scene {
  const { id, collection, geometry, properties, assets } = item;
  const sensor = SENSOR_BY_COLLECTION[collection];
  // S1 썸네일은 s3:// (요금 버킷)이라 브라우저에서 못 연다
  const thumbnail = assets.thumbnail?.href;

  return {
    id,
    groupKey: groupKeyOf(id),
    collection,
    sensor,
    platform: properties.platform,
    acquiredAt: new Date(properties.datetime),
    cloudCover: sensor === 'EO' ? (properties['eo:cloud_cover'] ?? null) : null,
    // 해상도: S2는 10m 밴드(red)의 gsd, S1은 픽셀 간격이 아니라 실제 분해능(resolution_range)
    gsdM:
      sensor === 'EO' ? assets.red.gsd! : properties['sar:resolution_range']!,
    footprint: geometry,
    thumbnailUrl: thumbnail?.startsWith('https://') ? thumbnail : null,
    updatedAt: properties.updated ? new Date(properties.updated) : null,
    stac: item,
  };
}
