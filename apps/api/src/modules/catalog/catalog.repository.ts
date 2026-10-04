import { Injectable } from '@nestjs/common';
import type { Scene } from './scene.js';

// 저장소를 갈아 끼우는 자리. 6단계에서 Postgres, 16단계에서 PostGIS 구현으로 바꾼다.
// abstract class라서 Nest DI 토큰으로도 쓴다.
export abstract class CatalogRepository {
  abstract saveAll(scenes: Scene[]): Promise<void>;
  abstract findById(id: string): Promise<Scene | null>;
}

@Injectable()
export class InMemoryCatalogRepository extends CatalogRepository {
  private readonly scenes = new Map<string, Scene>();

  saveAll(scenes: Scene[]): Promise<void> {
    for (const scene of scenes) this.scenes.set(scene.id, scene);
    return Promise.resolve();
  }

  findById(id: string): Promise<Scene | null> {
    return Promise.resolve(this.scenes.get(id) ?? null);
  }
}
