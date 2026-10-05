import {
  applyDecorators,
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiQuery, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { parseOrThrow } from '../common/zod-problem.js';
import { GEOJSON } from './links.js';
import { queryToBody, searchBodySchema } from './search-request.schema.js';
import { SearchService } from './search.service.js';

// Swagger용. 재귀 CQL2 스키마는 JSON Schema로 내면 definitions가 생겨 web의 타입 생성이 못 풀어서
// filter만 불투명 객체로 적는다. 런타임 검증은 searchBodySchema가 그대로 한다.
export function searchBodyDocsSchema() {
  const docs = searchBodySchema.extend({
    bbox: z.array(z.number()).min(4).max(4).optional(),
    filter: z
      .looseObject({})
      .describe(
        'CQL2-JSON (Basic). 예: {"op":"<=","args":[{"property":"eo:cloud_cover"},20]}. 속성은 /api/stac/queryables',
      )
      .optional(),
  });

  return z.toJSONSchema(docs, { target: 'openapi-3.0', io: 'input' });
}

const GET_PARAMS = applyDecorators(
  ...[
    {
      name: 'intersects',
      description: 'GeoJSON Polygon 또는 MultiPolygon(JSON 문자열)',
    },
    {
      name: 'bbox',
      description: 'west,south,east,north',
      example: '126.8,36.9,126.9,37',
    },
    {
      name: 'datetime',
      description:
        'RFC 3339 "start/end", "../end", "start/..", 단일 시각. 양끝 포함. +는 %2B로',
      example: '2026-07-01T00:00:00Z/2026-07-31T23:59:59Z',
    },
    {
      name: 'collections',
      description: '콤마 구분',
      example: 'sentinel-2-l2a,sentinel-1-grd',
    },
    { name: 'ids', description: '콤마 구분, 최대 100' },
    { name: 'limit', description: '1~100, 기본 10. 초과는 100으로' },
    { name: 'token', description: 'next 링크의 토큰' },
    {
      name: 'sortby',
      description: '+field,-field. /api/stac/sortables',
      example: '-properties.datetime',
    },
    {
      name: 'filter',
      description: 'CQL2-JSON(URL 인코딩). filter-lang=cql2-json 필수',
    },
    {
      name: 'filter-lang',
      description: 'cql2-json만 지원',
      example: 'cql2-json',
    },
  ].map((p) => ApiQuery({ ...p, required: false })),
);

@ApiTags('stac')
@Controller('stac')
export class SearchController {
  constructor(private readonly service: SearchService) {}

  @Get('search')
  @Header('Content-Type', GEOJSON)
  @GET_PARAMS
  get(@Query() query: Record<string, unknown>) {
    const body = parseOrThrow(searchBodySchema, queryToBody(query));
    return this.service.search(body, { method: 'GET', query });
  }

  @Post('search')
  @HttpCode(200)
  @Header('Content-Type', GEOJSON)
  @ApiBody({ schema: searchBodyDocsSchema() as any })
  post(@Body() raw: unknown) {
    const body = parseOrThrow(searchBodySchema, raw);
    return this.service.search(body, { method: 'POST', body });
  }
}
