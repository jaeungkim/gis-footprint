import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadCatalog } from './load-catalog.js';
import { groupKeyOf } from './stac/to-scene.js';

// node:test의 test()는 Promise를 돌려줘서 no-floating-promises 때문에 void를 붙인다.

// 반시계 방향으로 닫힌 사각형
const square = [
  [126, 37],
  [127, 37],
  [127, 38],
  [126, 38],
  [126, 37],
];

function s2(overrides: Record<string, unknown> = {}, id = 'S2_A') {
  return {
    id,
    collection: 'sentinel-2-l2a',
    geometry: { type: 'Polygon', coordinates: [square] },
    properties: {
      datetime: '2026-07-01T02:00:00.000Z',
      updated: '2026-07-01T05:00:00.000Z',
      platform: 'sentinel-2b',
      'eo:cloud_cover': 12.5,
      ...overrides,
    },
    assets: {
      red: { href: 'https://x/red.tif', gsd: 10 },
      thumbnail: { href: 'https://x/preview.jpg' },
    },
  };
}

void test('정상 Item을 Scene으로 정규화한다', () => {
  const { scenes, rejected } = loadCatalog([s2()]);
  assert.equal(rejected.length, 0);
  assert.deepEqual(scenes[0].footprint.coordinates, [square]);
  assert.equal(scenes[0].sensor, 'EO');
  assert.equal(scenes[0].cloudCover, 12.5);
  assert.equal(scenes[0].gsdM, 10);
});

void test('불량 Item은 빼고 id와 사유를 남긴다', () => {
  const open = { type: 'Polygon', coordinates: [square.slice(0, 4)] };
  const swapped = {
    type: 'Polygon',
    coordinates: [square.map(([lon, lat]) => [lat, lon])],
  };
  const bowtie = {
    type: 'Polygon',
    coordinates: [
      [
        [126, 37],
        [127, 38],
        [127, 37],
        [126, 38],
        [126, 37],
      ],
    ],
  };
  const sarNoPol = {
    ...s2({ 'sar:resolution_range': 20, 'sar:instrument_mode': '' }, 's1-bad'),
    collection: 'sentinel-1-grd',
  };
  const items = [
    s2(),
    { ...s2({}, 'bowtie'), geometry: bowtie },
    sarNoPol,
    { ...s2({}, 'open'), geometry: open },
    { ...s2({}, 'swapped'), geometry: swapped },
    s2({ datetime: '2026-07-01T02:00:00' }, 'no-tz'),
    s2({ 'eo:cloud_cover': 135 }, 'cloud-135'),
    { ...s2({}, 'no-geom'), geometry: null },
    'not an object',
  ];
  const { scenes, rejected, total } = loadCatalog(items);
  assert.equal(scenes.length, 1);
  assert.equal(total, items.length);
  assert.deepEqual(
    rejected.map((r) => [r.id, r.reason]),
    [
      ['bowtie', 'INVALID_GEOMETRY'],
      ['s1-bad', 'INVALID_SCHEMA'],
      ['open', 'INVALID_GEOMETRY'],
      ['swapped', 'INVALID_GEOMETRY'],
      ['no-tz', 'INVALID_SCHEMA'],
      ['cloud-135', 'INVALID_SCHEMA'],
      ['no-geom', 'INVALID_SCHEMA'],
      [null, 'INVALID_SCHEMA'],
    ],
  );
});

void test('문자열 운량은 숫자로 받는다', () => {
  assert.equal(
    loadCatalog([s2({ 'eo:cloud_cover': '33.29' })]).scenes[0].cloudCover,
    33.29,
  );
  assert.equal(
    loadCatalog([s2({ 'eo:cloud_cover': 'abc' })]).rejected.length,
    1,
  );
});

void test('시계 방향 링은 반시계로 뒤집는다', () => {
  const cw = { type: 'Polygon', coordinates: [square.toReversed()] };
  const { scenes } = loadCatalog([{ ...s2(), geometry: cw }]);
  assert.deepEqual(scenes[0].footprint.coordinates, [square]);
});

void test('같은 id는 updated가 늦은 쪽을 남긴다', () => {
  const newer = s2({
    updated: '2026-09-15T03:00:00.000Z',
    'eo:cloud_cover': 5,
  });
  for (const items of [
    [s2(), newer],
    [newer, s2()],
  ]) {
    const { scenes, duplicateIds } = loadCatalog(items);
    assert.equal(scenes.length, 1);
    assert.equal(scenes[0].cloudCover, 5);
    assert.deepEqual(duplicateIds, ['S2_A']);
  }
});

void test('collection과 groupKey를 채운다', () => {
  const { scenes } = loadCatalog([s2({}, 'S2B_52SEH_20260717_1_L2A')]);
  assert.equal(scenes[0].collection, 'sentinel-2-l2a');
  assert.equal(scenes[0].groupKey, 'S2B_52SEH_20260717_L2A');
});

void test('groupKeyOf는 S2 처리 번호만 뺀다', () => {
  assert.equal(groupKeyOf('S2B_52SEH_20260717_0_L2A'), 'S2B_52SEH_20260717_L2A');
  assert.equal(groupKeyOf('S2B_52SEH_20260717_12_L2A'), 'S2B_52SEH_20260717_L2A');
  const s1 = 'S1C_IW_GRDH_1SDV_20260704T093712_20260704T093737_004123_008F3B';
  assert.equal(groupKeyOf(s1), s1);
});
