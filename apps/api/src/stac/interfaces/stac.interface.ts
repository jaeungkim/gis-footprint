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

export type StacCollection = { id: string } & Record<string, unknown>;

export interface ItemCollection {
  type: 'FeatureCollection';
  stac_version: '1.0.0';
  features: Record<string, unknown>[];
  numberMatched: number;
  numberReturned: number;
  links: StacLink[];
}
