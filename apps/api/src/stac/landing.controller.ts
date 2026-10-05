import { Controller, Get, Header } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import type { Env } from '../config/env.js';
import { CollectionsService } from './collections.service.js';
import {
  collectionHref,
  GEOJSON,
  href,
  JSON_TYPE,
  rootLink,
  STAC_PATH,
} from './links.js';
import type { StacLink } from './interfaces/stac.interface.js';
import { queryablesSchema, sortablesSchema } from './queryables.js';

// cql2-text는 광고하지 않는다. GET에서 filter를 쓰려면 filter-lang=cql2-json을 같이 보내야 한다.
export const CONFORMS_TO = [
  'https://api.stacspec.org/v1.0.0/core',
  'https://api.stacspec.org/v1.0.0/item-search',
  'https://api.stacspec.org/v1.0.0/item-search#filter',
  'https://api.stacspec.org/v1.0.0/item-search#sort',
  'https://api.stacspec.org/v1.0.0/collections',
  'http://www.opengis.net/spec/ogcapi-features-3/1.0/conf/filter',
  'http://www.opengis.net/spec/ogcapi-features-3/1.0/conf/queryables',
  'http://www.opengis.net/spec/cql2/1.0/conf/basic-cql2',
  'http://www.opengis.net/spec/cql2/1.0/conf/cql2-json',
];

const SCHEMA_JSON = 'application/schema+json';

@ApiTags('stac')
@Controller('stac')
export class LandingController {
  private readonly base: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly collections: CollectionsService,
  ) {
    this.base = config.get('STAC_PUBLIC_URL', { infer: true });
  }

  @Get()
  landing() {
    const b = this.base;
    const at = (path: string) => href(b, `${STAC_PATH}${path}`);

    const links: StacLink[] = [
      { rel: 'self', href: at(''), type: JSON_TYPE },
      rootLink(b),
      {
        rel: 'service-desc',
        href: href(b, '/api/docs-json'),
        type: 'application/vnd.oai.openapi+json;version=3.0',
      },
      { rel: 'service-doc', href: href(b, '/api/docs'), type: 'text/html' },
      { rel: 'conformance', href: at('/conformance'), type: JSON_TYPE },
      { rel: 'data', href: at('/collections'), type: JSON_TYPE },
      ...this.collections.ids().map((id) => ({
        rel: 'child',
        href: collectionHref(b, id),
        type: JSON_TYPE,
      })),
      { rel: 'search', href: at('/search'), type: GEOJSON },
      {
        rel: 'search',
        href: at('/search'),
        type: GEOJSON,
        method: 'POST' as const,
      },
      {
        rel: 'http://www.opengis.net/def/rel/ogc/1.0/queryables',
        href: at('/queryables'),
        type: SCHEMA_JSON,
      },
      {
        rel: 'http://www.opengis.net/def/rel/ogc/1.0/sortables',
        href: at('/sortables'),
        type: SCHEMA_JSON,
      },
    ];

    return {
      type: 'Catalog',
      stac_version: '1.0.0',
      id: 'footprint',
      title: 'Footprint',
      description:
        '한반도 Sentinel-2 L2A와 Sentinel-1 GRD 카탈로그. 위성영상 마켓플레이스 공부용 프로젝트.',
      conformsTo: CONFORMS_TO,
      links,
    };
  }

  @Get('conformance')
  conformance() {
    return { conformsTo: CONFORMS_TO };
  }

  @Get('queryables')
  @Header('Content-Type', SCHEMA_JSON)
  queryables() {
    return queryablesSchema(href(this.base, `${STAC_PATH}/queryables`));
  }

  @Get('sortables')
  @Header('Content-Type', SCHEMA_JSON)
  sortables() {
    return sortablesSchema(href(this.base, `${STAC_PATH}/sortables`));
  }
}
