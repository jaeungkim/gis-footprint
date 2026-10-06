import { Prisma } from '../generated/prisma/client.js';
import type {
  SceneQuery,
  SortSpec,
} from './interfaces/scene-query.interface.js';

const { sql, join, empty } = Prisma;

// 방향과 비교 연산자는 사용자 입력이 아니라 이 고정 맵에서만 꺼낸다.
const DIR = { asc: sql`ASC`, desc: sql`DESC` };
const AFTER = { asc: sql`>`, desc: sql`<` }; // 다음 페이지는 정렬 순서상 커서 뒤

// 면적(m²). RFC 7946의 변은 경위도 직선이라 0.1°로 잘게 나눠 등적 투영(EPSG:6933)에서 잰다.
// ::geography는 변을 대권으로 봐서 경도 폭이 180°를 넘는 AOI를 반대쪽으로 재고, -180..180이면 500이 난다.
export const areaM2 = (g: Prisma.Sql) =>
  sql`ST_Area(ST_Transform(ST_Segmentize(${g}, 0.1), 6933))`;

// 정렬 키 → SQL 식. ORDER BY와 커서 조건이 같은 맵을 써서 어긋나지 않는다.
export function sortKeyExpr(spec: SortSpec, hasAoi: boolean): Prisma.Sql {
  switch (spec.key) {
    case 'id':
      return sql`id`;
    case 'datetime':
      return sql`acquired_at`;
    case 'eo:cloud_cover':
      // null(SAR)은 방향과 무관하게 맨 뒤
      return spec.dir === 'asc'
        ? sql`coalesce(cloud_cover, 101)`
        : sql`coalesce(cloud_cover, -1)`;
    case 'aoi:coverage_pct':
      if (!hasAoi)
        throw new Error('aoi:coverage_pct 정렬은 공간 조건이 필요함');
      return sql`inter_m2 / area_m2 * 100`;
  }
}

function cursorValue(
  spec: SortSpec,
  v: string | number,
): Date | string | number {
  return spec.key === 'datetime' ? new Date(v as number) : v;
}

// (k1 ⋖ v1) OR (k1 = v1 AND k2 ⋖ v2) OR ... 방향이 섞여도 되는 튜플 비교.
function cursorCondition(
  sort: SortSpec[],
  after: (string | number)[],
  hasAoi: boolean,
): Prisma.Sql {
  const clauses = sort.map((spec, i) => {
    const parts = sort
      .slice(0, i)
      .map(
        (s, j) => sql`${sortKeyExpr(s, hasAoi)} = ${cursorValue(s, after[j])}`,
      );
    parts.push(
      sql`${sortKeyExpr(spec, hasAoi)} ${AFTER[spec.dir]} ${cursorValue(spec, after[i])}`,
    );

    return sql`(${join(parts, ' AND ')})`;
  });

  return sql`(${join(clauses, ' OR ')})`;
}

// picked: 공간·collections·datetime을 건 뒤 재처리본마다 최신 하나. 재처리본은 group_key와 촬영 시각이
//         같은 Item이다(같은 날 같은 타일의 다른 데이터스트립은 group_key만 같고 시각이 다르다).
//         이 조건들은 재처리본끼리 값이 같아서 선택 앞에 둬도 결과가 안 바뀐다.
// hits:   ids와 CQL2 predicate(재처리본끼리 다를 수 있어서 선택 뒤) + 교차 면적.
// ponytail: 정렬이 뭐든 후보 전부의 교차 면적을 계산하고 count(*) OVER ()로 전체를 훑는다.
//   1,262건엔 충분. 16단계: 커버리지 정렬이 아닐 때 LIMIT 후 교차 계산, NOT ST_Touches로 경계 제외.
export function buildSearchSql(q: SceneQuery): Prisma.Sql {
  const hasAoi = q.aoi !== null;

  const picked: Prisma.Sql[] = [
    hasAoi ? sql`ST_Intersects(s.footprint, aoi.g)` : sql`TRUE`,
  ];
  if (q.collections.length) {
    picked.push(sql`s.collection = ANY(${q.collections}::text[])`);
  }
  if (q.datetime) {
    if ('at' in q.datetime) {
      picked.push(sql`s.acquired_at = ${q.datetime.at}`);
    } else {
      if (q.datetime.from)
        picked.push(sql`s.acquired_at >= ${q.datetime.from}`);
      if (q.datetime.to) picked.push(sql`s.acquired_at <= ${q.datetime.to}`);
    }
  }

  const hit: Prisma.Sql[] = [q.predicate ?? sql`TRUE`];
  if (q.ids.length) hit.push(sql`p.id = ANY(${q.ids}::text[])`);

  // AOI가 없으면 aoi CTE와 교차 식을 아예 뺀다. `aoi.g IS NULL OR ST_Intersects(...)`는 GiST를 못 탄다.
  const aoiCte = hasAoi
    ? sql`aoi AS (
        SELECT g, ${areaM2(sql`g`)} AS area_m2
        FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON(${JSON.stringify(q.aoi)}), 4326) AS g) t
      ),`
    : empty;
  const fromAoi = hasAoi ? sql`, aoi` : empty;
  const inter = hasAoi
    ? areaM2(sql`ST_Intersection(p.footprint, aoi.g)`)
    : sql`NULL::float8`;
  const area = hasAoi ? sql`aoi.area_m2` : sql`NULL::float8`;

  const sortCols = join(
    q.sort.map(
      (s, i) => sql`${sortKeyExpr(s, hasAoi)} AS ${Prisma.raw(`sort_${i}`)}`,
    ),
    ', ',
  );
  const orderBy = join(
    q.sort.map((s) => sql`${sortKeyExpr(s, hasAoi)} ${DIR[s.dir]}`),
    ', ',
  );

  // matched는 커서 조건을 걸기 전 집합의 수. 커서 뒤에서 세면 페이지마다 줄어든다.
  const coverage = hasAoi ? sql`inter_m2 > 0` : sql`TRUE`;
  const cursor = q.after ? cursorCondition(q.sort, q.after, hasAoi) : sql`TRUE`;

  return sql`
WITH ${aoiCte}
picked AS (
  SELECT DISTINCT ON (s.group_key, s.acquired_at) s.*
  FROM scene s${fromAoi}
  WHERE ${join(picked, ' AND ')}
  ORDER BY s.group_key, s.acquired_at, s.updated_at DESC NULLS LAST, s.id DESC
),
hits AS (
  SELECT p.*, ${inter} AS inter_m2, ${area} AS area_m2
  FROM picked p${fromAoi}
  WHERE ${join(hit, ' AND ')}
),
filtered AS (
  SELECT * FROM hits WHERE ${coverage}
)
SELECT id, collection, stac, gsd_m, ST_AsGeoJSON(footprint) AS geometry,
       ST_XMin(footprint) AS xmin, ST_YMin(footprint) AS ymin,
       ST_XMax(footprint) AS xmax, ST_YMax(footprint) AS ymax,
       inter_m2 / 1e6 AS coverage_km2, inter_m2 / area_m2 * 100 AS coverage_pct,
       ${sortCols}, (SELECT count(*)::int FROM filtered) AS matched
FROM filtered
WHERE ${cursor}
ORDER BY ${orderBy}
LIMIT ${q.limit + 1}`;
}
