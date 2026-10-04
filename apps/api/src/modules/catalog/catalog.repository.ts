import { Injectable } from '@nestjs/common';
import type { MultiPolygon, Polygon } from 'geojson';
import { Prisma } from '../../generated/prisma/client.js';
import { toOriginalType } from '../../geo/polygon.js';
import { PrismaService } from '../../prisma.service.js';
import type { Scene, Sensor } from './scene.js';
import type {
  AoiCheck,
  CollectionStat,
  SceneQuery,
  SearchResult,
} from './scene-query.js';
import { buildSearchSql } from './search.sql.js';

// 저장소를 갈아 끼우는 자리. 16단계에서 성능을 바꿀 때 이 구현만 건드린다.
// abstract class라서 Nest DI 토큰으로도 쓴다.
export abstract class CatalogRepository {
  abstract saveAll(
    scenes: Scene[],
  ): Promise<{ rejected: { id: string; reason: string }[] }>;
  abstract findById(id: string): Promise<Scene | null>;
  abstract validateAoi(aoi: Polygon | MultiPolygon): Promise<AoiCheck>;
  abstract search(q: SceneQuery): Promise<SearchResult>;
  abstract collectionStats(): Promise<CollectionStat[]>;
}

const { sql } = Prisma;

interface DbScene {
  id: string;
  group_key: string;
  collection: string;
  sensor: Sensor;
  platform: string;
  acquired_at: Date;
  cloud_cover: number | null;
  gsd_m: number;
  footprint: string;
  thumbnail_url: string | null;
  updated_at: Date | null;
  stac: unknown;
}

interface SearchRow extends Record<string, unknown> {
  id: string;
  collection: string;
  stac: unknown;
  geometry: string;
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
  coverage_km2: number | null;
  coverage_pct: number | null;
  matched: number;
}

// footprint는 Unsupported 컬럼이라 Prisma 클라이언트 메서드가 없다. 전부 raw SQL.
@Injectable()
export class PostgisCatalogRepository extends CatalogRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async saveAll(scenes: Scene[]) {
    if (scenes.length === 0) return { rejected: [] };

    // 손으로 짠 polygon.ts는 링 하나만 본다. 구멍 위치나 폴리곤 겹침은 DB에 묻는다.
    const shapes = JSON.stringify(
      scenes.map((s) => ({ id: s.id, footprint: JSON.stringify(s.footprint) })),
    );
    const rejected = await this.prisma.$queryRaw<
      { id: string; reason: string }[]
    >(sql`
      SELECT r.id, ST_IsValidReason(x.g) AS reason
      FROM jsonb_to_recordset(${shapes}::jsonb) AS r(id text, footprint text),
           LATERAL (SELECT ST_SetSRID(ST_GeomFromGeoJSON(r.footprint), 4326) AS g) x
      WHERE NOT ST_IsValid(x.g)`);
    const bad = new Set(rejected.map((r) => r.id));

