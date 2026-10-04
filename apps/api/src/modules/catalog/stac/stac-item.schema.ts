import { z } from 'zod';

const ring = z.array(z.array(z.number()).min(2));

export const geometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Polygon'), coordinates: z.array(ring).min(1) }),
  z.object({
    type: z.literal('MultiPolygon'),
    coordinates: z.array(z.array(ring).min(1)).min(1),
  }),
]);

// 우리가 쓰는 필드만 검사한다. 나머지 필드는 원본(stac)으로 그대로 보관.
export const stacItemSchema = z.object({
  id: z.string().min(1),
  collection: z.string(),
  geometry: geometrySchema,
  properties: z.object({
    datetime: z.iso.datetime({ offset: true }),
    updated: z.iso.datetime({ offset: true }).optional(),
    platform: z.string(),
    // "33.29"처럼 문자열로 온 숫자는 받아 준다. 숫자가 아니면 NaN이라 걸러진다.
    'eo:cloud_cover': z
      .preprocess(
        (v) => (typeof v === 'string' && v.trim() !== '' ? Number(v) : v),
        z.number().min(0).max(100),
      )
      .optional(),
    'sar:resolution_range': z.number().positive().optional(),
    'sar:polarizations': z.array(z.string()).optional(),
    'sar:instrument_mode': z.string().optional(),
  }),
  assets: z.record(
    z.string(),
    z.object({ href: z.string(), gsd: z.number().optional() }),
  ),
});

export type StacItem = z.infer<typeof stacItemSchema>;
