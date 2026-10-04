import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { after, before, test } from 'node:test';
import area from '@turf/area';
import { feature, featureCollection } from '@turf/helpers';
import intersect from '@turf/intersect';
import type { Feature, MultiPolygon, Polygon } from 'geojson';
import { Prisma } from '../../generated/prisma/client.js';
import type { Scene } from './scene.js';
import type { SceneQuery, SortSpec } from './scene-query.js';
import { AOIS_FILE, fixtureScenes, openTestDb } from './test-db.js';

const db = openTestDb();
let scenes: Scene[] = [];
let aois: Feature<Polygon | MultiPolygon>[] = [];

const square: Polygon = {
  type: 'Polygon',
  coordinates: [
    [
      [129.0, 35.0],
      [129.2, 35.0],
      [129.2, 35.2],
      [129.0, 35.2],
      [129.0, 35.0],
    ],
  ],
};

function q(over: Partial<SceneQuery> = {}): SceneQuery {
  return {
    aoi: null,
    datetime: null,
    collections: [],
    ids: [],
    predicate: null,
    sort: [
      { key: 'datetime', dir: 'desc' },
      { key: 'id', dir: 'desc' },
    ],
    after: null,
    limit: 100,
    ...over,
  };
}

function time(d: Date | null) {
  return d?.getTime() ?? -Infinity;
}

before(async () => {
  scenes = await fixtureScenes();
  aois = (
    JSON.parse(await readFile(AOIS_FILE, 'utf8')) as {
      features: Feature<Polygon | MultiPolygon>[];
    }
  ).features;
  await db.prisma.$executeRaw`TRUNCATE scene`;
  await db.repo.saveAll(scenes);
});

after(async () => {
  await db.prisma.$executeRaw`TRUNCATE scene`;
  await db.close();
});

