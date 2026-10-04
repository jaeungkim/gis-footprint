import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toProblem } from '../../../problem-details.filter.js';
import { parseOrThrow } from '../../../zod-problem.js';
import { cql2Schema, type Cql2Expr } from './cql2.schema.js';
import { cql2ToSql } from './cql2-to-sql.js';

function compile(input: unknown) {
  return cql2ToSql(parseOrThrow(cql2Schema, input, 'filter'));
}

function status(fn: () => unknown): number {
  try {
    fn();
    return 200;
  } catch (e) {
    return toProblem(e).status;
  }
}

void test('비교와 논리 연산자를 SQL로 바꾸고 값은 바인딩한다', () => {
  const q = compile({
    op: 'and',
    args: [
      { op: '<=', args: [{ property: 'eo:cloud_cover' }, 20] },
      {
        op: 'or',
        args: [
          { op: '=', args: [{ property: 'platform' }, 'sentinel-2a'] },
          { op: '=', args: ['sentinel-2b', { property: 'platform' }] },
        ],
      },
      { op: 'not', args: [{ op: 'isNull', args: [{ property: 'eo:cloud_cover' }] }] },
      {
        op: '>=',
        args: [{ property: 'datetime' }, { timestamp: '2026-07-01T00:00:00Z' }],
      },
    ],
  });
  assert.equal(
    q.text,
    '((cloud_cover <= $1) AND ((platform = $2) OR ($3 = platform)) AND (NOT (cloud_cover IS NULL)) AND (acquired_at >= $4))',
  );
  assert.deepEqual(q.values.slice(0, 3), [20, 'sentinel-2a', 'sentinel-2b']);
  assert.equal((q.values[3] as Date).toISOString(), '2026-07-01T00:00:00.000Z');
});

void test('모르는 속성, 모르는 연산자, 인자 개수 오류는 400', () => {
  assert.equal(status(() => compile({ op: '=', args: [{ property: 'nope' }, 1] })), 400);
  assert.equal(status(() => compile({ op: 'like', args: [{ property: 'id' }, 'a%'] })), 400);
  assert.equal(status(() => compile({ op: 'and', args: [{ op: 'isNull', args: [{ property: 'id' }] }] })), 400);
  assert.equal(status(() => compile({ op: 'not', args: [] })), 400);
});

void test('타입 불일치, 속성끼리, 리터럴끼리는 400', () => {
  assert.equal(status(() => compile({ op: '=', args: [{ property: 'platform' }, 1] })), 400);
  assert.equal(status(() => compile({ op: '<', args: [{ property: 'gsd' }, '10'] })), 400);
  assert.equal(status(() => compile({ op: '<', args: [{ property: 'datetime' }, '2026-07-01T00:00:00Z'] })), 400);
  assert.equal(status(() => compile({ op: '=', args: [{ property: 'id' }, { property: 'collection' }] })), 400);
  assert.equal(status(() => compile({ op: '=', args: [1, 1] })), 400);
});

void test('깊이와 리터럴 상한', () => {
  let deep: Cql2Expr = { op: 'isNull', args: [{ property: 'id' }] };
  for (let i = 0; i < 10; i++) deep = { op: 'not', args: [deep] };
  assert.equal(status(() => cql2ToSql(deep)), 400);

  const many: Cql2Expr = {
    op: 'and',
    args: Array.from({ length: 20 }, () => ({
      op: 'or' as const,
      args: Array.from({ length: 6 }, () => ({
        op: '=' as const,
        args: [{ property: 'id' }, 'x'] as [{ property: 'id' }, string],
      })),
    })),
  };
  assert.equal(status(() => cql2ToSql(many)), 400); // 120 리터럴
});
