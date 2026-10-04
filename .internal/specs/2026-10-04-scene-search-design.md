# 2단계 영상 검색 API 설계 — STAC API + PostGIS

2026-10-04. 로드맵 2단계(영상 검색 API)를 STAC API로 구현하고, 16단계에 있던 PostGIS 도입을 앞당겨 같이 한다.

## 목표

- `/api/stac/*`에 STAC API(Core, Item Search, Filter, Sort, Collections)를 올린다.
- 카탈로그를 PostGIS에 저장한다. 메모리 리포지토리는 지운다.
- 로드맵 2단계 필수(AOI 교차 검색, 기간·센서·운량·해상도·위성 조건, 정렬 3종, 커버리지, 커서, 400 Problem Details, 단위 테스트)를 전부 만족한다.
- 안 하는 것: `cql2-text`, Advanced 비교(`in`, `like`, `between`), Fields 확장, `/collections/:id/items`(Features 클래스), 성능 측정(16단계).

## 조사 근거

실제 API 조사 결과(원문은 세션 기록):

- 위성영상 업계는 Planet(자체 `filter` 트리 + `_sort` 프리셋 + `_links._next`)만 빼고 전부 STAC이다. Earth Search(우리 데이터 출처), Sentinel Hub, UP42, Copernicus, Planetary Computer.
- 지리공간 API는 FeatureCollection을 감싸지 않고 페이지 정보를 같은 층에 둔다(OGC `numberMatched`/`numberReturned`, STAC `links[next]`). STAC Context 확장(`context: {returned, limit, matched}`)은 Deprecated.
- 페이지 토큰은 불투명, 페이지 사이에 조건이 바뀌면 400(Google AIP-158). Earth Search는 정렬값 자체를 커서로 쓴다(keyset).
- 명세 확인: `GET /search` 필수, POST 권장. `intersects`+`bbox` 동시면 400. `limit` 초과는 400이 아니라 최대값으로 자른다. 랜딩 페이지에 `service-desc` 필수. Item이 컬렉션에 속하면 `collection` 필드와 `rel=collection` 링크 필수. Filter 확장은 Query 확장 대신 권장.

## 결정 사항

| 항목 | 결정 | 이유 |
| --- | --- | --- |
| API | 처음부터 STAC API. 자체 검색 API는 만들지 않음 | 업계 표준이 STAC. 로드맵 심화의 "STAC 호환 엔드포인트"가 본체가 됨 |
| 저장소 | 지금 바로 PostGIS. 6단계 Postgres JSON 컬럼, 16단계 PostGIS 이전은 삭제 | 공간 연산을 DB에서 배움. 16단계는 성능 측정으로 남김 |
| 적재 시점 | 서버 시작 시 upsert | 1단계 요구(서버가 뜰 때 적재, 요약 로그) 유지. 재시작해도 결과 동일 |
| 컬럼 타입 | `geometry(MultiPolygon, 4326)` + GiST. 면적은 `::geography` | 타입과 SRID를 DB가 강제. 교차는 geometry가 빠름 |
| 속성 필터 | Filter 확장, CQL2-JSON Basic 부분집합. `cql2-text` 미지원 | 명세가 권하는 쪽. 텍스트 파서는 범위 밖 |
| null 의미 | CQL2 그대로. `eo:cloud_cover <= 20`에 SAR(null)는 안 걸림 | 표준 클라이언트가 예상하는 결과. 제품 규칙(센서 둘 다 + 운량)은 FE가 `or(collection = 'sentinel-1-grd', ...)`로 표현 |
| 기간 | `datetime` 구간 문자열, 양끝 포함 | STAC/OGC 규칙. KST 날짜→시각 변환은 FE |
| 정렬 | Sort 확장 `sortby`. 필드 4개, 방향 자유, 최대 3개 + `id desc` 자동 | 로드맵 3종은 FE 프리셋 |
| 재처리본 | `group_key`로 묶어 최신 하나만. `ids`로 콕 집으면 옛본도 줌. DB에는 둘 다 | 고객 눈에 중복이면 안 됨 |
| 커서 | `token`. 불투명 base64url, keyset, 조건 해시 불일치면 400 | AIP-158 규칙. offset은 데이터가 들어오면 밀림 |
| 링크 href | 상대 경로(`/api/stac/...`) | web이 `/api/*`를 프록시해 origin이 둘. STAC Link는 상대 허용 |
| 커버리지 | `properties["aoi:coverage_km2"]`, `["aoi:coverage_pct"]`. 공간 조건 있을 때만 | `footprint:`는 프로젝트 이름이자 geometry 뜻이라 혼동 |
| 검증 | zod + `z.toJSONSchema()`로 Swagger | CQL2 재귀 구조는 class-validator로 못 함. zod 이미 의존성 |
| 에러 | RFC 9457 Problem Details | spec.md 규칙. STAC은 에러 형식을 정하지 않음 |
| `GET /api/scenes/:id` | 유지 | 1단계 요구. FE가 STAC만 쓰게 되면 그때 정리 |
| 날짜변경선 AOI | 지원 안 함 | 한반도만 다룸 |

