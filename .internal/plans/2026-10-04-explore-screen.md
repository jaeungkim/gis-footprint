# 탐색 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use beads-superpowers:subagent-driven-development (recommended) or beads-superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 로드맵 3단계 탐색 화면(지도 + 필터 + 결과 목록)을 `/api/stac/search` 위에 만든다.

**Architecture:** 검색 조건은 nuqs로 URL에, hover/선택은 zustand에, 서버 상태는 TanStack `useInfiniteQuery`에 둔다. 조건 → STAC 본문 변환은 순수 함수 하나(`stac-search.ts`)가 맡고 `node --test`로 검증한다. 지도는 기존 `BaseMap`에 source/layer와 feature-state를 붙인다.

**Tech Stack:** Next.js 16 App Router, nuqs 2.10, TanStack Query 5, zustand 5, MapLibre GL 6, openapi-fetch.

**Spec:** `.internal/specs/2026-10-04-explore-screen-design.md`

## Global Constraints

- 새 런타임/개발 의존성 없음.
- 사용자에게 보이는 문구는 한국어.
- 시각은 `Asia/Seoul`로 표시, 입력 날짜는 KST로 해석.
- FE는 `next.href`를 따라가지 않고 `next.body.token`만 쓴다.
- 커밋 전 `pnpm lint`, web `pnpm test`, api `pnpm test` 통과.

---

### Task 1: STAC 검색 본문 변환 (순수 함수 + 테스트)

**Files:**
- Create: `apps/web/src/features/catalog/stac-search.ts`
- Create: `apps/web/src/features/catalog/stac-search.test.ts`
- Modify: `apps/web/tsconfig.json` (`allowImportingTsExtensions: true`)
- Modify: `apps/web/package.json` (`"test": "node --test \"src/**/*.test.ts\""`)

**Interfaces:**
- Produces: `toSearchBody(params: SearchConditions, aoi: AoiGeometry | null): SearchBodyResult`, 타입 `SearchConditions`, `SearchBody`, `AoiGeometry`, `StacItem`, `ItemCollection`, 상수 `COLLECTION_BY_SENSOR`, `PAGE_SIZE`.

**Acceptance Criteria:**
- 센서 둘 다 끄면 `{ ok: false, reason: "no-sensor" }`, `from > to`면 `"date-range"`.
- KST 날짜 → `T00:00:00+09:00` / `T23:59:59.999+09:00`, 열린 쪽 `..`.
- 운량: EO+SAR는 `or(collection = 'sentinel-1-grd', cloud <= X)`, EO만은 `cloud <= X`, SAR만·100이면 생략.
- 위성 `or(platform = ...)`, GSD `gsd <= X`, 여럿이면 `and`.
- 정렬 3종, AOI 없으면 coverage → latest.
- `node --test` 통과.

- [ ] Step 1: 테스트 작성 (`stac-search.test.ts`)

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { toSearchBody, type SearchConditions } from "./stac-search.ts";

const base: SearchConditions = {
  from: null, to: null, sensors: ["eo", "sar"], cloud: 100,
  platforms: [], gsd: null, sort: "latest",
};
const aoi = { type: "Polygon" as const, coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] };
const body = (c: Partial<SearchConditions>, a = aoi) => {
  const r = toSearchBody({ ...base, ...c }, a);
  assert.ok(r.ok);
  return r.body;
};
const cloudLe = (x: number) => ({ op: "<=", args: [{ property: "eo:cloud_cover" }, x] });

test("기본값: 두 컬렉션, 최신순, filter 없음", () => {
  assert.deepEqual(body({}), {
    intersects: aoi, collections: ["sentinel-2-l2a", "sentinel-1-grd"],
    sortby: [{ field: "properties.datetime", direction: "desc" }], limit: 20,
  });
});

test("센서 없음은 검색하지 않는다", () => {
  assert.deepEqual(toSearchBody({ ...base, sensors: [] }, aoi), { ok: false, reason: "no-sensor" });
});

test("KST 날짜를 양끝 포함 구간으로", () => {
  assert.equal(body({ from: "2026-07-01", to: "2026-07-31" }).datetime,
    "2026-07-01T00:00:00+09:00/2026-07-31T23:59:59.999+09:00");
  assert.equal(body({ from: "2026-07-01" }).datetime, "2026-07-01T00:00:00+09:00/..");
  assert.equal(body({ to: "2026-07-31" }).datetime, "../2026-07-31T23:59:59.999+09:00");
  assert.deepEqual(toSearchBody({ ...base, from: "2026-08-01", to: "2026-07-01" }, aoi),
    { ok: false, reason: "date-range" });
});

