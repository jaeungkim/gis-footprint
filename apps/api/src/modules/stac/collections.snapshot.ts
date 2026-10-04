import { readFile } from 'node:fs/promises';
import { Injectable, OnModuleInit } from '@nestjs/common';

// src/와 dist/ 둘 다 apps/api 아래 같은 깊이라 어느 쪽에서 돌아도 리포 루트의 data/를 가리킨다.
export const COLLECTIONS_FILE = new URL(
  '../../../../../data/catalog/collections.json',
  import.meta.url,
);

export type StacCollection = { id: string } & Record<string, unknown>;

// Earth Search Collection 스냅샷. title, description, license, item_assets 등을 손으로 쓰지 않는다.
// extent와 summaries의 platform/gsd는 응답할 때 DB 집계로 덮는다.
@Injectable()
export class CollectionsSnapshot implements OnModuleInit {
  private collections: StacCollection[] = [];

  async onModuleInit() {
    const json: unknown = JSON.parse(await readFile(COLLECTIONS_FILE, 'utf8'));
    const list =
      typeof json === 'object' && json !== null && 'collections' in json
        ? json.collections
        : null;
    if (!Array.isArray(list) || list.length === 0 || !list.every(isCollection)) {
      throw new Error(`${COLLECTIONS_FILE.pathname}: Collection 배열이 아님`);
    }
    this.collections = list;
  }

  all(): StacCollection[] {
    return this.collections;
  }

  ids(): string[] {
    return this.collections.map((c) => c.id);
  }

  get(id: string): StacCollection | null {
    return this.collections.find((c) => c.id === id) ?? null;
  }
}

function isCollection(x: unknown): x is StacCollection {
  return (
    typeof x === 'object' &&
    x !== null &&
    'id' in x &&
    typeof x.id === 'string' &&
    'type' in x &&
    x.type === 'Collection'
  );
}