## 엔드포인트

전부 `/api/stac` 아래.

| 경로 | 내용 |
| --- | --- |
| `GET /api/stac` | 랜딩 페이지(Catalog). `type: "Catalog"`, `stac_version: "1.0.0"`, `id: "footprint"`, `description`, `conformsTo`, `links` |
| `GET /api/stac/conformance` | `{ "conformsTo": [...] }` |
| `GET /api/stac/collections` | `{ "collections": [...], "links": [...] }`. 컬렉션 2개 |
| `GET /api/stac/collections/:id` | Collection 단건. 없으면 404 |
| `GET /api/stac/queryables` | JSON Schema. `id`, `collection`, `datetime`, `platform`, `eo:cloud_cover`, `gsd`. `additionalProperties: false` |
| `GET /api/stac/sortables` | JSON Schema. `id`, `properties.datetime`, `properties.eo:cloud_cover`, `properties.aoi:coverage_pct` |
| `GET /api/stac/search` | 쿼리 파라미터 검색 |
| `POST /api/stac/search` | JSON 본문 검색 |

`conformsTo`:

```
https://api.stacspec.org/v1.0.0/core
https://api.stacspec.org/v1.0.0/item-search
https://api.stacspec.org/v1.0.0/item-search#filter
https://api.stacspec.org/v1.0.0/item-search#sort
https://api.stacspec.org/v1.0.0/collections
http://www.opengis.net/spec/ogcapi-features-3/1.0/conf/filter
http://www.opengis.net/spec/ogcapi-features-3/1.0/conf/queryables
http://www.opengis.net/spec/cql2/1.0/conf/basic-cql2
http://www.opengis.net/spec/cql2/1.0/conf/cql2-json
```

랜딩 `links`(전부 상대 href):

| rel | href | 비고 |
| --- | --- | --- |
| `self`, `root` | `/api/stac` | |
| `service-desc` | `/api/docs-json` | `type: application/vnd.oai.openapi+json;version=3.0` |
| `service-doc` | `/api/docs` | `type: text/html` |
| `conformance` | `/api/stac/conformance` | |
| `data` | `/api/stac/collections` | |
| `child` ×2 | `/api/stac/collections/sentinel-2-l2a`, `.../sentinel-1-grd` | |
| `search` | `/api/stac/search` | `type: application/geo+json`, GET(method 생략) |
| `search` | `/api/stac/search` | `method: "POST"` |
| `http://www.opengis.net/def/rel/ogc/1.0/queryables` | `/api/stac/queryables` | |
| `http://www.opengis.net/def/rel/ogc/1.0/sortables` | `/api/stac/sortables` | |

## 검색 요청

### 핵심 파라미터

