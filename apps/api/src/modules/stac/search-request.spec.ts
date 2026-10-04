import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toProblem } from '../../problem-details.filter.js';
import { parseOrThrow } from '../../zod-problem.js';
import {
  parseDatetime,
  queryToBody,
  resolveAoi,
  searchBodySchema,
} from './search-request.schema.js';
import { resolveSort } from './sortby.js';
import { conditionHash, decodeToken, encodeToken } from './token.js';

function status(fn: () => unknown): number {
  try {
    fn();
    return 200;
  } catch (e) {
    return toProblem(e).status;
  }
}

const square = {
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

void test('GET 쿼리를 본문 모양으로 바꾼다', () => {
  const body = queryToBody({
    intersects: JSON.stringify(square),
    collections: 'sentinel-2-l2a,sentinel-1-grd',
    ids: 'a,b',
    limit: '5',
    sortby: '-properties.datetime,+id',
    datetime: '2026-07-01T00:00:00+09:00/..',
    filter: '{"op":"isNull","args":[{"property":"eo:cloud_cover"}]}',
    'filter-lang': 'cql2-json',
    token: 't',
    junk: 'x',
  });
  const parsed = parseOrThrow(searchBodySchema, body);
  assert.deepEqual(parsed.collections, ['sentinel-2-l2a', 'sentinel-1-grd']);
  assert.deepEqual(parsed.ids, ['a', 'b']);
  assert.equal(parsed.limit, 5);
  assert.deepEqual(parsed.sortby, [
    { field: 'properties.datetime', direction: 'desc' },
    { field: 'id', direction: 'asc' },
  ]);
  assert.equal(parsed.filter?.op, 'isNull');
  assert.ok(!('junk' in parsed));
});

void test('GET filter에 filter-lang이 없으면 cql2-text로 보고 400', () => {
  const body = queryToBody({ filter: '{"op":"isNull","args":[{"property":"id"}]}' });
  assert.equal(status(() => parseOrThrow(searchBodySchema, body)), 400);
});

void test('limit은 1 미만이면 400, 100 초과는 100으로 자른다', () => {
  assert.equal(status(() => parseOrThrow(searchBodySchema, { limit: 0 })), 400);
  assert.equal(status(() => parseOrThrow(searchBodySchema, { limit: 1.5 })), 400);
  assert.equal(parseOrThrow(searchBodySchema, { limit: 500 }).limit, 100);
});

void test('datetime 네 가지 형태와 오류', () => {
  assert.deepEqual(parseDatetime('2026-07-01T00:00:00+09:00/2026-08-01T00:00:00+09:00'), {
    from: new Date('2026-06-30T15:00:00Z'),
    to: new Date('2026-07-31T15:00:00Z'),
  });
  assert.deepEqual(parseDatetime('../2026-08-01T00:00:00Z'), {
    from: null,
    to: new Date('2026-08-01T00:00:00Z'),
  });
  assert.deepEqual(parseDatetime('2026-08-01T00:00:00Z/..'), {
    from: new Date('2026-08-01T00:00:00Z'),
    to: null,
  });
  assert.deepEqual(parseDatetime('2026-08-01T00:00:00Z'), { at: new Date('2026-08-01T00:00:00Z') });
  assert.equal(status(() => parseDatetime('../..')), 400);
  assert.equal(status(() => parseDatetime('2026-08-01T00:00:00Z/2026-07-01T00:00:00Z')), 400);
  assert.equal(status(() => parseDatetime('2026-08-01')), 400);
  assert.equal(status(() => parseDatetime('2026-08-01T00:00:00')), 400);
});

void test('intersects와 bbox 규칙', () => {
  const both = parseOrThrow(searchBodySchema, { intersects: square, bbox: [126, 37, 127, 38] });
  assert.equal(status(() => resolveAoi(both)), 400);
  const fromBbox = resolveAoi(parseOrThrow(searchBodySchema, { bbox: [126, 37, 127, 38] }));
  assert.deepEqual(fromBbox, square);
  assert.equal(status(() => resolveAoi(parseOrThrow(searchBodySchema, { bbox: [127, 37, 126, 38] }))), 400);
  assert.equal(status(() => resolveAoi(parseOrThrow(searchBodySchema, { bbox: [126, 37, 200, 38] }))), 400);
  const open = { type: 'Polygon', coordinates: [square.coordinates[0].slice(0, 4)] };
  assert.equal(status(() => resolveAoi(parseOrThrow(searchBodySchema, { intersects: open }))), 400);
  const cw = { type: 'Polygon', coordinates: [square.coordinates[0].toReversed()] };
  assert.deepEqual(resolveAoi(parseOrThrow(searchBodySchema, { intersects: cw })), square);
  const ring = Array.from({ length: 5001 }, (_, i) => [126 + (i % 2) * 0.001, 37 + i * 0.0001]);
  ring.push(ring[0]);
  const huge = { type: 'Polygon', coordinates: [ring] };
  assert.equal(status(() => resolveAoi(parseOrThrow(searchBodySchema, { intersects: huge }))), 400);
  assert.equal(resolveAoi(parseOrThrow(searchBodySchema, {})), null);
});

void test('sortby 기본값과 id 보강, 모르는 필드와 개수 초과', () => {
  assert.deepEqual(resolveSort(undefined), [
    { key: 'datetime', dir: 'desc' },
    { key: 'id', dir: 'desc' },
  ]);
  assert.deepEqual(
    resolveSort([
      { field: 'properties.eo:cloud_cover', direction: 'asc' },
      { field: 'id', direction: 'asc' },
    ]),
    [
      { key: 'eo:cloud_cover', dir: 'asc' },
      { key: 'id', dir: 'asc' },
    ],
  );
  assert.equal(status(() => resolveSort([{ field: 'properties.gsd', direction: 'asc' }])), 400);
  assert.equal(
    status(() =>
      resolveSort(Array.from({ length: 4 }, () => ({ field: 'id', direction: 'asc' as const }))),
    ),
    400,
  );
  assert.equal(status(() => parseOrThrow(searchBodySchema, { sortby: [{ field: 'properties.gsd', direction: 'asc' }] })), 400);
});

void test('토큰 왕복, 깨진 토큰, 조건 해시는 키 순서와 무관', () => {
  const t = encodeToken({ k: [1_760_000_000_000, 'S2_A'], h: 'abcd' });
  assert.deepEqual(decodeToken(t), { k: [1_760_000_000_000, 'S2_A'], h: 'abcd' });
  assert.equal(decodeToken('not base64 json'), null);
  assert.equal(decodeToken(Buffer.from('{"k":"x","h":1}').toString('base64url')), null);
  assert.equal(conditionHash({ a: 1, b: [1, { c: 2, d: 3 }] }), conditionHash({ b: [1, { d: 3, c: 2 }], a: 1 }));
  assert.notEqual(conditionHash({ a: 1 }), conditionHash({ a: 2 }));
});
