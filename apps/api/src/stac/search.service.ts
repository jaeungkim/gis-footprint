import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { CatalogRepository } from '../catalog/catalog.repository.js';
import { cql2ToSql } from './cql2/cql2-to-sql.js';
import { toStacItem } from './item.js';
import { GEOJSON, href, rootLink, STAC_PATH } from './links.js';
import {
  DEFAULT_LIMIT,
  parseDatetime,
  resolveAoi,
  type SearchBody,
} from './dto/search-request.dto.js';
import type { ItemCollection, StacLink } from './interfaces/stac.interface.js';
import { resolveSort } from './sortby.js';
import { conditionHash, decodeToken, encodeToken } from './token.js';

// next 링크를 요청 방식에 맞게 만들려고 원래 요청을 같이 받는다.
export type SearchOrigin =
  | { method: 'POST'; body: SearchBody }
  | { method: 'GET'; query: Record<string, unknown> };

@Injectable()
export class SearchService {
  private readonly base: string;

  constructor(
    private readonly catalog: CatalogRepository,
    config: ConfigService<Env, true>,
  ) {
    this.base = config.get('STAC_PUBLIC_URL', { infer: true });
  }

  async search(
    body: SearchBody,
    origin: SearchOrigin,
  ): Promise<ItemCollection> {
    const aoi = resolveAoi(body);
    if (aoi) {
      // 구조는 resolveAoi가 봤고, 위상(구멍 위치, 겹침, 면적 0)은 DB가 본다. 무효면 ST_Intersection이 500을 낸다.
      const check = await this.catalog.validateAoi(aoi);
      if (!check.valid)
        throw new BadRequestException(`AOI 무효: ${check.reason}`);
    }

    const datetime = body.datetime ? parseDatetime(body.datetime) : null;
    const sort = resolveSort(body.sortby);
    if (!aoi && sort.some((s) => s.key === 'aoi:coverage_pct')) {
      throw new BadRequestException(
        'sortby: properties.aoi:coverage_pct는 intersects나 bbox가 있어야 함',
      );
    }

    const predicate = body.filter ? cql2ToSql(body.filter) : null;
    const collections = body.collections ?? [];
    const ids = body.ids ?? [];

    // 토큰은 이 조건들로 만든 해시를 품는다. 조건이 바뀐 요청에 옛 토큰을 쓰면 400.
    const hash = conditionHash({
      aoi,
      datetime: body.datetime ?? null,
      collections,
      ids,
      filter: body.filter ?? null,
      sort,
    });

    let after: (string | number)[] | null = null;
    if (body.token) {
      const token = decodeToken(body.token);
      if (!token || token.h !== hash || token.k.length !== sort.length) {
        throw new BadRequestException(
          'token: 이 검색 조건의 토큰이 아니거나 깨짐',
        );
      }
      after = token.k;
    }

    const limit = body.limit ?? DEFAULT_LIMIT;
    const { rows, matched, hasMore } = await this.catalog.search({
      aoi,
      datetime,
      collections,
      ids,
      predicate,
      sort,
      after,
      limit,
    });

    const searchHref = href(this.base, `${STAC_PATH}/search`);
    const links: StacLink[] = [
      { rel: 'self', href: searchHref, type: GEOJSON },
      rootLink(this.base),
    ];
    if (hasMore) {
      const token = encodeToken({
        k: rows[rows.length - 1].sortValues,
        h: hash,
      });
      links.push(nextLink(origin, searchHref, token));
    }

    return {
      type: 'FeatureCollection',
      stac_version: '1.0.0',
      features: rows.map((r) => toStacItem(r, this.base)),
      numberMatched: matched,
      numberReturned: rows.length,
      links,
    };
  }
}

// POST는 원래 본문 전체 + token을 body에(merge: false), GET은 쿼리 문자열에 token을 붙인 href.
function nextLink(
  origin: SearchOrigin,
  searchHref: string,
  token: string,
): StacLink {
  if (origin.method === 'POST') {
    return {
      rel: 'next',
      href: searchHref,
      type: GEOJSON,
      method: 'POST',
      merge: false,
      body: { ...origin.body, token },
    };
  }

  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(origin.query)) {
    if (k !== 'token' && typeof v === 'string') params.set(k, v);
  }
  params.set('token', token);

  return {
    rel: 'next',
    href: `${searchHref}?${params.toString()}`,
    type: GEOJSON,
  };
}
