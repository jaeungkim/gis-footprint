import { readFile } from 'node:fs/promises';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { dataFile } from '../config/data-file.js';
import { CatalogRepository } from './catalog.repository.js';
import { type StacItem, toScene } from './stac-item.js';

const CATALOG_FILE = dataFile('catalog/items.json');

@Injectable()
export class CatalogLoader implements OnModuleInit {
  private readonly logger = new Logger(CatalogLoader.name);

  constructor(private readonly catalog: CatalogRepository) {}

  // 애플리케이션 부팅 시 카탈로그를 적재한다.
  async onModuleInit() {
    const { features } = JSON.parse(await readFile(CATALOG_FILE, 'utf8')) as {
      features: StacItem[];
    };

    await this.catalog.saveAll(features.map(toScene));
    this.logger.log(`카탈로그 적재 ${features.length}건`);
  }
}