void test('적재는 멱등이고 DB가 거른 건수만큼 줄어든다', async () => {
  const count = async () =>
    (await db.prisma.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM scene`)[0].n;
  const first = await count();
  const { rejected } = await db.repo.saveAll(scenes);
  assert.equal(await count(), first);
  assert.equal(first + rejected.length, scenes.length);
});

void test('findById는 원본 Polygon 타입으로 돌려준다', async () => {
  const s = scenes.find((x) => x.footprint.type === 'Polygon');
  assert.ok(s);
  const found = await db.repo.findById(s.id);
  assert.equal(found?.footprint.type, 'Polygon');
  assert.deepEqual(found?.footprint.coordinates, s.footprint.coordinates);
  assert.equal(found?.collection, s.collection);
  assert.equal(await db.repo.findById('nope'), null);
});

void test('validateAoi는 구멍이 바깥에 있는 폴리곤과 면적 0을 거른다', async () => {
  const outerHole: Polygon = {
    type: 'Polygon',
    coordinates: [
      square.coordinates[0],
      [
        [130, 36],
        [130.1, 36],
        [130.1, 36.1],
        [130, 36.1],
        [130, 36],
      ],
    ],
  };
  const r = await db.repo.validateAoi(outerHole);
  assert.equal(r.valid, false);
  assert.ok(!r.valid && /Hole lies outside shell/.test(r.reason), JSON.stringify(r));
  const flat: Polygon = {
    type: 'Polygon',
    coordinates: [
      [
        [129, 35],
        [129.1, 35],
        [129.2, 35],
        [129, 35],
      ],
    ],
  };
  const degenerate = await db.repo.validateAoi(flat);
  assert.equal(degenerate.valid, false, JSON.stringify(degenerate));
  assert.deepEqual(await db.repo.validateAoi(square), { valid: true });
});

void test('커버리지는 turf 계산과 1% 안에서 맞는다', async () => {
  for (const aoi of aois) {
    const { rows } = await db.repo.search(q({ aoi: aoi.geometry, limit: 20 }));
    assert.ok(rows.length > 0, `${aoi.id}: 결과 없음`);
    for (const row of rows) {
      const inter = intersect(
        featureCollection([feature(aoi.geometry), feature(row.geometry)]),
      );
      const km2 = inter ? area(inter) / 1e6 : 0;
      assert.ok(row.coverageKm2 !== null && row.coveragePct !== null);
      assert.ok(
        Math.abs(km2 - row.coverageKm2) <= Math.max(0.01 * km2, 0.001),
        `${aoi.id}/${row.id}: turf ${km2} vs db ${row.coverageKm2}`,
      );
      assert.ok(row.coveragePct > 0 && row.coveragePct <= 100.001);
    }
  }
});

void test('공간 조건이 없으면 커버리지가 없고 matched는 재처리본을 합친 수', async () => {
  const groups = new Set(scenes.map((s) => s.groupKey));
  const r = await db.repo.search(q({ limit: 5 }));
  assert.equal(r.matched, groups.size);
  assert.equal(r.rows[0].coverageKm2, null);
  assert.ok(r.hasMore);
});

void test('재처리본은 최신 하나만 나오고 옛본은 ids로 집어야 나온다', async () => {
  const byGroup = new Map<string, Scene[]>();
  for (const s of scenes) byGroup.set(s.groupKey, [...(byGroup.get(s.groupKey) ?? []), s]);
  const pair = [...byGroup.values()].find((g) => g.length > 1);
  assert.ok(pair, '재처리본 쌍이 없음');
  const [newest, ...older] = [...pair].sort(
    (a, b) => time(b.updatedAt) - time(a.updatedAt) || b.id.localeCompare(a.id),
  );
  const all = await db.repo.search(q({ ids: pair.map((s) => s.id) }));
  assert.deepEqual(all.rows.map((r) => r.id), [newest.id]);
  const old = await db.repo.search(q({ ids: [older[0].id] }));
  assert.deepEqual(old.rows.map((r) => r.id), [older[0].id]);
});

void test('운량 조건은 CQL2 의미대로 SAR(null)를 거른다', async () => {
  const eoOnly = await db.repo.search(q({ predicate: Prisma.sql`cloud_cover <= ${100}` }));
  assert.ok(eoOnly.rows.length > 0);
  assert.ok(eoOnly.rows.every((r) => r.collection === 'sentinel-2-l2a'));
  const both = await db.repo.search(
    q({ predicate: Prisma.sql`(collection = ${'sentinel-1-grd'} OR cloud_cover <= ${100})` }),
  );
  assert.ok(both.rows.some((r) => r.collection === 'sentinel-1-grd'));
});

void test('collections와 datetime은 picked 단계에서 걸린다', async () => {
  const r = await db.repo.search(
    q({
      collections: ['sentinel-1-grd'],
      datetime: { from: new Date('2026-07-01T00:00:00Z'), to: new Date('2026-07-15T23:59:59Z') },
    }),
  );
  assert.ok(r.rows.length > 0);
  for (const row of r.rows) {
    assert.equal(row.collection, 'sentinel-1-grd');
    const dt = new Date((row.stac as { properties: { datetime: string } }).properties.datetime);
    assert.ok(dt >= new Date('2026-07-01T00:00:00Z') && dt <= new Date('2026-07-15T23:59:59Z'));
  }
});

void test('정렬 4종 × 양방향으로 끝까지 넘겨도 중복과 누락이 없다', async () => {
  const aoi = aois[0].geometry;
  const keys: SortSpec['key'][] = ['datetime', 'eo:cloud_cover', 'aoi:coverage_pct', 'id'];
  for (const key of keys) {
    for (const dir of ['asc', 'desc'] as const) {
      const sort: SortSpec[] =
        key === 'id' ? [{ key, dir }] : [{ key, dir }, { key: 'id', dir: 'desc' }];
      const full = await db.repo.search(q({ aoi, sort, limit: 100 }));
      assert.ok(!full.hasMore, '테스트 AOI는 100건 미만이어야 함');
      const seen: string[] = [];
      let after: (string | number)[] | null = null;
      for (let pages = 0; ; pages++) {
        assert.ok(pages < 50, `${key} ${dir}: 페이지가 끝나지 않음`);
        const page = await db.repo.search(q({ aoi, sort, limit: 5, after }));
        assert.equal(page.matched, full.matched);
        seen.push(...page.rows.map((r) => r.id));
        if (!page.hasMore) break;
        after = page.rows[page.rows.length - 1].sortValues;
      }
      assert.deepEqual(seen, full.rows.map((r) => r.id), `${key} ${dir}`);
    }
  }
});
