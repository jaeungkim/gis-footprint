// GeoJSON Polygon/MultiPolygon. AOI와 영상 footprint가 같이 쓴다.
export type PolygonGeometry =
  | { type: "Polygon"; coordinates: number[][][] }
  | { type: "MultiPolygon"; coordinates: number[][][][] };

export function bboxOf(g: PolygonGeometry): [number, number, number, number] {
  const rings = g.type === "Polygon" ? g.coordinates : g.coordinates.flat();
  const xs = rings.flat().map((p) => p[0]);
  const ys = rings.flat().map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}
