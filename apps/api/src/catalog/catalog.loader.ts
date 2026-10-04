import { readFile } from 'node:fs/promises';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { dataFile } from '../config/data-file.js';
import { CatalogRepository } from './catalog.repository.js';
import { loadCatalog } from './load-catalog.js';

const CATALOG_FILE = dataFile('catalog/items.json');

// 서버가 요청을 받기 전에 카탈로그를 채운다. 불량 Item은 빼고 로그만 남긴다.
// 파일 자체가 없거나 FeatureCollection이 아니면 그건 설정 문제라 그대로 실패시킨다.
@Injectable()
export class CatalogLoader implements OnModuleInit {
  private readonly logger = new Logger(CatalogLoader.name);

  constructor(private readonly catalog: CatalogRepository) {}

  async onModuleInit() {
    const json: unknown = JSON.parse(await readFile(CATALOG_FILE, 'utf8'));
    if (!isFeatureCollection(json)) {
      throw new Error(`${CATALOG_FILE.pathname}: FeatureCollection이 아님`);
    }

    const { scenes, rejected, duplicateIds, total } = loadCatalog(
      json.features,
    );
    for (const { id, reason, detail } of rejected) {
      this.logger.warn(`제외 ${id ?? '(id 없음)'} ${reason}: ${detail}`);
    }
    for (const id of duplicateIds) {
      this.logger.warn(`중복 ${id}: updated가 늦은 쪽을 남김`);
    }
    // DB가 거른 것(구멍 위치, 폴리곤 겹침)도 같은 형식으로 남긴다.
    const dbRejected = (await this.catalog.saveAll(scenes)).rejected;
    for (const { id, reason } of dbRejected) {
      this.logger.warn(`제외 ${id} INVALID_GEOMETRY: ${reason}`);
    }
    const excluded = rejected.length + dbRejected.length;
    this.logger.log(
      `카탈로그 적재 ${scenes.length - dbRejected.length}건 / 전체 ${total}건 (제외 ${excluded}, 중복 ${duplicateIds.length})`,
    );
  }
}

function isFeatureCollection(
  json: unknown,
): json is { type: 'FeatureCollection'; features: unknown[] } {
  return (
    typeof json === 'object' &&
    json !== null &&
    'type' in json &&
    json.type === 'FeatureCollection' &&
    'features' in json &&
    Array.isArray(json.features)
  );
}
