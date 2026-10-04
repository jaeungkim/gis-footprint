import { toOriginalType } from '../geo/polygon.js';
import type { SceneRow } from '../catalog/interfaces/scene-query.interface.js';
import { collectionHref, JSON_TYPE, rootLink } from './links.js';

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// 원본 STAC Item을 바탕으로, geometry·bbox는 DB 값, links는 우리 것, 커버리지는 properties에 더한다.
export function toStacItem(row: SceneRow, base: string): Record<string, unknown> {
  const stac = (
    typeof row.stac === 'object' && row.stac !== null ? row.stac : {}
  ) as Record<string, unknown>;
  const properties: Record<string, unknown> = {
    ...(stac.properties as Record<string, unknown> | undefined),
  };
  if (row.coverageKm2 !== null && row.coveragePct !== null) {
    properties['aoi:coverage_km2'] = round2(row.coverageKm2);
    properties['aoi:coverage_pct'] = round2(row.coveragePct);
  }
  return {
    ...stac,
    type: 'Feature',
    stac_version: stac.stac_version ?? '1.0.0',
    id: row.id,
    geometry: toOriginalType(row.geometry, stac),
    bbox: row.bbox,
    collection: row.collection,
    properties,
    // self는 권장 사항이라 생략. Item 단건 엔드포인트(Features 클래스)는 아직 없다.
    links: [
      rootLink(base),
      { rel: 'collection', href: collectionHref(base, row.collection), type: JSON_TYPE },
    ],
  };
}