| 필드 | POST 본문 | GET 쿼리 | 규칙 |
| --- | --- | --- | --- |
| `intersects` | GeoJSON Polygon \| MultiPolygon | JSON 문자열 | `findPolygonError`(src/geo/polygon.ts) null이어야 함. 시계 방향은 `rewind`. `bbox`와 동시면 400 |
| `bbox` | `[w, s, e, n]` | `w,s,e,n` | `w < e`, `s < n`, 경위도 범위. `ST_MakeEnvelope`로 폴리곤화해 AOI로 씀 |
| `datetime` | 문자열 | 문자열 | RFC 3339. `start/end`, `../end`, `start/..`, 단일 시각. 양끝 포함(`>=`, `<=`). 단일은 `=`. `start > end`면 400 |
| `collections` | `string[]` | 콤마 구분 | 비면 전부 |
| `ids` | `string[]` | 콤마 구분 | 최대 100. 재처리본 선택 **전에** 적용 |
| `limit` | 정수 | 정수 | 기본 10, 최대 100. 초과는 100으로 자름(400 아님). 1 미만이나 정수 아님은 400 |
| `token` | 문자열 | 문자열 | `next` 링크에서 받은 값 |
| `sortby` | `[{ field, direction }]` | `+field,-field` 콤마 구분 | 아래 |
| `filter` | CQL2-JSON 객체 | URL 인코딩 JSON 문자열 | 아래 |
| `filter-lang` | `"cql2-json"` (생략 가능) | `cql2-json` **필수** | 그 외 값은 400 |

- 공간 조건이 없어도 검색된다. 그때 커버리지 속성이 없고 `aoi:coverage_pct` 정렬은 400.
- 모르는 필드는 무시(whitelist). GET은 파라미터를 POST 본문과 같은 객체로 정규화한 뒤 같은 zod 스키마를 통과한다.

### CQL2-JSON Basic 부분집합

```jsonc
{ "op": "and", "args": [
    { "op": "<=", "args": [{ "property": "eo:cloud_cover" }, 20] },
    { "op": "or", "args": [
        { "op": "=", "args": [{ "property": "platform" }, "sentinel-2a"] },
        { "op": "=", "args": [{ "property": "platform" }, "sentinel-2b"] } ] },
    { "op": ">=", "args": [{ "property": "datetime" }, { "timestamp": "2026-07-01T00:00:00Z" }] } ] }
```

- 연산자: `and`, `or`(인자 2개 이상, 최대 20), `not`(1개), `=`, `<>`, `<`, `<=`, `>`, `>=`(인자 2개: `{ property }` 하나 + 리터럴 하나, 순서 무관), `isNull`(인자 1개, `{ property }`).
- 속성과 타입과 컬럼:

| 속성 | 타입 | 리터럴 | 컬럼 |
| --- | --- | --- | --- |
| `id` | string | `"..."` | `s.id` |
| `collection` | string | `"..."` | `s.collection` |
| `datetime` | timestamp | `{ "timestamp": "RFC 3339" }` | `s.acquired_at` |
| `platform` | string | `"..."` | `s.platform` |
| `eo:cloud_cover` | number | 숫자 | `s.cloud_cover` |
| `gsd` | number | 숫자 | `s.gsd_m` |

- 400: 모르는 속성, 모르는 `op`, 인자 개수 불일치, 속성끼리 비교, 리터럴끼리 비교, 타입 불일치(string 속성에 숫자 등), 깊이 10 초과.
- null은 SQL 3값 논리 그대로. `not(eo:cloud_cover <= 20)`도 SAR는 안 나온다(SQL `NOT NULL` = NULL). CQL2와 같은 의미.
- 변환(`cql2-to-sql.ts`): zod 재귀 스키마로 파싱한 트리를 `Prisma.sql` 조각으로 바꾼다. 연산자는 고정 맵(`{ "=": "=", "<>": "<>", ... }`), 컬럼은 고정 맵, 리터럴은 전부 바인딩. `and`/`or`는 괄호로 감싼다.

### 정렬

