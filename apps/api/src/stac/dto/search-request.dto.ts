import { BadRequestException } from '@nestjs/common';
import type { MultiPolygon, Polygon } from 'geojson';
import { z } from 'zod';
import { geometrySchema } from '../../geo/geometry.schema.js';
import { findPolygonError, rewind } from '../../geo/polygon.js';
import type { DatetimeQuery } from '../../catalog/interfaces/scene-query.interface.js';
import { cql2Schema } from '../cql2/cql2.schema.js';
import { SORTABLE_NAMES } from '../queryables.js';
import { MAX_SORT_FIELDS, parseSortbyParam } from '../sortby.js';

export const DEFAULT_LIMIT = 10;
export const MAX_LIMIT = 100;
export const MAX_IDS = 100;
export const MAX_AOI_POINTS = 5000;

const sortbyItem = z.strictObject({
  field: z.enum(SORTABLE_NAMES),
  direction: z.enum(['asc', 'desc']),
});

// POST 본문. GET은 queryToBody()로 같은 모양으로 만든 뒤 이 스키마를 통과한다. 모르는 필드는 버린다.
export const searchBodySchema = z.object({
  intersects: geometrySchema.optional(),
  bbox: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  datetime: z.string().min(1).optional(),
  collections: z.array(z.string().min(1)).optional(),
  ids: z.array(z.string().min(1)).max(MAX_IDS).optional(),
  // 명세: 최대값 초과는 400이 아니라 최대값으로 자른다
  limit: z
    .int()
    .min(1)
    .transform((v) => Math.min(v, MAX_LIMIT))
    .optional(),
  token: z.string().min(1).optional(),
  sortby: z.array(sortbyItem).min(1).max(MAX_SORT_FIELDS).optional(),
  filter: cql2Schema.optional(),
  'filter-lang': z
    .literal('cql2-json', { error: 'cql2-json만 지원' })
    .optional(),
});

export type SearchBody = z.infer<typeof searchBodySchema>;

function bad(message: string): never {
  throw new BadRequestException(message);
}

function parseJson(s: string, name: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    bad(`${name}: JSON이 아님`);
  }
}

// GET 쿼리 파라미터 → POST 본문 모양. 리스트는 콤마 구분, intersects와 filter는 JSON 문자열.
export function queryToBody(
  query: Record<string, unknown>,
): Record<string, unknown> {
  const get = (k: string): string | undefined => {
    const v = query[k];
    if (Array.isArray(v)) return v.map(String).join(',');
    return typeof v === 'string' ? v : undefined;
  };

  const body: Record<string, unknown> = {};
  const intersects = get('intersects');
  if (intersects !== undefined)
    body.intersects = parseJson(intersects, 'intersects');

  const bbox = get('bbox');
  if (bbox !== undefined) body.bbox = bbox.split(',').map(Number);

  for (const k of ['datetime', 'token']) {
    const v = get(k);
    if (v !== undefined) body[k] = v;
  }

  for (const k of ['collections', 'ids']) {
    const v = get(k);
    if (v !== undefined) body[k] = v.split(',').filter(Boolean);
  }

  const limit = get('limit');
  if (limit !== undefined) body.limit = Number(limit);

  const sortby = get('sortby');
  if (sortby !== undefined) body.sortby = parseSortbyParam(sortby);

  const filter = get('filter');
  if (filter !== undefined) {
    body.filter = parseJson(filter, 'filter');
    // GET의 filter-lang 기본은 cql2-text인데 우리는 지원하지 않는다. 스키마에서 400이 난다.
    body['filter-lang'] = get('filter-lang') ?? 'cql2-text';
  }

  return body;
}

const iso = z.iso.datetime({ offset: true });

// "start/end", "../end", "start/..", 단일 시각. RFC 3339, 양끝 포함.
export function parseDatetime(s: string): DatetimeQuery {
  const parts = s.split('/');
  if (parts.length === 1) {
    if (!iso.safeParse(s).success) bad(`datetime: RFC 3339가 아님 (${s})`);
    return { at: new Date(s) };
  }

  if (parts.length !== 2) bad('datetime: "start/end" 형식이어야 함');
  const [a, b] = parts;
  if (a === '..' && b === '..') bad('datetime: 양쪽이 다 열린 구간');
  for (const p of [a, b]) {
    if (p !== '..' && !iso.safeParse(p).success)
      bad(`datetime: RFC 3339가 아님 (${p})`);
  }

  const from = a === '..' ? null : new Date(a);
  const to = b === '..' ? null : new Date(b);
  if (from && to && from > to) bad('datetime: 시작이 끝보다 늦음');

  return { from, to };
}

export function bboxToPolygon([w, s, e, n]: [
  number,
  number,
  number,
  number,
]): Polygon {
  if (
    Math.abs(w) > 180 ||
    Math.abs(e) > 180 ||
    Math.abs(s) > 90 ||
    Math.abs(n) > 90
  ) {
    bad('bbox: 경위도 범위 밖');
  }
  if (!(w < e && s < n)) bad('bbox: west < east, south < north 여야 함');

  return {
    type: 'Polygon',
    coordinates: [
      [
        [w, s],
        [e, s],
        [e, n],
        [w, n],
        [w, s],
      ],
    ],
  };
}

function countPositions(g: Polygon | MultiPolygon): number {
  const polygons = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  return polygons.flat().reduce((n, ring) => n + ring.length, 0);
}

// intersects 또는 bbox → AOI 폴리곤. 둘 다면 400(명세). 구조 검사는 여기, 위상 검사는 DB(validateAoi).
export function resolveAoi(body: SearchBody): Polygon | MultiPolygon | null {
  if (body.intersects && body.bbox) bad('intersects와 bbox는 함께 쓸 수 없음');

  if (body.intersects) {
    const error = findPolygonError(body.intersects);
    if (error) bad(`intersects: ${error}`);
    if (countPositions(body.intersects) > MAX_AOI_POINTS) {
      bad(`intersects: 좌표가 ${MAX_AOI_POINTS}개를 넘음`);
    }

    return rewind(body.intersects);
  }

  if (body.bbox) return bboxToPolygon(body.bbox);
  return null;
}
