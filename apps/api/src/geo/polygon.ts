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
    if (selfIntersects(ring)) {
      return '링이 자기 교차함';
    }
  }

  return null;
}

function samePosition(a: Position, b: Position): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

// 이웃하지 않은 변끼리 만나면 자기 교차. 링 사이(바깥 링과 구멍) 교차는 안 본다.
// ponytail: O(n²) 변 쌍 비교. footprint 링은 점이 수십 개라 충분하고, 커지면 sweep line.
function selfIntersects(ring: Position[]): boolean {
  const edges = ring.length - 1;
  for (let i = 0; i < edges; i++) {
    for (let j = i + 2; j < edges; j++) {
      if (i === 0 && j === edges - 1) continue; // 첫 변과 마지막 변은 시작점을 공유
      if (segmentsTouch(ring[i], ring[i + 1], ring[j], ring[j + 1])) {
        return true;
      }
    }
  }

  return false;
}

function segmentsTouch(a: Position, b: Position, c: Position, d: Position) {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);

  if (d1 * d2 < 0 && d3 * d4 < 0) return true;

  // 한 끝점이 다른 선분 위에 있는 경우
  return (
    (d1 === 0 && withinBox(c, d, a)) ||
    (d2 === 0 && withinBox(c, d, b)) ||
    (d3 === 0 && withinBox(a, b, c)) ||
    (d4 === 0 && withinBox(a, b, d))
  );
}

// o→a 와 o→b 의 외적. 부호가 b가 o→a 직선의 어느 쪽인지 알려 준다.
function cross(o: Position, a: Position, b: Position): number {
  return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
}

function withinBox(p: Position, q: Position, r: Position): boolean {
  return (
    Math.min(p[0], q[0]) <= r[0] &&
    r[0] <= Math.max(p[0], q[0]) &&
    Math.min(p[1], q[1]) <= r[1] &&
    r[1] <= Math.max(p[1], q[1])
  );
}

// RFC 7946 오른손 법칙: 바깥 링은 반시계, 구멍은 시계 방향. 반대면 뒤집는다.
export function rewind(
  geometry: Polygon | MultiPolygon,
): Polygon | MultiPolygon {
  return geometry.type === 'Polygon'
    ? { type: 'Polygon', coordinates: rewindRings(geometry.coordinates) }
    : {
        type: 'MultiPolygon',
        coordinates: geometry.coordinates.map(rewindRings),
      };
}

function rewindRings(rings: Position[][]): Position[][] {
  return rings.map((ring, i) =>
    isClockwise(ring) === (i === 0) ? ring.toReversed() : ring,
  );
}

// 신발끈 공식. 방향은 부호만 보면 되니까 경위도 평면 그대로 계산한다.
function isClockwise(ring: Position[]): boolean {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    sum += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1]);
  }

  return sum > 0;
}

// DB는 전부 MultiPolygon으로 저장한다. 원본 STAC geometry가 Polygon이었으면 다시 풀어 준다.
export function toOriginalType(
  multi: MultiPolygon,
  stac: unknown,
): Polygon | MultiPolygon {
  const original =
    typeof stac === 'object' && stac !== null && 'geometry' in stac
      ? (stac.geometry as { type?: string } | null)?.type
      : undefined;

  return original === 'Polygon' && multi.coordinates.length === 1
    ? { type: 'Polygon', coordinates: multi.coordinates[0] }
    : multi;
}