- 필드: `id`, `properties.datetime`, `properties.eo:cloud_cover`, `properties.aoi:coverage_pct`. 그 외 400. GET에서 접두사 없으면 `asc`.
- 기본 `[{ field: "properties.datetime", direction: "desc" }]`.
- 최대 3개. `id`가 없으면 끝에 `id desc`를 붙여 전순서를 만든다(커서용).
- `eo:cloud_cover`의 null(SAR)은 어느 방향이든 맨 뒤: `asc` → `coalesce(s.cloud_cover, 101)`, `desc` → `coalesce(s.cloud_cover, -1)`. 커서 비교도 같은 식을 써서 키가 전부 non-null이 된다.
- 로드맵 3종은 FE 프리셋: 최신순 `datetime desc`, 커버리지 높은순 `aoi:coverage_pct desc`, 운량 낮은순 `eo:cloud_cover asc`.

### 재처리본

`ids` 적용 후 `DISTINCT ON (group_key) ORDER BY group_key, updated_at DESC NULLS LAST, id DESC`로 하나 고른 뒤 `collections`, `datetime`, `filter`를 적용한다. 최신본이 조건에서 떨어졌을 때 옛본이 대신 나오면 안 되기 때문이다.

### 커서(token)

`base64url(JSON { "k": [정렬 키 값 순서대로], "h": 조건 해시 })`.

- 조건 해시: `intersects`/`bbox`, `datetime`, `collections`, `ids`, `filter`, `sortby`(자동 `id desc` 포함)를 정규화(키 정렬)한 JSON의 sha256 앞 16자. 불일치면 400.
- `k`의 값: `datetime`은 epoch ms, `eo:cloud_cover`는 coalesce 적용값, `aoi:coverage_pct`는 숫자 그대로, `id`는 문자열.
- 다음 페이지 조건(방향 섞인 튜플 비교의 OR 전개): `(k1 ⋖ v1) OR (k1 = v1 AND k2 ⋖ v2) OR (k1 = v1 AND k2 = v2 AND k3 ⋖ v3)`. `⋖`는 `asc`면 `>`, `desc`면 `<`.
- 깨진 문자열, JSON 아님, 키 개수 불일치는 400.

## 응답

### ItemCollection

```jsonc
{
  "type": "FeatureCollection",
  "stac_version": "1.0.0",
  "features": [ /* Item */ ],
  "numberMatched": 28,
  "numberReturned": 10,
  "links": [
    { "rel": "self", "href": "/api/stac/search", "type": "application/geo+json" },
    { "rel": "root", "href": "/api/stac", "type": "application/json" },
    { "rel": "next", "href": "/api/stac/search", "type": "application/geo+json",
      "method": "POST", "merge": false, "body": { /* 원래 요청 전부 */ "token": "eyJ..." } }
  ]
}
```

- `Content-Type: application/geo+json`.
- `numberMatched`: 같은 쿼리의 `count(*) OVER ()`. 추가 쿼리 없음.
- `next`: `limit + 1`개를 가져와 넘칠 때만. GET 요청이면 `method` 없이 `href`에 원래 쿼리 문자열 + `token`.
- `context` 객체는 Deprecated라 넣지 않는다.

### Item 조립 (`item.ts`, DB의 원본 `stac` jsonb 기반)

| 필드 | 값 |
| --- | --- |
| `type`, `stac_version`, `stac_extensions`, `id`, `properties`, `assets` | 원본 그대로 |
| `geometry` | DB 컬럼(`ST_AsGeoJSON`). 원본 `geometry.type`이 `Polygon`이면 MultiPolygon의 첫 폴리곤으로 풀어서 |
| `bbox` | `[ST_XMin, ST_YMin, ST_XMax, ST_YMax]` 계산값 |
| `collection` | DB 컬럼 |
| `links` | `[{ rel: "root", href: "/api/stac" }, { rel: "collection", href: "/api/stac/collections/{c}" }]`. 원본 링크는 버림. `self`는 권장이라 생략 |
| `properties["aoi:coverage_km2"]`, `properties["aoi:coverage_pct"]` | 공간 조건이 있을 때만. 소수 둘째 자리 반올림 |

