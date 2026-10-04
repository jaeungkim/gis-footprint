// 검색 조건(URL) → STAC Item Search POST 본문. 값 import가 없어야 node --test로 바로 돈다.

export type Sensor = "eo" | "sar";
export type SortPreset = "latest" | "coverage" | "cloud";

export type AoiGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

export interface SearchConditions {
  from: string | null; // KST 날짜 YYYY-MM-DD
  to: string | null;
  sensors: Sensor[];
  cloud: number; // 100이면 조건 없음
  platforms: string[];
  gsd: number | null;
  sort: SortPreset;
}

type Cql2 = { op: string; args: unknown[] };

export interface SearchBody {
  intersects?: AoiGeometry;
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

export type SearchBodyResult =
  | { ok: true; body: SearchBody }
  | { ok: false; reason: "no-sensor" | "date-range" };

// 화면에서 쓰는 필드만. 응답은 Swagger 타입이 없어서 여기서 정의한다.
export interface StacItem {
  type: "Feature";
  id: string;
  collection: string;
  geometry: AoiGeometry;
  properties: {
    datetime: string;
    platform: string;
    "eo:cloud_cover"?: number | null;
    "aoi:coverage_km2"?: number;
    "aoi:coverage_pct"?: number;
  };
  assets: Record<string, { href: string } | undefined>;
}

export interface ItemCollection {
  type: "FeatureCollection";
  features: StacItem[];
  numberMatched: number;
  links: { rel: string; body?: { token?: string } }[];
}

export const COLLECTION_BY_SENSOR: Record<Sensor, string> = {
  eo: "sentinel-2-l2a",
  sar: "sentinel-1-grd",
};
export const PAGE_SIZE = 20;

const SORTBY: Record<SortPreset, SearchBody["sortby"]> = {
  latest: [{ field: "properties.datetime", direction: "desc" }],
  coverage: [{ field: "properties.aoi:coverage_pct", direction: "desc" }],
  cloud: [{ field: "properties.eo:cloud_cover", direction: "asc" }],
};

const eq = (property: string, v: unknown): Cql2 => ({
  op: "=",
  args: [{ property }, v],
});
const le = (property: string, v: unknown): Cql2 => ({
  op: "<=",
  args: [{ property }, v],
});
const anyOf = (xs: Cql2[]): Cql2 =>
  xs.length === 1 ? xs[0] : { op: "or", args: xs };

export function toSearchBody(
  c: SearchConditions,
  aoi: AoiGeometry | null,
): SearchBodyResult {
  if (c.sensors.length === 0) return { ok: false, reason: "no-sensor" };
  // YYYY-MM-DD는 사전순이 곧 날짜순
  if (c.from && c.to && c.from > c.to)
    return { ok: false, reason: "date-range" };

  const body: SearchBody = {
    collections: c.sensors.map((s) => COLLECTION_BY_SENSOR[s]),
    // 커버리지는 공간 조건이 있어야 계산된다
    sortby: SORTBY[c.sort === "coverage" && !aoi ? "latest" : c.sort],
    limit: PAGE_SIZE,
  };
  if (aoi) body.intersects = aoi;
  if (c.from || c.to) {
    const from = c.from ? `${c.from}T00:00:00+09:00` : "..";
    const to = c.to ? `${c.to}T23:59:59.999+09:00` : "..";
    body.datetime = `${from}/${to}`;
  }

  const filters: Cql2[] = [];
  if (c.cloud < 100 && c.sensors.includes("eo")) {
    const cloud = le("eo:cloud_cover", c.cloud);
    // SAR는 운량이 null이라 CQL2 비교에서 떨어진다. 같이 고른 SAR는 살린다.
    filters.push(
      c.sensors.includes("sar")
        ? anyOf([eq("collection", COLLECTION_BY_SENSOR.sar), cloud])
        : cloud,
    );
  }
  if (c.platforms.length > 0)
    filters.push(anyOf(c.platforms.map((p) => eq("platform", p))));
  if (c.gsd !== null) filters.push(le("gsd", c.gsd));
  if (filters.length > 0)
    body.filter =
      filters.length === 1 ? filters[0] : { op: "and", args: filters };

  return { ok: true, body };
}
