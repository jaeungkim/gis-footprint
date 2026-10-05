import type { MultiPolygon, Polygon } from 'geojson';
import type { Prisma } from '../../generated/prisma/client.js';

// 리포지토리가 받는 검색 조건. HTTP(STAC)를 모른다. 16단계에서 구현을 바꿀 때 이 타입만 지킨다.
export type SortKey = 'id' | 'datetime' | 'eo:cloud_cover' | 'aoi:coverage_pct';

export interface SortSpec {
  key: SortKey;
  dir: 'asc' | 'desc';
}

export type DatetimeQuery =
  | { from: Date | null; to: Date | null } // 양끝 포함
  | { at: Date };

export interface SceneQuery {
  aoi: Polygon | MultiPolygon | null; // intersects 또는 bbox 폴리곤
  datetime: DatetimeQuery | null;
  collections: string[];
  ids: string[];
  predicate: Prisma.Sql | null; // CQL2 변환 결과. 컬럼 이름은 scene 테이블 그대로
  sort: SortSpec[]; // id를 포함한 전순서
  after: (string | number)[] | null; // 커서의 키 값. sort와 같은 순서
  limit: number; // 이미 1~100으로 잘린 값. +1은 리포지토리가 한다
}

export interface SceneRow {
  id: string;
  collection: string;
  stac: unknown;
  gsdM: number;
  geometry: MultiPolygon;
  bbox: [number, number, number, number];
  coverageKm2: number | null;
  coveragePct: number | null;
  sortValues: (string | number)[]; // 커서 생성용. datetime은 epoch ms
}

export interface SearchResult {
  rows: SceneRow[];
  matched: number;
  hasMore: boolean;
}

export interface CollectionStat {
  collection: string;
  bbox: [number, number, number, number];
  from: Date;
  to: Date;
  platforms: string[];
  gsds: number[];
}

export type AoiCheck = { valid: true } | { valid: false; reason: string };
