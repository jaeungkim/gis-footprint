import { z } from 'zod';

// GeoJSON Polygon/MultiPolygon 구조만 본다. 링 규칙은 polygon.ts, 위상은 PostGIS가 본다.
const ring = z.array(z.array(z.number()).min(2));

export const geometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Polygon'), coordinates: z.array(ring).min(1) }),
  z.object({
    type: z.literal('MultiPolygon'),
    coordinates: z.array(z.array(ring).min(1)).min(1),
  }),
]);