### Collection 조립

```jsonc
{ "type": "Collection", "stac_version": "1.0.0", "id": "sentinel-2-l2a",
  "title": "Sentinel-2 L2A", "description": "...", "license": "proprietary",
  "extent": { "spatial": { "bbox": [[w, s, e, n]] }, "temporal": { "interval": [["min", "max"]] } },
  "summaries": { "platform": ["sentinel-2a", "sentinel-2b", "sentinel-2c"], "gsd": [10] },
  "links": [{ "rel": "self", ... }, { "rel": "root", ... }, { "rel": "parent", ... }] }
```

- `extent`, `summaries`는 `scene`을 `collection`으로 GROUP BY 한 집계(`ST_Extent`, `min/max(acquired_at)`, `array_agg(DISTINCT platform)`, `array_agg(DISTINCT gsd_m)`).
- `title`, `description`, `license`는 코드의 고정 맵(2개). 6단계 상품 관리에서 테이블로 옮긴다.
- DB에 해당 컬렉션의 scene이 하나도 없으면 404.

### 에러

전부 RFC 9457 Problem Details(`application/problem+json`). 전역 `ExceptionFilter`를 이번에 만든다(spec.md에 규칙만 있고 구현이 없음).

- 400: zod 검증 실패(`errors: [{ field, message }]`), `intersects`+`bbox` 동시, `datetime` 역전·형식, `filter-lang` 미지원, CQL2 오류, `sortby` 오류, 토큰 오류, 공간 조건 없이 커버리지 정렬, AOI 면적 0.
- 404: 컬렉션 없음, `GET /api/scenes/:id` 없음.

## 저장

### Prisma 스키마

```prisma
generator client {
  provider        = "prisma-client"
  output          = "../src/generated/prisma"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  extensions = [postgis]
}

enum Sensor { EO SAR }

model Scene {
  id           String    @id
  groupKey     String    @map("group_key")
  collection   String
  sensor       Sensor
  platform     String
  acquiredAt   DateTime  @map("acquired_at") @db.Timestamptz
  cloudCover   Float?    @map("cloud_cover")
  gsdM         Float     @map("gsd_m")
  footprint    Unsupported("geometry(MultiPolygon, 4326)")
  thumbnailUrl String?   @map("thumbnail_url")
  updatedAt    DateTime? @map("updated_at") @db.Timestamptz
  stac         Json
  @@index([acquiredAt(sort: Desc), id(sort: Desc)])
  @@index([collection])
  @@map("scene")
}
```

마이그레이션 SQL에 손으로 추가: `CREATE EXTENSION IF NOT EXISTS postgis`(Prisma가 넣어 주면 생략), `CHECK (cloud_cover IS NULL OR cloud_cover BETWEEN 0 AND 100)`, `CREATE INDEX scene_footprint_gix ON scene USING gist (footprint)`.

`Unsupported` 컬럼 때문에 Prisma 클라이언트는 `scene`에 `create`/`findMany`를 만들지 않는다. 읽기와 쓰기 전부 `$queryRaw`/`$executeRaw`. 기존 `User` 모델은 그대로.

### Scene 모델 변경

`scene.ts`에 `collection: string`, `groupKey: string` 추가. `to-scene.ts`에서 채운다.

- `collection`: STAC `collection`. 없으면 제외 사유 추가.
- `groupKey`: id에서 처리 번호를 뺀 것. `S2B_52SEH_20260717_1_L2A` → `S2B_52SEH_20260717_L2A`. 정규식 `/_\d+_(?=L2A$)/` 하나. 매치 안 되면(S1) id 그대로.

### 적재 (`CatalogLoader` → `saveAll`)

1. 기존 `loadCatalog`로 검증과 정규화.
2. 한 번의 쿼리로 upsert:

