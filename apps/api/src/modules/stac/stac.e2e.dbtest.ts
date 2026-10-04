import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import type { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module.js';
import { ProblemDetailsFilter } from '../../problem-details.filter.js';

// 앱을 실제로 띄워 HTTP로 검증한다. 시작할 때 카탈로그가 app_test에 적재된다.
let app: INestApplication;
let base = '';
const PUBLIC = 'http://localhost:3001';

interface Collection {
  type: string;
  features: { id: string; collection: string; properties: Record<string, unknown>; links: { rel: string; href: string }[]; bbox: number[] }[];
  numberMatched: number;
  numberReturned: number;
  links: { rel: string; href: string; method?: string; body?: Record<string, unknown> }[];
}

async function post(path: string, body: unknown) {
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { res, json: (await res.json()) as Record<string, unknown> };
}

async function get(path: string) {
  const res = await fetch(`${base}${path}`);
  return { res, json: (await res.json()) as Record<string, unknown> };
}

const pyeongtaek = [126.8, 36.94, 126.9, 37.0];

before(async () => {
  app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new ProblemDetailsFilter());
  await app.listen(0);
  base = await app.getUrl();
});

after(async () => {
  await app.close();
});

void test('랜딩 페이지와 conformance', async () => {
  const { res, json } = await get('/api/stac');
  assert.equal(res.status, 200);
  assert.equal(json.type, 'Catalog');
  const conformsTo = json.conformsTo as string[];
  assert.ok(conformsTo.includes('https://api.stacspec.org/v1.0.0/item-search'));
  const links = json.links as { rel: string; href: string; method?: string }[];
  assert.ok(links.some((l) => l.rel === 'search' && l.method === 'POST'));
  assert.ok(links.every((l) => l.href.startsWith(PUBLIC)));
  assert.equal(links.filter((l) => l.rel === 'child').length, 2);
  const conf = await get('/api/stac/conformance');
  assert.deepEqual(conf.json.conformsTo, conformsTo);
  const q = await get('/api/stac/queryables');
  assert.equal(q.res.headers.get('content-type')?.split(';')[0], 'application/schema+json');
  assert.ok('eo:cloud_cover' in (q.json.properties as object));
});

void test('컬렉션 목록과 단건, 없으면 404 problem+json', async () => {
  const { json } = await get('/api/stac/collections');
  const collections = json.collections as Record<string, unknown>[];
  assert.deepEqual(collections.map((c) => String(c.id)).sort((a, b) => a.localeCompare(b)), ['sentinel-1-grd', 'sentinel-2-l2a']);
  const one = await get('/api/stac/collections/sentinel-2-l2a');
  assert.equal(one.res.status, 200);
  const extent = one.json.extent as { spatial: { bbox: number[][] }; temporal: { interval: string[][] } };
  assert.equal(extent.spatial.bbox[0].length, 4);
  assert.ok(extent.spatial.bbox[0][0] < extent.spatial.bbox[0][2]);
  assert.match(extent.temporal.interval[0][0], /^2026-07/);
  const summaries = one.json.summaries as { platform: string[]; gsd: number[] };
  assert.deepEqual(summaries.gsd, [10]);
  assert.ok(summaries.platform.includes('sentinel-2b'));
  assert.equal(one.json.license, 'proprietary');
  const missing = await get('/api/stac/collections/nope');
  assert.equal(missing.res.status, 404);
  assert.equal(missing.res.headers.get('content-type')?.split(';')[0], 'application/problem+json');
  assert.equal(missing.json.title, 'Not Found');
});

void test('POST 검색: geo+json, 커버리지, 정렬, next 링크를 끝까지 따라가면 numberMatched만큼', async () => {
  const body = {
    bbox: pyeongtaek,
    collections: ['sentinel-2-l2a'],
    datetime: '2026-07-01T00:00:00+09:00/2026-08-31T23:59:59+09:00',
    sortby: [{ field: 'properties.aoi:coverage_pct', direction: 'desc' }],
    filter: { op: '<=', args: [{ property: 'eo:cloud_cover' }, 60] },
    limit: 4,
  };
  const first = await post('/api/stac/search', body);
  assert.equal(first.res.status, 200, JSON.stringify(first.json));
  assert.equal(first.res.headers.get('content-type')?.split(';')[0], 'application/geo+json');
  const page = first.json as unknown as Collection;
  assert.equal(page.type, 'FeatureCollection');
  assert.equal(page.numberReturned, 4);
  assert.ok(page.numberMatched > 4);
  const pcts = page.features.map((f) => f.properties['aoi:coverage_pct'] as number);
  assert.deepEqual(pcts, [...pcts].sort((a, b) => b - a));
  for (const f of page.features) {
    assert.equal(f.collection, 'sentinel-2-l2a');
    assert.ok((f.properties['eo:cloud_cover'] as number) <= 60);
    assert.ok((f.properties['aoi:coverage_km2'] as number) > 0);
    assert.equal(f.bbox.length, 4);
    assert.ok(f.links.some((l) => l.rel === 'collection' && l.href === `${PUBLIC}/api/stac/collections/sentinel-2-l2a`));
  }

  const seen = new Set(page.features.map((f) => f.id));
  let next = page.links.find((l) => l.rel === 'next');
  for (let pages = 1; next; pages++) {
    assert.ok(pages < 50);
    assert.equal(next.method, 'POST');
    assert.equal(next.href, `${PUBLIC}/api/stac/search`);
    const more = (await post('/api/stac/search', next.body)).json as unknown as Collection;
    assert.equal(more.numberMatched, page.numberMatched);
    for (const f of more.features) {
      assert.ok(!seen.has(f.id), `중복 ${f.id}`);
      seen.add(f.id);
    }
    next = more.links.find((l) => l.rel === 'next');
  }
  assert.equal(seen.size, page.numberMatched);
});

