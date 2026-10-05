import { ApiProperty } from '@nestjs/swagger';
import type { MultiPolygon, Polygon } from 'geojson';
import type { Scene, Sensor } from '../interfaces/scene.interface.js';

// swagger 플러그인은 중첩 배열과 geojson 타입을 못 읽어서 geometry 스키마는 직접 적는다.
const position = { type: 'array', items: { type: 'number' }, minItems: 2 };
const ring = { type: 'array', items: position, minItems: 4 };

const geometrySchema = {
  oneOf: [
    {
      type: 'object',
      required: ['type', 'coordinates'],
      properties: {
        type: { type: 'string', enum: ['Polygon'] },
        coordinates: { type: 'array', items: ring },
      },
    },
    {
      type: 'object',
      required: ['type', 'coordinates'],
      properties: {
        type: { type: 'string', enum: ['MultiPolygon'] },
        coordinates: { type: 'array', items: { type: 'array', items: ring } },
      },
    },
  ],
};

export class ScenePropertiesDto {
  @ApiProperty({ enum: ['EO', 'SAR'] })
  sensor: Sensor;

  /** 위성 (sentinel-2b, sentinel-1c 등) */
  platform: string;

  /** 촬영 시각, UTC ISO 8601 */
  acquiredAt: Date;

  /** 운량(%). SAR는 항상 null, EO도 원본에 없으면 null */
  @ApiProperty({ type: Number, nullable: true })
  cloudCover: number | null;

  /** 해상도(m) */
  gsdM: number;

  @ApiProperty({ type: String, nullable: true })
  thumbnailUrl: string | null;
}

/** GeoJSON Feature (RFC 7946) */
export class SceneFeatureDto {
  @ApiProperty({ enum: ['Feature'] })
  type: 'Feature';

  id: string;

  @ApiProperty(geometrySchema)
  geometry: Polygon | MultiPolygon;

  properties: ScenePropertiesDto;
}

export function toSceneFeature(scene: Scene): SceneFeatureDto {
  return {
    type: 'Feature',
    id: scene.id,
    geometry: scene.footprint,
    properties: {
      sensor: scene.sensor,
      platform: scene.platform,
      acquiredAt: scene.acquiredAt,
      cloudCover: scene.cloudCover,
      gsdM: scene.gsdM,
      thumbnailUrl: scene.thumbnailUrl,
    },
  };
}
