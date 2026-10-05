import { z } from "zod";
import { polygonGeometrySchema, type PolygonGeometry } from "@/lib/geo";
import type { SENSORS, SORT_PRESETS } from "./constants";

export type Sensor = (typeof SENSORS)[number];
export type SortPreset = (typeof SORT_PRESETS)[number];

export interface Aoi {
  id: string;
  name: string;
  geometry: PolygonGeometry;
}

export type Cql2 = { op: string; args: unknown[] };

export interface SearchBody {
  intersects?: PolygonGeometry;
  datetime?: string;
  collections: string[];
  filter?: Cql2;
  sortby: {
    field:
      | "properties.datetime"
      | "properties.aoi:coverage_pct"
      | "properties.eo:cloud_cover";
    direction: "asc" | "desc";
  }[];
  limit: number;
}

export type BlockReason = "no-sensor" | "date-range";

export type SearchBodyResult =
  { ok: true; body: SearchBody } | { ok: false; reason: BlockReason };

// 화면에서 쓰는 필드만 검사한다. 응답은 Swagger 타입이 없어서 여기서 정의한다.
// 나머지 필드는 STAC JSON 복사에 남도록 지우지 않는다(looseObject).
const stacItemSchema = z.looseObject({
  type: z.literal("Feature"),
  id: z.string(),
  collection: z.string(),
  geometry: polygonGeometrySchema,
  properties: z.looseObject({
    datetime: z.string(),
    platform: z.string(),
    gsd: z.number().optional(),
    "eo:cloud_cover": z.number().nullish(),
    "aoi:coverage_km2": z.number().optional(),
    "aoi:coverage_pct": z.number().optional(),
    "grid:code": z.string().optional(), // EO: MGRS 타일
    "view:sun_elevation": z.number().optional(),
    "sar:instrument_mode": z.string().optional(),
    "sar:polarizations": z.array(z.string()).optional(),
    "sat:orbit_state": z.enum(["ascending", "descending"]).optional(),
    "sat:relative_orbit": z.number().optional(),
  }),
  assets: z.record(z.string(), z.looseObject({ href: z.string() }).optional()),
});

export type StacItem = z.infer<typeof stacItemSchema>;

export const itemCollectionSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(stacItemSchema),
  numberMatched: z.number(),
  links: z.array(
    z.object({
      rel: z.string(),
      body: z.object({ token: z.string().optional() }).optional(),
    }),
  ),
});
