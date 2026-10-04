import { findPolygonError } from '../../../geo/polygon.js';
import type { Scene, Sensor } from '../scene.js';
import { stacItemSchema } from './stac-item.schema.js';

export type RejectReason =
  'INVALID_SCHEMA' | 'UNSUPPORTED_COLLECTION' | 'INVALID_GEOMETRY';

export type ToSceneResult =
  | { ok: true; scene: Scene }
  | { ok: false; id: string | null; reason: RejectReason; detail: string };

const SENSOR_BY_COLLECTION: Record<string, Sensor> = {
  'sentinel-2-l2a': 'EO',
  'sentinel-1-grd': 'SAR',
};

export function toScene(input: unknown): ToSceneResult {
  const parsed = stacItemSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const detail = `${issue.path.join('.')}: ${issue.message}`;
    return reject(idOf(input), 'INVALID_SCHEMA', detail);
  }
  const { id, collection, geometry, properties, assets } = parsed.data;

  const sensor = SENSOR_BY_COLLECTION[collection];
  if (!sensor) return reject(id, 'UNSUPPORTED_COLLECTION', collection);

  const polygonError = findPolygonError(geometry);
  if (polygonError) return reject(id, 'INVALID_GEOMETRY', polygonError);

  // 해상도: S2는 10m 밴드(red)의 gsd, S1은 픽셀 간격이 아니라 실제 분해능(resolution_range)
  const gsdM =
    sensor === 'EO' ? assets.red?.gsd : properties['sar:resolution_range'];
  if (gsdM === undefined) return reject(id, 'INVALID_SCHEMA', 'gsd 없음');

  // S1 썸네일은 s3:// (요금 버킷)이라 브라우저에서 못 연다
  const thumbnail = assets.thumbnail?.href;

  return {
    ok: true,
    scene: {
      id,
      sensor,
      platform: properties.platform,
      acquiredAt: new Date(properties.datetime),
      cloudCover:
        sensor === 'EO' ? (properties['eo:cloud_cover'] ?? null) : null,
      gsdM,
      footprint: geometry,
      thumbnailUrl: thumbnail?.startsWith('https://') ? thumbnail : null,
      stac: input,
    },
  };
}

function idOf(input: unknown): string | null {
  if (typeof input !== 'object' || input === null || !('id' in input)) {
    return null;
  }
  return typeof input.id === 'string' ? input.id : null;
}

function reject(
  id: string | null,
  reason: RejectReason,
  detail: string,
): ToSceneResult {
  return { ok: false, id, reason, detail };
}
