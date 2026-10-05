import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiNotFoundResponse, ApiTags } from '@nestjs/swagger';
import type { Env } from '../config/env.js';
import { CatalogRepository } from '../catalog/catalog.repository.js';
import type { CollectionStat } from '../catalog/interfaces/scene-query.interface.js';
import { CollectionsSnapshot } from './collections.snapshot.js';
import type { StacCollection } from './interfaces/stac.interface.js';
import {
  collectionHref,
  href,
  JSON_TYPE,
  rootLink,
  STAC_PATH,
} from './links.js';

@ApiTags('stac')
@Controller('stac/collections')
export class CollectionsController {
  private readonly base: string;

  constructor(
    config: ConfigService<Env, true>,
    private readonly snapshot: CollectionsSnapshot,
    private readonly catalog: CatalogRepository,
  ) {
    this.base = config.get('STAC_PUBLIC_URL', { infer: true });
  }

  @Get()
  async list() {
    const stats = await this.catalog.collectionStats();

    // DB에 scene이 하나도 없는 컬렉션은 extent를 못 만들어서 뺀다.
    const collections = this.snapshot.all().flatMap((c) => {
      const stat = stats.find((s) => s.collection === c.id);
      return stat ? [this.render(c, stat)] : [];
    });

    return {
      collections,
      links: [
        {
          rel: 'self',
          href: href(this.base, `${STAC_PATH}/collections`),
          type: JSON_TYPE,
        },
        rootLink(this.base),
      ],
    };
  }

  @Get(':id')
  @ApiNotFoundResponse()
  async one(@Param('id') id: string) {
    const collection = this.snapshot.get(id);
    const stat = (await this.catalog.collectionStats()).find(
      (s) => s.collection === id,
    );

    if (!collection || !stat)
      throw new NotFoundException(`collection ${id} 없음`);

    return this.render(collection, stat);
  }

  private render(c: StacCollection, stat: CollectionStat) {
    const summaries =
      (c.summaries as Record<string, unknown> | undefined) ?? {};

    return {
      ...c,
      extent: {
        spatial: { bbox: [stat.bbox] },
        temporal: {
          interval: [[stat.from.toISOString(), stat.to.toISOString()]],
        },
      },
      summaries: { ...summaries, platform: stat.platforms, gsd: stat.gsds },
      links: [
        { rel: 'self', href: collectionHref(this.base, c.id), type: JSON_TYPE },
        rootLink(this.base),
        { rel: 'parent', href: href(this.base, STAC_PATH), type: JSON_TYPE },
      ],
    };
  }
}
