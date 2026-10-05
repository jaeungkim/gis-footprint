import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client.js';
import { QUERYABLES, type QueryableType } from '../queryables.js';
import type { Cql2Expr, Literal, PropertyRef } from './cql2.schema.js';

const { sql, join } = Prisma;

// 연산자도 사용자 문자열이 아니라 이 고정 맵에서 꺼낸다.
const OPS = {
  '=': sql`=`,
  '<>': sql`<>`,
  '<': sql`<`,
  '<=': sql`<=`,
  '>': sql`>`,
  '>=': sql`>=`,
};

export const MAX_DEPTH = 10;
export const MAX_LITERALS = 100; // 바인딩 파라미터 상한(65,535)과 CPU 보호

function bad(message: string): never {
  throw new BadRequestException(`filter: ${message}`);
}

function isRef(x: PropertyRef | Literal): x is PropertyRef {
  return typeof x === 'object' && x !== null && 'property' in x;
}

// 파싱된 CQL2 트리 → SQL 조각. 컬럼 이름은 scene 테이블 그대로(hits CTE 안에서 쓰인다).
export function cql2ToSql(expr: Cql2Expr): Prisma.Sql {
  const budget = { literals: 0 };
  return walk(expr, 1, budget);
}

function walk(
  e: Cql2Expr,
  depth: number,
  budget: { literals: number },
): Prisma.Sql {
  if (depth > MAX_DEPTH) bad(`깊이 ${MAX_DEPTH} 초과`);

  switch (e.op) {
    case 'and':
    case 'or': {
      const parts = e.args.map((a) => walk(a, depth + 1, budget));
      return sql`(${join(parts, e.op === 'and' ? ' AND ' : ' OR ')})`;
    }
    case 'not':
      return sql`(NOT ${walk(e.args[0], depth + 1, budget)})`;
    case 'isNull':
      return sql`(${QUERYABLES[e.args[0].property].column} IS NULL)`;
    default: {
      const [a, b] = e.args;
      const refs = e.args.filter(isRef);
      if (refs.length === 2) bad('속성끼리 비교는 지원하지 않음');
      if (refs.length === 0) bad('리터럴끼리 비교는 지원하지 않음');

      const ref = refs[0];
      const lit = (isRef(a) ? b : a) as Literal;
      const q = QUERYABLES[ref.property];
      const value = literalValue(q.type, lit, ref.property);
      if (++budget.literals > MAX_LITERALS)
        bad(`리터럴 ${MAX_LITERALS}개 초과`);

      return isRef(a)
        ? sql`(${q.column} ${OPS[e.op]} ${value})`
        : sql`(${value} ${OPS[e.op]} ${q.column})`;
    }
  }
}

function literalValue(
  type: QueryableType,
  lit: Literal,
  property: string,
): string | number | Date {
  if (type === 'timestamp') {
    if (typeof lit === 'object') return new Date(lit.timestamp);
    bad(`${property}에는 {"timestamp": "..."} 리터럴이 필요함`);
  }
  if (typeof lit === 'object') bad(`${property}는 timestamp 속성이 아님`);
  if (type === 'string' && typeof lit !== 'string')
    bad(`${property}는 문자열이어야 함`);
  if (type === 'number' && typeof lit !== 'number')
    bad(`${property}는 숫자여야 함`);

  return lit;
}
