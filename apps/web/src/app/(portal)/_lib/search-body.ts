// 검색 조건(URL) → STAC Item Search POST 본문.
import type { PolygonGeometry } from "@/lib/geo";
import { COLLECTION_BY_SENSOR, PAGE_SIZE } from "./constants";
import type {
  Cql2,
  SearchBody,
  SearchBodyResult,
  SearchConditions,
  SortPreset,
} from "./types";

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
  aoi: PolygonGeometry | null,
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