test("운량: EO+SAR는 SAR를 살린다, EO만은 그대로, SAR만은 무시", () => {
  assert.deepEqual(body({ cloud: 20 }).filter, {
    op: "or", args: [{ op: "=", args: [{ property: "collection" }, "sentinel-1-grd"] }, cloudLe(20)],
  });
  assert.deepEqual(body({ cloud: 20, sensors: ["eo"] }).filter, cloudLe(20));
  assert.equal(body({ cloud: 20, sensors: ["sar"] }).filter, undefined);
});

test("위성, GSD, 여러 조건은 and", () => {
  assert.deepEqual(body({ platforms: ["sentinel-2a"] }).filter,
    { op: "=", args: [{ property: "platform" }, "sentinel-2a"] });
  assert.deepEqual(body({ sensors: ["eo"], cloud: 30, platforms: ["sentinel-2a", "sentinel-2b"], gsd: 10 }).filter, {
    op: "and", args: [
      cloudLe(30),
      { op: "or", args: [
        { op: "=", args: [{ property: "platform" }, "sentinel-2a"] },
        { op: "=", args: [{ property: "platform" }, "sentinel-2b"] }] },
      { op: "<=", args: [{ property: "gsd" }, 10] }],
  });
});

test("정렬 프리셋, AOI 없으면 커버리지 정렬은 최신순", () => {
  assert.deepEqual(body({ sort: "coverage" }).sortby, [{ field: "properties.aoi:coverage_pct", direction: "desc" }]);
  assert.deepEqual(body({ sort: "cloud" }).sortby, [{ field: "properties.eo:cloud_cover", direction: "asc" }]);
  const r = toSearchBody({ ...base, sort: "coverage" }, null);
  assert.ok(r.ok);
  assert.equal(r.body.intersects, undefined);
  assert.deepEqual(r.body.sortby, [{ field: "properties.datetime", direction: "desc" }]);
});
```

- [ ] Step 2: `pnpm --filter @footprint/web test` → 모듈 없음으로 FAIL.
- [ ] Step 3: 구현 (`stac-search.ts`). 값 import 없이 타입만(노드 타입 스트리핑).

```ts
// 검색 조건(URL) → STAC Item Search POST 본문. 순수 함수라 node --test로 돈다.

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
  sortby: { field: string; direction: "asc" | "desc" }[];
  limit: number;
  token?: string;
}

export type SearchBodyResult =
  | { ok: true; body: SearchBody }
  | { ok: false; reason: "no-sensor" | "date-range" };

export interface StacItem {
  type: "Feature";
  id: string;
  collection: string;
  geometry: AoiGeometry;
  bbox: [number, number, number, number];
  properties: {
    datetime: string;
    platform: string;
    "eo:cloud_cover"?: number | null;
    "aoi:coverage_km2"?: number;
    "aoi:coverage_pct"?: number;
  };
  assets: Record<string, { href: string }>;
}

