import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Polygon } from 'geojson';
import { Prisma } from '../../generated/prisma/client.js';
import type { SceneQuery } from './scene-query.js';
import { buildSearchSql } from './search.sql.js';

const square: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [126, 37],
      [127, 37],
      [127, 38],
      [126, 38],
      [126, 37],
    ],
  ],
};

function query(over: Partial<SceneQuery> = {}): SceneQuery {
  return {
    aoi: square,
    datetime: null,
    collections: [],
    ids: [],
    predicate: null,
    sort: [
      { key: 'datetime', dir: 'desc' },
      { key: 'id', dir: 'desc' },
    ],
    after: null,
    limit: 10,
    ...over,
  };
}

void test('AOI가 있으면 교차·면적 식이 들어가고 값은 바인딩된다', () => {
  const q = buildSearchSql(query());
  assert.match(q.text, /ST_Intersects\(s\.footprint, aoi\.g\)/);
  assert.match(q.text, /ST_Intersection/);
  assert.match(q.text, /inter_m2 > 0/);
  assert.match(q.text, /LIMIT \$\d+$/);
  assert.deepEqual(q.values, [JSON.stringify(square), 11]);
});

void test('AOI가 없으면 aoi CTE와 교차 식이 빠진다', () => {
  const q = buildSearchSql(query({ aoi: null }));
  assert.doesNotMatch(q.text, /aoi/);
  assert.match(q.text, /NULL::float8 AS inter_m2/);
  assert.deepEqual(q.values, [11]);
});

void test('ids, collections, datetime은 picked 단계에 들어간다', () => {
  const from = new Date('2026-07-01T00:00:00Z');
  const to = new Date('2026-08-01T00:00:00Z');
  const q = buildSearchSql(
    query({
      aoi: null,
      ids: ['a', 'b'],
      collections: ['sentinel-2-l2a'],
      datetime: { from, to },
    }),
  );
  const picked = q.text.slice(q.text.indexOf('picked AS'), q.text.indexOf('hits AS'));
  assert.match(picked, /s\.id = ANY\(\$1::text\[\]\)/);
  assert.match(picked, /s\.collection = ANY\(\$2::text\[\]\)/);
  assert.match(picked, /s\.acquired_at >= \$3 AND s\.acquired_at <= \$4/);
  assert.deepEqual(q.values.slice(0, 4), [['a', 'b'], ['sentinel-2-l2a'], from, to]);
});

void test('predicate는 hits 단계(재처리본 선택 뒤)에 들어간다', () => {
  const q = buildSearchSql(
    query({ aoi: null, predicate: Prisma.sql`(cloud_cover <= ${20})` }),
  );
  const hits = q.text.slice(q.text.indexOf('hits AS'), q.text.indexOf('SELECT id'));
  assert.match(hits, /WHERE \(cloud_cover <= \$1\)/);
});

void test('커서 조건은 방향이 섞인 튜플 비교를 OR로 푼다', () => {
  const q = buildSearchSql(
    query({
      sort: [
        { key: 'aoi:coverage_pct', dir: 'desc' },
        { key: 'datetime', dir: 'asc' },
        { key: 'id', dir: 'desc' },
      ],
      after: [87.5, 1_760_000_000_000, 'S2_X'],
    }),
  );
  assert.match(
    q.text,
    /\(\(inter_m2 \/ area_m2 \* 100 < \$2\) OR \(inter_m2 \/ area_m2 \* 100 = \$3 AND acquired_at > \$4\) OR \(inter_m2 \/ area_m2 \* 100 = \$5 AND acquired_at = \$6 AND id < \$7\)\)/,
  );
  assert.equal((q.values[3] as Date).getTime(), 1_760_000_000_000);
  assert.match(q.text, /ORDER BY inter_m2 \/ area_m2 \* 100 DESC, acquired_at ASC, id DESC/);
});

void test('운량 정렬은 null을 방향과 무관하게 맨 뒤로 보낸다', () => {
  const asc = buildSearchSql(
    query({ sort: [{ key: 'eo:cloud_cover', dir: 'asc' }, { key: 'id', dir: 'desc' }] }),
  );
  assert.match(asc.text, /ORDER BY coalesce\(cloud_cover, 101\) ASC/);
  const desc = buildSearchSql(
    query({ sort: [{ key: 'eo:cloud_cover', dir: 'desc' }, { key: 'id', dir: 'desc' }] }),
  );
  assert.match(desc.text, /ORDER BY coalesce\(cloud_cover, -1\) DESC/);
});

void test('공간 조건 없이 커버리지 정렬은 거부한다', () => {
  assert.throws(() =>
    buildSearchSql(
      query({ aoi: null, sort: [{ key: 'aoi:coverage_pct', dir: 'desc' }, { key: 'id', dir: 'desc' }] }),
    ),
  );
});
