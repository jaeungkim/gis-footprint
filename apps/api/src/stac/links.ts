// STAC Link. href는 전부 STAC_PUBLIC_URL + 경로의 절대 URL이다(클라이언트가 그대로 요청한다).
export interface StacLink {
  rel: string;
  href: string;
  type?: string;
  title?: string;
  method?: 'GET' | 'POST';
  body?: unknown;
  merge?: boolean;
}

export const STAC_PATH = '/api/stac';
export const GEOJSON = 'application/geo+json';
export const JSON_TYPE = 'application/json';

export function href(base: string, path: string): string {
  return `${base}${path}`;
}

export function rootLink(base: string): StacLink {
  return { rel: 'root', href: href(base, STAC_PATH), type: JSON_TYPE };
}

export function collectionHref(base: string, id: string): string {
  return href(base, `${STAC_PATH}/collections/${encodeURIComponent(id)}`);
}