    const rows = JSON.stringify(
      scenes
        .filter((s) => !bad.has(s.id))
        .map((s) => ({
          id: s.id,
          group_key: s.groupKey,
          collection: s.collection,
          sensor: s.sensor,
          platform: s.platform,
          acquired_at: s.acquiredAt.toISOString(),
          cloud_cover: s.cloudCover,
          gsd_m: s.gsdM,
          footprint: JSON.stringify(s.footprint),
          thumbnail_url: s.thumbnailUrl,
          updated_at: s.updatedAt?.toISOString() ?? null,
          stac: s.stac,
        })),
    );
    // updated가 더 늦을 때만 덮어쓴다. 재시작해도 결과가 같고 6단계 수집도 이 문장을 쓴다.
    await this.prisma.$executeRaw(sql`
      INSERT INTO scene (id, group_key, collection, sensor, platform, acquired_at, cloud_cover, gsd_m, footprint, thumbnail_url, updated_at, stac)
      SELECT id, group_key, collection, sensor::"Sensor", platform, acquired_at, cloud_cover, gsd_m,
             ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(footprint), 4326)), thumbnail_url, updated_at, stac
      FROM jsonb_to_recordset(${rows}::jsonb) AS r(
             id text, group_key text, collection text, sensor text, platform text,
             acquired_at timestamptz, cloud_cover float8, gsd_m float8, footprint text,
             thumbnail_url text, updated_at timestamptz, stac jsonb)
      ON CONFLICT (id) DO UPDATE SET
        (group_key, collection, sensor, platform, acquired_at, cloud_cover, gsd_m, footprint, thumbnail_url, updated_at, stac)
        = (excluded.group_key, excluded.collection, excluded.sensor, excluded.platform, excluded.acquired_at,
           excluded.cloud_cover, excluded.gsd_m, excluded.footprint, excluded.thumbnail_url, excluded.updated_at, excluded.stac)
      WHERE excluded.updated_at > coalesce(scene.updated_at, '-infinity')`);
    return { rejected };
  }

  async findById(id: string): Promise<Scene | null> {
    const [r] = await this.prisma.$queryRaw<DbScene[]>(sql`
      SELECT id, group_key, collection, sensor, platform, acquired_at, cloud_cover, gsd_m,
             ST_AsGeoJSON(footprint) AS footprint, thumbnail_url, updated_at, stac
      FROM scene WHERE id = ${id}`);
    if (!r) return null;
    return {
      id: r.id,
      groupKey: r.group_key,
      collection: r.collection,
      sensor: r.sensor,
      platform: r.platform,
      acquiredAt: r.acquired_at,
      cloudCover: r.cloud_cover,
      gsdM: r.gsd_m,
      footprint: toOriginalType(JSON.parse(r.footprint) as MultiPolygon, r.stac),
      thumbnailUrl: r.thumbnail_url,
      updatedAt: r.updated_at,
      stac: r.stac,
    };
  }

  async validateAoi(aoi: Polygon | MultiPolygon): Promise<AoiCheck> {
    const [r] = await this.prisma.$queryRaw<
      { valid: boolean; reason: string; area: number }[]
    >(sql`
      SELECT ST_IsValid(g) AS valid, ST_IsValidReason(g) AS reason,
             CASE WHEN ST_IsValid(g) THEN ST_Area(g::geography) ELSE 0 END AS area
      FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(aoi)}), 4326) AS g) t`);
    if (!r.valid) return { valid: false, reason: r.reason };
    if (!(r.area > 0)) return { valid: false, reason: '면적이 0' };
    return { valid: true };
  }

  async search(q: SceneQuery): Promise<SearchResult> {
    const rows = await this.prisma.$queryRaw<SearchRow[]>(buildSearchSql(q));
    const hasMore = rows.length > q.limit;
    const page = hasMore ? rows.slice(0, q.limit) : rows;
    return {
      rows: page.map((r) => ({
        id: r.id,
        collection: r.collection,
        stac: r.stac,
        geometry: JSON.parse(r.geometry) as MultiPolygon,
        bbox: [r.xmin, r.ymin, r.xmax, r.ymax],
        coverageKm2: r.coverage_km2,
        coveragePct: r.coverage_pct,
        sortValues: q.sort.map((_, i) => {
          const v = r[`sort_${i}`];
          return v instanceof Date ? v.getTime() : (v as string | number);
        }),
      })),
      matched: rows[0]?.matched ?? 0,
      hasMore,
    };
  }

  async collectionStats(): Promise<CollectionStat[]> {
    const rows = await this.prisma.$queryRaw<
      {
        collection: string;
        xmin: number;
        ymin: number;
        xmax: number;
        ymax: number;
        from: Date;
        to: Date;
        platforms: string[];
        gsds: number[];
      }[]
    >(sql`
      SELECT collection, ST_XMin(ext) AS xmin, ST_YMin(ext) AS ymin, ST_XMax(ext) AS xmax, ST_YMax(ext) AS ymax,
             "from", "to", platforms, gsds
      FROM (
        SELECT collection, ST_Extent(footprint)::geometry AS ext,
               min(acquired_at) AS "from", max(acquired_at) AS "to",
               array_agg(DISTINCT platform ORDER BY platform) AS platforms,
               array_agg(DISTINCT gsd_m ORDER BY gsd_m) AS gsds
        FROM scene GROUP BY collection) t
      ORDER BY collection`);
    return rows.map((r) => ({
      collection: r.collection,
      bbox: [r.xmin, r.ymin, r.xmax, r.ymax],
      from: r.from,
      to: r.to,
      platforms: r.platforms,
      gsds: r.gsds,
    }));
  }
}
