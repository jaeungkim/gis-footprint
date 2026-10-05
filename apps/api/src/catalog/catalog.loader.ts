import { readFile } from 'node:fs/promises';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { dataFile } from '../config/data-file.js';
import { CatalogRepository } from './catalog.repository.js';
import { type StacItem, toScene } from './stac-item/to-scene.js';

const CATALOG_FILE = dataFile('catalog/items.json');

// 서버가 요청을 받기 전에 items.json을 DB에 넣는다.
@Injectable()
export class CatalogLoader implements OnModuleInit {
  private readonly logger = new Logger(CatalogLoader.name);

  constructor(private readonly catalog: CatalogRepository) {}

  async onModuleInit() {
    const { features } = JSON.parse(await readFile(CATALOG_FILE, 'utf8')) as {
      features: StacItem[];
    };

    await this.catalog.saveAll(features.map(toScene));
    this.logger.log(`카탈로그 적재 ${features.length}건`);
  }
}