export interface ItemCollection {
  type: "FeatureCollection";
  features: StacItem[];
  numberMatched: number;
  numberReturned: number;
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

const prop = (property: string) => ({ property });
const eq = (p: string, v: unknown): Cql2 => ({ op: "=", args: [prop(p), v] });
const le = (p: string, v: unknown): Cql2 => ({ op: "<=", args: [prop(p), v] });
const any = (xs: Cql2[]): Cql2 => (xs.length === 1 ? xs[0] : { op: "or", args: xs });

export function toSearchBody(c: SearchConditions, aoi: AoiGeometry | null): SearchBodyResult {
  if (c.sensors.length === 0) return { ok: false, reason: "no-sensor" };
  // YYYY-MM-DD는 사전순 = 날짜순
  if (c.from && c.to && c.from > c.to) return { ok: false, reason: "date-range" };

  const body: SearchBody = {
    collections: c.sensors.map((s) => COLLECTION_BY_SENSOR[s]),
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
    // SAR는 운량이 null이라 CQL2에서 떨어진다. 같이 고른 SAR는 살린다.
    filters.push(c.sensors.includes("sar") ? any([eq("collection", COLLECTION_BY_SENSOR.sar), cloud]) : cloud);
  }
  if (c.platforms.length > 0) filters.push(any(c.platforms.map((p) => eq("platform", p))));
  if (c.gsd !== null) filters.push(le("gsd", c.gsd));
  if (filters.length > 0) body.filter = filters.length === 1 ? filters[0] : { op: "and", args: filters };

  return { ok: true, body };
}
```

- [ ] Step 4: tsconfig에 `"allowImportingTsExtensions": true`, package.json `test` 스크립트. `pnpm --filter @footprint/web test` → PASS.
- [ ] Step 5: Commit `feat(web): build STAC search body from explore conditions`.

### Task 2: API `POST /search` 200 + 타입 재생성

**Files:**
- Modify: `apps/api/src/modules/stac/search.controller.ts` (`@HttpCode(200)` on `post`)
- Modify: `apps/web/src/lib/schema.d.ts` (재생성)

**Acceptance Criteria:**
- `POST /api/stac/search` 응답 200.
- `schema.d.ts`에 `/api/stac/search` 경로 존재.

- [ ] Step 1: `import { Body, Controller, Get, Header, HttpCode, Post, Query }`, `post` 위에 `@HttpCode(200)`.
- [ ] Step 2: api 재시작 후 `curl -s -o /dev/null -w '%{http_code}' -X POST localhost:3001/api/stac/search -H 'content-type: application/json' -d '{}'` → `200`.
- [ ] Step 3: `pnpm --filter @footprint/web gen:api`, `pnpm --filter @footprint/api test`.
- [ ] Step 4: Commit `fix(api): answer STAC POST search with 200`.

### Task 3: URL 상태, 검색 훅, 선택 스토어

**Files:**
- Create: `apps/web/src/features/catalog/search-params.ts`
- Create: `apps/web/src/features/catalog/use-scene-search.ts`
- Create: `apps/web/src/features/catalog/selection-store.ts`

**Interfaces:**
- Consumes: `SearchBody`, `ItemCollection` (Task 1), `api` (`@/lib/api`).
- Produces: `searchParamsParsers`, `useSearchConditions()`, `useSceneSearch(body: SearchBody | null)`, `usePlatforms()`, `useSelection` (zustand: `hoveredId`, `selectedId`, `selectedFrom`, `hover(id)`, `select(id, from)`).

**Acceptance Criteria:**
- 타입 체크 통과. 동작 검증은 Task 5.

- [ ] Step 1: `search-params.ts`

```ts
import {
  parseAsArrayOf, parseAsFloat, parseAsInteger, parseAsIsoDate,
  parseAsString, parseAsStringLiteral, useQueryStates,
} from "nuqs";

export const searchParamsParsers = {
  aoi: parseAsString,
  from: parseAsIsoDate,
  to: parseAsIsoDate,
  sensors: parseAsArrayOf(parseAsStringLiteral(["eo", "sar"] as const)).withDefault(["eo", "sar"]),
  cloud: parseAsInteger.withDefault(100),
  platforms: parseAsArrayOf(parseAsString).withDefault([]),
  gsd: parseAsFloat,
  sort: parseAsStringLiteral(["latest", "coverage", "cloud"] as const).withDefault("latest"),
};

export const useSearchConditions = () => useQueryStates(searchParamsParsers);

// parseAsIsoDate는 UTC 자정 Date. 날짜 문자열로 되돌린다.
export const toDateString = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);
```

- [ ] Step 2: `use-scene-search.ts`

```ts
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ItemCollection, SearchBody } from "./stac-search";

type Problem = { title?: string; detail?: string };

export function useSceneSearch(body: SearchBody | null) {
  return useInfiniteQuery({
    queryKey: ["stac-search", body],
    enabled: body !== null,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error, response } = await api.POST("/api/stac/search", {
        body: { ...body!, token: pageParam },
        signal,
      });
      if (!response.ok) {
        const p = error as Problem | undefined;
        throw new Error(p?.detail ?? p?.title ?? `검색 실패 (${response.status})`);
      }
      return data as unknown as ItemCollection;
    },
    getNextPageParam: (last) => last.links.find((l) => l.rel === "next")?.body?.token,
  });
}

// 센서별 위성 목록 (컬렉션 summaries.platform)
export function usePlatforms() {
  return useQuery({
    queryKey: ["stac-collections"],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, response } = await api.GET("/api/stac/collections");
      if (!response.ok) throw new Error(`컬렉션 조회 실패 (${response.status})`);
      const { collections } = data as unknown as {
        collections: { id: string; summaries?: { platform?: string[] } }[];
      };
      return Object.fromEntries(collections.map((c) => [c.id, c.summaries?.platform ?? []]));
    },
  });
}
```

- [ ] Step 3: `selection-store.ts`

```ts
import { create } from "zustand";

