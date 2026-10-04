import assert from "node:assert/strict";
import { test } from "node:test";
import { toSearchBody, type SearchConditions } from "./stac-search.ts";

const base: SearchConditions = {
  from: null,
  to: null,
  sensors: ["eo", "sar"],
  cloud: 100,
  platforms: [],
  gsd: null,
  sort: "latest",
};
const aoi = {
  type: "Polygon" as const,
  coordinates: [
    [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 0],
    ],
  ],
};
const body = (c: Partial<SearchConditions>) => {
  const r = toSearchBody({ ...base, ...c }, aoi);
  assert.ok(r.ok);
  return r.body;
};
const cloudLe = (x: number) => ({
  op: "<=",
  args: [{ property: "eo:cloud_cover" }, x],
});
const platformEq = (p: string) => ({
  op: "=",
  args: [{ property: "platform" }, p],
});

test("기본값: 두 컬렉션, 최신순, filter 없음", () => {
  assert.deepEqual(body({}), {
    intersects: aoi,
    collections: ["sentinel-2-l2a", "sentinel-1-grd"],
    sortby: [{ field: "properties.datetime", direction: "desc" }],
    limit: 20,
  });
});

test("센서 없음은 검색하지 않는다", () => {
  assert.deepEqual(toSearchBody({ ...base, sensors: [] }, aoi), {
    ok: false,
    reason: "no-sensor",
  });
});

test("KST 날짜를 양끝 포함 구간으로", () => {
  assert.equal(
    body({ from: "2026-07-01", to: "2026-07-31" }).datetime,
    "2026-07-01T00:00:00+09:00/2026-07-31T23:59:59.999+09:00",
  );
  assert.equal(
    body({ from: "2026-07-01" }).datetime,
    "2026-07-01T00:00:00+09:00/..",
  );
  assert.equal(
    body({ to: "2026-07-31" }).datetime,
    "../2026-07-31T23:59:59.999+09:00",
  );
  assert.equal(
    body({ from: "2026-07-01", to: "2026-07-01" }).datetime,
    "2026-07-01T00:00:00+09:00/2026-07-01T23:59:59.999+09:00",
  );
  assert.deepEqual(
    toSearchBody({ ...base, from: "2026-08-01", to: "2026-07-01" }, aoi),
    { ok: false, reason: "date-range" },
  );
});

test("운량: EO+SAR는 SAR를 살린다, EO만은 그대로, SAR만은 무시", () => {
  assert.deepEqual(body({ cloud: 20 }).filter, {
    op: "or",
    args: [
      { op: "=", args: [{ property: "collection" }, "sentinel-1-grd"] },
      cloudLe(20),
    ],
  });
  assert.deepEqual(body({ cloud: 20, sensors: ["eo"] }).filter, cloudLe(20));
  assert.equal(body({ cloud: 20, sensors: ["sar"] }).filter, undefined);
  assert.deepEqual(body({ cloud: 0, sensors: ["eo"] }).filter, cloudLe(0));
});

test("위성, GSD, 여러 조건은 and", () => {
  assert.deepEqual(
    body({ platforms: ["sentinel-2a"] }).filter,
    platformEq("sentinel-2a"),
  );
  assert.deepEqual(
    body({
      sensors: ["eo"],
      cloud: 30,
      platforms: ["sentinel-2a", "sentinel-2b"],
      gsd: 10,
    }).filter,
    {
      op: "and",
      args: [
        cloudLe(30),
        {
          op: "or",
          args: [platformEq("sentinel-2a"), platformEq("sentinel-2b")],
        },
        { op: "<=", args: [{ property: "gsd" }, 10] },
      ],
    },
  );
});

test("정렬 프리셋, AOI 없으면 커버리지 정렬은 최신순", () => {
  assert.deepEqual(body({ sort: "coverage" }).sortby, [
    { field: "properties.aoi:coverage_pct", direction: "desc" },
  ]);
  assert.deepEqual(body({ sort: "cloud" }).sortby, [
    { field: "properties.eo:cloud_cover", direction: "asc" },
  ]);
  const r = toSearchBody({ ...base, sort: "coverage" }, null);
  assert.ok(r.ok);
  assert.equal(r.body.intersects, undefined);
  assert.deepEqual(r.body.sortby, [
    { field: "properties.datetime", direction: "desc" },
  ]);
});
