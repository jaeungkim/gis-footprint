import { Prisma } from '../generated/prisma/client.js';
import type { SortKey } from '../catalog/interfaces/scene-query.interface.js';

// CQL2 filter에서 쓸 수 있는 속성. 컬럼은 여기서만 꺼내므로 사용자 입력이 SQL 텍스트가 되지 않는다.
export type QueryableType = 'string' | 'number' | 'timestamp';

export interface Queryable {
  column: Prisma.Sql;
  type: QueryableType;
  description: string;
}

export const QUERYABLES: Record<string, Queryable> = {
  id: { column: Prisma.sql`id`, type: 'string', description: 'Item id' },
  collection: {
    column: Prisma.sql`collection`,
    type: 'string',
    description: 'Collection id',
  },
  datetime: {
    column: Prisma.sql`acquired_at`,
    type: 'timestamp',
    description: '촬영 시각 (UTC). 리터럴은 {"timestamp": "RFC 3339"}',
  },
  platform: {
    column: Prisma.sql`platform`,
    type: 'string',
    description: '위성 (sentinel-2a 등)',
  },
  'eo:cloud_cover': {
    column: Prisma.sql`cloud_cover`,
    type: 'number',
    description: '운량 (%). SAR는 값이 없어서 비교에 안 걸린다',
  },
  gsd: { column: Prisma.sql`gsd_m`, type: 'number', description: '해상도 (m)' },
};

export const QUERYABLE_NAMES = Object.keys(QUERYABLES) as [string, ...string[]];

// sortby 필드 → 리포지토리 정렬 키
export const SORTABLES: Record<string, SortKey> = {
  id: 'id',
  'properties.datetime': 'datetime',
  'properties.eo:cloud_cover': 'eo:cloud_cover',
  'properties.aoi:coverage_pct': 'aoi:coverage_pct',
};

export const SORTABLE_NAMES = Object.keys(SORTABLES) as [string, ...string[]];

const JSON_TYPES: Record<QueryableType, Record<string, string>> = {
  string: { type: 'string' },
  number: { type: 'number' },
  timestamp: { type: 'string', format: 'date-time' },
};

export function queryablesSchema(id: string) {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: id,
    type: 'object',
    title: 'Footprint STAC API queryables',
    properties: Object.fromEntries(
      Object.entries(QUERYABLES).map(([name, q]) => [
        name,
        { ...JSON_TYPES[q.type], description: q.description },
      ]),
    ),
    additionalProperties: false,
  };
}

export function sortablesSchema(id: string) {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: id,
    type: 'object',
    title: 'Footprint STAC API sortables',
    properties: Object.fromEntries(
      SORTABLE_NAMES.map((name) => [
        name,
        name === 'properties.aoi:coverage_pct'
          ? { type: 'number', description: 'AOI 대비 커버리지 (%). intersects나 bbox가 있을 때만' }
          : {},
      ]),
    ),
    additionalProperties: false,
  };
}
