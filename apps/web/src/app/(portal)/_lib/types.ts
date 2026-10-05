import type { PolygonGeometry } from "@/lib/geo";

export type Sensor = "eo" | "sar";
export type SortPreset = "latest" | "coverage" | "cloud";

export interface Aoi {
  id: string;
  name: string;
  geometry: PolygonGeometry;
}

export interface SearchConditions {
  from: string | null; // KST 날짜 YYYY-MM-DD
  to: string | null;
  sensors: Sensor[];
  cloud: number; // 100이면 조건 없음
  platforms: string[];
  gsd: number | null;
  sort: SortPreset;
}

export type Cql2 = { op: string; args: unknown[] };

export interface SearchBody {
  intersects?: PolygonGeometry;
  datetime?: string;
  collections: string[];
  filter?: Cql2;
  sortby: {
    field:
      | "properties.datetime"
      | "properties.aoi:coverage_pct"
      | "properties.eo:cloud_cover";
    direction: "asc" | "desc";
  }[];
  limit: number;
}

export type BlockReason = "no-sensor" | "date-range";

export type SearchBodyResult =
  { ok: true; body: SearchBody } | { ok: false; reason: BlockReason };

// 화면에서 쓰는 필드만. 응답은 Swagger 타입이 없어서 여기서 정의한다.
export interface StacItem {
  type: "Feature";
  id: string;
  collection: string;
  geometry: PolygonGeometry;
  properties: {
    datetime: string;
    platform: string;
    gsd?: number;
    "eo:cloud_cover"?: number | null;
    "aoi:coverage_km2"?: number;
    "aoi:coverage_pct"?: number;
    "grid:code"?: string; // EO: MGRS 타일
    "view:sun_elevation"?: number;
    "sar:instrument_mode"?: string;
    "sar:polarizations"?: string[];
    "sat:orbit_state"?: "ascending" | "descending";
    "sat:relative_orbit"?: number;
  };
  assets: Record<string, { href: string } | undefined>;
}

export interface ItemCollection {
  type: "FeatureCollection";
  features: StacItem[];
  numberMatched: number;
  links: { rel: string; body?: { token?: string } }[];
}
