import { z } from "zod";

// 고리 목록. 고리 하나는 [경도, 위도] 점들
const ringsSchema = z.array(z.array(z.array(z.number())));

// GeoJSON Polygon/MultiPolygon. AOI와 영상 footprint가 같이 쓴다.
export const polygonGeometrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Polygon"), coordinates: ringsSchema }),
  z.object({
    type: z.literal("MultiPolygon"),
    coordinates: z.array(ringsSchema),
  }),
]);

export type PolygonGeometry = z.infer<typeof polygonGeometrySchema>;

// 여러 개를 넘기면 전부 감싸는 bbox
export function bboxOf(
  ...gs: PolygonGeometry[]
): [number, number, number, number] {
  const rings = gs.flatMap((g) =>
    g.type === "Polygon" ? g.coordinates : g.coordinates.flat(),
  );
  const xs = rings.flat().map((p) => p[0]);
  const ys = rings.flat().map((p) => p[1]);

  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