void test('GET 검색은 같은 조건이면 POST와 같은 결과', async () => {
  const filter = encodeURIComponent(JSON.stringify({ op: '<=', args: [{ property: 'eo:cloud_cover' }, 60] }));
  const viaGet = await get(
    `/api/stac/search?bbox=${pyeongtaek.join(',')}&collections=sentinel-2-l2a&limit=3&sortby=-properties.eo:cloud_cover&filter=${filter}&filter-lang=cql2-json`,
  );
  assert.equal(viaGet.res.status, 200, JSON.stringify(viaGet.json));
  const viaPost = await post('/api/stac/search', {
    bbox: pyeongtaek,
    collections: ['sentinel-2-l2a'],
    limit: 3,
    sortby: [{ field: 'properties.eo:cloud_cover', direction: 'desc' }],
    filter: { op: '<=', args: [{ property: 'eo:cloud_cover' }, 60] },
  });
  const a = viaGet.json as unknown as Collection;
  const b = viaPost.json as unknown as Collection;
  assert.deepEqual(a.features.map((f) => f.id), b.features.map((f) => f.id));
  const next = a.links.find((l) => l.rel === 'next');
  assert.ok(next && !next.method && next.href.includes('token='));
  const page2 = (await (await fetch(next.href.replace(PUBLIC, base))).json()) as Collection;
  assert.equal(page2.numberReturned, 3);
  assert.ok(!page2.features.some((f) => a.features.some((g) => g.id === f.id)));
});

void test('운량 조건은 SAR를 거르고 or(collection = ...)로 되살린다', async () => {
  const eo = (await post('/api/stac/search', {
    bbox: pyeongtaek,
    filter: { op: '<=', args: [{ property: 'eo:cloud_cover' }, 100] },
    limit: 100,
  })).json as unknown as Collection;
  assert.ok(eo.features.length > 0);
  assert.ok(eo.features.every((f) => f.collection === 'sentinel-2-l2a'));
  const both = (await post('/api/stac/search', {
    bbox: pyeongtaek,
    filter: {
      op: 'or',
      args: [
        { op: '=', args: [{ property: 'collection' }, 'sentinel-1-grd'] },
        { op: '<=', args: [{ property: 'eo:cloud_cover' }, 100] },
      ],
    },
    limit: 100,
  })).json as unknown as Collection;
  assert.ok(both.features.some((f) => f.collection === 'sentinel-1-grd'));
});

void test('400 사유들은 problem+json으로', async () => {
  const cases: [unknown, RegExp][] = [
    [{ bbox: pyeongtaek, intersects: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } }, /함께/],
    [{ intersects: { type: 'Polygon', coordinates: [[[126.8, 36.9], [126.9, 36.9], [126.9, 37], [126.8, 37], [126.8, 36.9]], [[127.5, 37.5], [127.6, 37.5], [127.6, 37.6], [127.5, 37.6], [127.5, 37.5]]] } }, /Hole lies outside shell/],
    [{ datetime: '2026-08-01T00:00:00Z/2026-07-01T00:00:00Z' }, /시작이 끝보다/],
    [{ sortby: [{ field: 'properties.aoi:coverage_pct', direction: 'desc' }] }, /intersects나 bbox/],
    [{ filter: { op: '=', args: [{ property: 'nope' }, 1] } }, /검증 실패/],
    [{ 'filter-lang': 'cql2-text', filter: { op: 'isNull', args: [{ property: 'id' }] } }, /검증 실패/],
    [{ token: 'garbage' }, /token/],
    [{ limit: 0 }, /검증 실패/],
  ];
  for (const [body, expected] of cases) {
    const { res, json } = await post('/api/stac/search', body);
    assert.equal(res.status, 400, JSON.stringify(body));
    assert.equal(res.headers.get('content-type')?.split(';')[0], 'application/problem+json');
    assert.equal(json.title, 'Bad Request');
    assert.match(String(json.detail), expected, JSON.stringify(json));
  }
  const clamped = (await post('/api/stac/search', { limit: 500 })).json as unknown as Collection;
  assert.equal(clamped.numberReturned, 100);
  const stale = await post('/api/stac/search', {
    limit: 1,
    token: ((await post('/api/stac/search', { bbox: pyeongtaek, limit: 1 })).json as unknown as Collection).links.find((l) => l.rel === 'next')?.body?.token,
  });
  assert.equal(stale.res.status, 400);
});

void test('GET /api/scenes/:id는 그대로 동작한다', async () => {
  const page = (await post('/api/stac/search', { bbox: pyeongtaek, limit: 1 })).json as unknown as Collection;
  const id = page.features[0].id;
  const { res, json } = await get(`/api/scenes/${id}`);
  assert.equal(res.status, 200);
  assert.equal(json.type, 'Feature');
  assert.equal(json.id, id);
  const missing = await get('/api/scenes/nope');
  assert.equal(missing.res.status, 404);
  assert.equal(missing.json.title, 'Not Found');
});
