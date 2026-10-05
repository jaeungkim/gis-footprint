// GeoJSON Polygon/MultiPolygon. AOI와 영상 footprint가 같이 쓴다.
export type PolygonGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

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