```sql
INSERT INTO scene (id, group_key, collection, sensor, platform, acquired_at, cloud_cover, gsd_m, footprint, thumbnail_url, updated_at, stac)
SELECT id, group_key, collection, sensor::"Sensor", platform, acquired_at, cloud_cover, gsd_m,
       ST_Multi(ST_SetSRID(ST_GeomFromGeoJSON(footprint), 4326)), thumbnail_url, updated_at, stac
FROM jsonb_to_recordset($1::jsonb) AS r(id text, group_key text, collection text, sensor text, platform text,
       acquired_at timestamptz, cloud_cover float8, gsd_m float8, footprint text, thumbnail_url text,
       updated_at timestamptz, stac jsonb)
WHERE ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON(footprint), 4326))
ON CONFLICT (id) DO UPDATE SET (group_key, collection, sensor, platform, acquired_at, cloud_cover, gsd_m, footprint, thumbnail_url, updated_at, stac)
  = (excluded.group_key, excluded.collection, excluded.sensor, excluded.platform, excluded.acquired_at, excluded.cloud_cover, excluded.gsd_m, excluded.footprint, excluded.thumbnail_url, excluded.updated_at, excluded.stac)
WHERE excluded.updated_at > coalesce(scene.updated_at, '-infinity');
```

3. `ST_IsValid`에 걸린 것은 `SELECT id, ST_IsValidReason(...)`로 뽑아 같은 형식의 제외 로그에 찍는다. 적재 요약 건수는 DB가 거른 것까지 뺀 값.
4. 6단계 수집도 같은 upsert를 쓴다.

### 리포지토리 인터페이스

```ts
interface SceneQuery {
  aoi: Polygon | MultiPolygon | null;                 // intersects 또는 bbox 폴리곤
  datetime: { from: Date | null; to: Date | null } | { at: Date } | null;
  collections: string[];
  ids: string[];
  predicate: Prisma.Sql | null;                       // CQL2 변환 결과
  sort: { key: SortKey; dir: 'asc' | 'desc' }[];      // id 포함 전순서
  after: (string | number)[] | null;                  // 커서의 키 값
  limit: number;                                      // 이미 잘린 값. +1은 리포지토리가
}
type SortKey = 'id' | 'datetime' | 'eo:cloud_cover' | 'aoi:coverage_pct';

interface SceneRow {
  id: string; collection: string; stac: unknown;
  geometry: string;                                   // ST_AsGeoJSON
  bbox: [number, number, number, number];
  coverageKm2: number | null; coveragePct: number | null;
  sortValues: (string | number)[];                    // 커서 생성용, sort 순서대로
}

abstract class CatalogRepository {
  abstract saveAll(scenes: Scene[]): Promise<{ rejected: { id: string; reason: string }[] }>;
  abstract findById(id: string): Promise<Scene | null>;
  abstract search(q: SceneQuery): Promise<{ rows: SceneRow[]; matched: number; hasMore: boolean }>;
  abstract collectionStats(): Promise<{ collection: string; bbox: [number, number, number, number]; from: Date; to: Date; platforms: string[]; gsds: number[] }[]>;
}
```

`findById`도 `$queryRaw`로 바꾼다.

### 검색 쿼리 (`search.sql.ts`, `SceneQuery` → `Prisma.Sql`)

```sql
WITH aoi AS (
  SELECT g, ST_Area(g::geography) AS area_m2
  FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON($aoi), 4326) AS g) t      -- aoi 없으면 NULL::geometry
),
picked AS (
  SELECT DISTINCT ON (s.group_key) s.*
  FROM scene s, aoi
  WHERE (aoi.g IS NULL OR ST_Intersects(s.footprint, aoi.g))          -- GiST
    AND (<ids 없음> OR s.id = ANY($ids))
  ORDER BY s.group_key, s.updated_at DESC NULLS LAST, s.id DESC
),
hits AS (
  SELECT p.*,
         CASE WHEN aoi.g IS NULL THEN NULL ELSE ST_Area(ST_Intersection(p.footprint, aoi.g)::geography) END AS inter_m2,
         aoi.area_m2
  FROM picked p, aoi
  WHERE <collections> AND <datetime> AND <predicate>
)
SELECT id, collection, stac, ST_AsGeoJSON(footprint) AS geometry,
       ST_XMin(footprint), ST_YMin(footprint), ST_XMax(footprint), ST_YMax(footprint),
       inter_m2 / 1e6 AS coverage_km2, inter_m2 / area_m2 * 100 AS coverage_pct,
       <정렬 키 식들>, count(*) OVER () AS matched
FROM hits
WHERE (inter_m2 IS NULL OR inter_m2 > 0) AND <커서 조건>
ORDER BY <정렬>
LIMIT $limit + 1;
```

