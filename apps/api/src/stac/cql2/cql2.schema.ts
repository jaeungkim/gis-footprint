import { z } from 'zod';
import { QUERYABLE_NAMES } from '../queryables.js';

// CQL2-JSON Basic 부분집합: and/or/not, 비교 6개, isNull. 속성은 queryables 화이트리스트만.
export const MAX_ARGS = 20;
export const MAX_DEPTH = 10;

// Postgres text는 NUL(0x00)을 못 받아서 쿼리가 500으로 터진다. DB로 가는 문자열은 여기서 400.
export const text = z
  .string()
  .refine((s) => !s.includes('\0'), 'NUL 문자는 쓸 수 없음');

// Postgres에는 0년이 없어서 그보다 앞선 시각은 500이 난다. 오프셋을 반영한 UTC 기준으로 본다.
export const rfc3339 = z.iso
  .datetime({ offset: true })
  .refine((s) => new Date(s).getUTCFullYear() >= 1, '1년 이전 시각은 안 됨');

const propertyRef = z.strictObject({ property: z.enum(QUERYABLE_NAMES) });

const timestampLiteral = z.strictObject({ timestamp: rfc3339 });

const literal = z.union([text, z.number(), timestampLiteral]);
const operand = z.union([propertyRef, literal]);

export type PropertyRef = z.infer<typeof propertyRef>;
export type Literal = z.infer<typeof literal>;

export type Cql2Expr =
  | { op: 'and' | 'or'; args: Cql2Expr[] }
  | { op: 'not'; args: [Cql2Expr] }
  | {
      op: '=' | '<>' | '<' | '<=' | '>' | '>=';
      args: [PropertyRef | Literal, PropertyRef | Literal];
    }
  | { op: 'isNull'; args: [PropertyRef] };

const expr: z.ZodType<Cql2Expr> = z.lazy(() =>
  z.union([
    z.strictObject({
      op: z.enum(['and', 'or']),
      args: z.array(expr).min(2).max(MAX_ARGS),
    }),
    z.strictObject({ op: z.literal('not'), args: z.tuple([expr]) }),
    z.strictObject({
      op: z.enum(['=', '<>', '<', '<=', '>', '>=']),
      args: z.tuple([operand, operand]),
    }),
    z.strictObject({ op: z.literal('isNull'), args: z.tuple([propertyRef]) }),
  ]),
);

// args를 가진 식만 한 단계로 센다. 루트가 1. 재귀는 MAX_DEPTH + 1에서 멈춘다.
function tooDeep(v: unknown, depth = 1): boolean {
  const args = (v as { args?: unknown } | null)?.args;
  if (!Array.isArray(args)) return false;
  return depth > MAX_DEPTH || args.some((a) => tooDeep(a, depth + 1));
}

// zod는 재귀 스키마를 끝까지 내려가서 not이 수천 겹이면 콜스택이 터진다(500). 파싱 전에 깊이만 본다.
export const cql2Schema = z.preprocess((v, ctx) => {
  if (!tooDeep(v)) return v;
  ctx.addIssue({ code: 'custom', message: `깊이 ${MAX_DEPTH} 초과` });
  return z.NEVER;
}, expr);