interface Selection {
  hoveredId: string | null;
  selectedId: string | null;
  selectedFrom: "map" | "list" | null; // 지도에서 고르면 목록이 스크롤한다
  hover: (id: string | null) => void;
  select: (id: string | null, from: "map" | "list") => void;
}

export const useSelection = create<Selection>((set) => ({
  hoveredId: null,
  selectedId: null,
  selectedFrom: null,
  hover: (hoveredId) => set({ hoveredId }),
  select: (selectedId, selectedFrom) => set({ selectedId, selectedFrom }),
}));
```

- [ ] Step 4: `pnpm --filter @footprint/web exec tsc --noEmit`. Commit `feat(web): URL search state, STAC search query, selection store`.

### Task 4: 화면 (페이지, 필터 패널, 목록, 지도)

**Files:**
- Modify: `apps/web/src/app/(portal)/page.tsx` (서버: `data/aois.geojson` 읽기, Suspense)
- Create: `apps/web/src/features/catalog/components/explore.tsx` (클라이언트 조립)
- Modify: `apps/web/src/features/catalog/components/scene-filter-panel.tsx`
- Modify: `apps/web/src/features/catalog/components/scene-list.tsx`
- Modify: `apps/web/src/features/map/components/base-map.tsx`

**Interfaces:**
- Consumes: Task 1, 3 전부.
- Produces: `Aoi = { id: string; name: string; geometry: AoiGeometry }`, `<Explore aois>`, `<SceneFilterPanel aois blocked>`, `<SceneList search blocked>`, `<BaseMap aoi scenes>`.

**Acceptance Criteria:** 스펙 "화면" 절 전부. 코드는 실행 단계에서 이 계획의 인터페이스대로 작성(지도 레이어 id `aoi-fill`, `aoi-line`, `scene-fill`, `scene-line`, source `aoi`, `scenes`, `promoteId: "id"`, `setStyle(style, { diff: false })` + `style.load`에서 재추가와 feature-state 재적용).

- [ ] Step 1: page.tsx — `readFile(path.join(process.cwd(), "../../data/aois.geojson"))` → `Aoi[]`, `<Suspense><Explore aois={aois} /></Suspense>`.
- [ ] Step 2: explore.tsx — `useSearchConditions`, AOI 찾기, `toSearchBody`, `useSceneSearch`, `scenes = pages.flatMap(features)`, 그리드에 패널·목록·지도.
- [ ] Step 3: 필터 패널 — AOI select, 날짜 2개, 센서 체크박스(끌 때 그 센서 위성 선택 제거), 위성 체크박스(`usePlatforms`, 켠 센서만), 운량 range(로컬 draft, pointerup/keyup 커밋), GSD number, 정렬 select(AOI 없으면 coverage 비활성). `blocked` 사유 안내.
- [ ] Step 4: 목록 — `numberMatched`, 항목(썸네일 https만, 위성, KST, 운량, 커버리지), hover/click → store, 지도 선택 시 `scrollIntoView`, 로딩 스켈레톤, 없음, 에러 + 다시 시도, IntersectionObserver sentinel.
- [ ] Step 5: 지도 — 위 인터페이스대로. AOI 바뀌면 `fitBounds`(좌표 순회 bbox, padding 48).
- [ ] Step 6: `pnpm lint`, `tsc --noEmit`. Commit `feat(web): explore screen with map, filters, and infinite results`.

### Task 5: 브라우저 검증 + 문서

**Files:**
- Modify: `docs/decisions.md` (3단계 가정), `README.md` (1, 2, 3 체크)

**Acceptance Criteria:**
- 브라우저에서: AOI 선택 → 이동·표시, 목록 hover → 지도 강조, 지도 클릭 → 목록 스크롤, 새로고침 후 같은 결과, 스크롤 끝 → 다음 페이지, 센서 둘 다 끔 → 안내, API 오류 → 에러 상태, 다크 모드 전환 후 레이어 유지. 콘솔 에러 없음.

- [ ] Step 1: preview_start `web`, 위 항목 확인, 스크린샷.
- [ ] Step 2: decisions.md "탐색 화면 (3단계)" 가정 추가: AOI 없으면 전체 검색, 위성 AND, EO+SAR 운량, 썸네일 https만, 운량 슬라이더 놓을 때 반영.
- [ ] Step 3: Commit `docs: stage 3 explore screen assumptions`.
