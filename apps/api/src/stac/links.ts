import type { StacLink } from './interfaces/stac.interface.js';

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