- 정렬 키 식 맵: `id → id`, `datetime → acquired_at`, `eo:cloud_cover → coalesce(cloud_cover, 101 | -1)`, `aoi:coverage_pct → inter_m2 / area_m2 * 100`. `ORDER BY`와 커서 조건이 같은 맵을 쓴다.
- 조건 조각은 `Prisma.sql` 템플릿으로만. 사용자 값은 전부 바인딩. 정렬 방향과 연산자는 고정 맵. `Prisma.raw`는 사용자 입력에 쓰지 않는다.
- TypedSQL은 `.sql` 파일이 고정이라 동적 조합에 안 맞아 쓰지 않는다.
- 커버리지순은 매 페이지 교차 면적을 전부 다시 계산한다. 16단계 성능 측정 주제.

## 코드 구조

```
apps/api/src/
  problem-details.filter.ts            전역 ExceptionFilter (RFC 9457). HttpException, ZodError, ValidationPipe 오류 변환
  geo/polygon.ts                       그대로
  modules/catalog/
    scene.ts                           collection, groupKey 추가
    stac/to-scene.ts                   collection, groupKey 채움. collection 없으면 제외
    catalog.repository.ts              abstract + PostgisCatalogRepository (메모리 구현 삭제)
    search.sql.ts                      SceneQuery → Prisma.Sql. 순수 함수
    catalog.loader.ts                  DB 제외 로그 추가
    catalog.module.ts                  PrismaModule import
    scenes.controller.ts               GET /api/scenes/:id 그대로
  modules/stac/
    stac.module.ts
    landing.controller.ts              GET /api/stac, /conformance, /queryables, /sortables. 고정 JSON
    collections.controller.ts          GET /collections, /collections/:id
    search.controller.ts               GET + POST /search. 응답 Content-Type geo+json
    search-request.schema.ts           zod 본문 스키마. GET 쿼리 → 본문 정규화 함수
    cql2/cql2.schema.ts                zod 재귀 스키마 + 속성 화이트리스트
    cql2/cql2-to-sql.ts                → Prisma.Sql. 순수 함수
    sortby.ts                          파싱(POST 배열, GET 문자열) + 검증 + id desc 보강
    token.ts                           encode/decode + 조건 해시
    item.ts                            SceneRow → STAC Item
    search.service.ts                  요청 → SceneQuery → 리포지토리 → ItemCollection + links
```

- 경계: `modules/stac`는 HTTP↔`SceneQuery`만 안다. `modules/catalog`는 STAC HTTP를 모른다. 16단계에서 쿼리를 바꿀 때 `search.sql.ts`만 건드린다.
- 검증은 zod. `z.toJSONSchema(schema)`를 `@ApiBody({ schema })`, `@ApiQuery`에 넣어 Swagger와 FE 타입 생성 유지. 전역 `ValidationPipe`는 class DTO에만 작동하므로 충돌 없음. 이 컨트롤러는 `ZodValidationPipe` 하나를 쓴다.
- 상한: 필터 깊이 10, `and`/`or` 인자 20, `ids` 100, `sortby` 3, 본문 1MB(Nest 기본).

## 인프라

