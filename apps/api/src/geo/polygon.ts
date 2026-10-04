import type { MultiPolygon, Polygon, Position } from 'geojson';

// GeoJSON(RFC 7946) 폴리곤 규칙 검사. 문제가 없으면 null, 있으면 이유.
export function findPolygonError(
  geometry: Polygon | MultiPolygon,
): string | null {
  const polygons =
    geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates;

  for (const ring of polygons.flat()) {
    if (ring.length < 4) {
      return `링의 점이 ${ring.length}개 (4개 이상이어야 함)`;
    }
    if (!samePosition(ring[0], ring[ring.length - 1])) {
      return '링이 닫혀 있지 않음';
    }
    for (const [lon, lat] of ring) {
      if (Math.abs(lon) > 180 || Math.abs(lat) > 90) {
        return `경위도 범위 밖 좌표 [${lon}, ${lat}]`;
      }
    }
  }
  return null;
}

function samePosition(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1];
}
