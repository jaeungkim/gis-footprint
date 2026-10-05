import { z } from 'zod';
import { QUERYABLE_NAMES } from '../queryables.js';

// CQL2-JSON Basic 부분집합: and/or/not, 비교 6개, isNull. 속성은 queryables 화이트리스트만.
export const MAX_ARGS = 20;

const propertyRef = z.strictObject({ property: z.enum(QUERYABLE_NAMES) });

const timestampLiteral = z.strictObject({
  timestamp: z.iso.datetime({ offset: true }),
});

const literal = z.union([z.string(), z.number(), timestampLiteral]);
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

export const cql2Schema: z.ZodType<Cql2Expr> = z.lazy(() =>
  z.union([
    z.strictObject({
      op: z.enum(['and', 'or']),
      args: z.array(cql2Schema).min(2).max(MAX_ARGS),
    }),
    z.strictObject({ op: z.literal('not'), args: z.tuple([cql2Schema]) }),
    z.strictObject({
      op: z.enum(['=', '<>', '<', '<=', '>', '>=']),
      args: z.tuple([operand, operand]),
    }),
    z.strictObject({ op: z.literal('isNull'), args: z.tuple([propertyRef]) }),
  ]),
);