- `compose.yaml`: `image: postgis/postgis:18-3.6`(Docker Hub 확인), `name: footprint`(지금 컨테이너 이름 `next-nest-boilerplate-db-1`). 기존 볼륨은 PostGIS 없는 데이터라 `docker compose down -v` 후 재생성.
- `package.json`(api): `test:db` 스크립트. `DATABASE_URL` 있을 때만 통합 테스트.
- 새 런타임 의존성 없음. devDependency `@turf/area`, `@turf/intersect`(검산용).
- `scripts/stac-smoke.py`: `.venv`에 `pystac-client` 설치해서 `/api/stac` 열고 bbox + filter + sortby 검색을 페이지 끝까지 순회. 상대 href가 풀리는지 여기서 확인. 통과하면 `stac-api-validator`도 한 번(수동).

## 테스트

단위(`pnpm --filter @footprint/api test`, DB 없음):

- `cql2-to-sql`: 연산자별 SQL과 바인딩, `and`/`or` 괄호, 타입 불일치 400, 모르는 속성 400, 속성끼리 비교 400, 깊이 초과 400, `timestamp` 리터럴.
- `sortby`: POST 배열과 GET 문자열, 기본값, `id desc` 보강, 모르는 필드 400, 4개 이상 400.
- `token`: 왕복, 해시 불일치, 깨진 문자열, 키 개수 불일치.
- `search-request.schema`: GET 콤마 리스트와 `intersects` JSON 문자열 정규화, `intersects`+`bbox` 400, `datetime` 4형태, 역전 400, `limit` 자름과 0은 400, `filter-lang` 검사.
- `search.sql`: 커서 조건 OR 전개(방향 섞임), null 정렬 coalesce, aoi 없을 때 커버리지 NULL.
- `item`: Polygon 복원, bbox, 링크, 커버리지 유무.
- `to-scene`: `groupKey` 규칙, `collection` 없으면 제외.

통합(`test:db`, compose Postgres):

- `data/aois.geojson` 8개 AOI로 검색. `aoi:coverage_km2`가 `@turf/intersect` + `@turf/area` 값과 1% 이내.
- 같은 `group_key` 재처리본이 하나만 나오고 `updated_at` 최신. `ids`로 옛본을 집으면 나옴.
- `eo:cloud_cover <= 0`에 SAR 탈락(CQL2 의미). `or(collection = 'sentinel-1-grd', ...)`로 복귀.
- 정렬 4필드 × 양방향, `limit: 5`로 끝까지 페이지 순회 → id 집합이 `limit: 100` 한 번과 같고 중복 없음. `numberMatched` 일치.
- GET과 POST 같은 조건 → 같은 결과.
- 적재 두 번 → 건수 동일. `/collections` extent가 데이터와 일치.

## 문서 수정

- `README.md`: 1단계 체크. 스택에 PostGIS, STAC API. 로드맵 설명에 2단계가 STAC API + PostGIS임을 한 줄.
- `docs/roadmap.md`: 2단계를 이 설계로 다시 쓴다(STAC API 구현, 심화의 "STAC 호환 엔드포인트" 삭제, 심화는 Fields 확장·`cql2-text`·GET bbox 성능). 6단계 "Postgres 저장, JSON 컬럼, 메모리 인덱스" 삭제. 16단계는 "GiST 효과 측정, EXPLAIN ANALYZE, 커버리지순 페이지 성능".
- `docs/spec.md`: API 규칙에 "검색은 `/api/stac/*` STAC API. 커서는 `token`과 `links[next]`" 추가.
- `docs/decisions.md`: 아키텍처 "카탈로그 저장은 단계적으로 옮긴다" → "처음부터 PostGIS"로 수정. "검색 API는 STAC API" 추가(이유: 업계 표준, 대안: 자체 API + 어댑터). 구현 중 가정에 2단계 항목: 상대 href, null 의미, 재처리본과 `ids`, `aoi:` 접두사, `limit` 자름, `cql2-json`만, 원본 링크 버림, `self` 생략, 컬렉션 메타 고정 맵.
- `docs/development.md`: `test:db`, `docker compose down -v`, `scripts/stac-smoke.py`.
