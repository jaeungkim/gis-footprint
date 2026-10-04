import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { z } from 'zod';
import { toProblem } from './problem-details.filter.js';
import { parseOrThrow } from './zod-problem.js';

void test('HttpException은 상태와 사유를 낸다', () => {
  assert.deepEqual(toProblem(new NotFoundException('scene x 없음')), {
    type: 'about:blank',
    title: 'Not Found',
    status: 404,
    detail: 'scene x 없음',
  });
});

void test('zod 실패는 400과 errors 배열', () => {
  const schema = z.object({ limit: z.int().min(1) });
  assert.throws(
    () => parseOrThrow(schema, { limit: 0 }),
    (e: unknown) => {
      const p = toProblem(e);
      assert.equal(p.status, 400);
      assert.equal(p.detail, '요청 검증 실패');
      assert.equal(p.errors?.[0].field, 'limit');
      return true;
    },
  );
});

void test('ValidationPipe의 문자열 배열 message도 errors로', () => {
  const p = toProblem(new BadRequestException(['a must be x', 'b too long']));
  assert.deepEqual(p.errors, [
    { message: 'a must be x' },
    { message: 'b too long' },
  ]);
});

void test('알 수 없는 예외는 상세 없는 500', () => {
  assert.deepEqual(toProblem(new Error('GEOS TopologyException ...')), {
    type: 'about:blank',
    title: 'Internal Server Error',
    status: 500,
  });
});
