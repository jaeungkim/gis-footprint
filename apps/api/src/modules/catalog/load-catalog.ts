import type { Scene } from './scene.js';
import { toScene, type ToSceneResult } from './stac/to-scene.js';

export type Rejected = Extract<ToSceneResult, { ok: false }>;

export interface LoadResult {
  scenes: Scene[];
  rejected: Rejected[];
  duplicateIds: string[];
  total: number;
}

// 같은 id가 또 나오면 properties.updated가 늦은 쪽을 남긴다. 같으면 먼저 나온 쪽.
export function loadCatalog(items: unknown[]): LoadResult {
  const byId = new Map<string, Scene>();
  const rejected: Rejected[] = [];
  const duplicateIds: string[] = [];

  for (const item of items) {
    const result = toScene(item);
    if (!result.ok) {
      rejected.push(result);
      continue;
    }
    const { scene } = result;
    const existing = byId.get(scene.id);
    if (existing) {
      duplicateIds.push(scene.id);
      if (time(existing.updatedAt) >= time(scene.updatedAt)) continue;
    }
    byId.set(scene.id, scene);
  }

  return {
    scenes: [...byId.values()],
    rejected,
    duplicateIds,
    total: items.length,
  };
}

function time(date: Date | null): number {
  return date?.getTime() ?? -Infinity;
}
