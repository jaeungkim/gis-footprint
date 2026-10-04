import { readFile } from 'node:fs/promises';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../generated/prisma/client.js';
import type { PrismaService } from '../../prisma.service.js';
import { CATALOG_FILE } from './catalog.loader.js';
import { PostgisCatalogRepository } from './catalog.repository.js';
import { loadCatalog } from './load-catalog.js';
import type { Scene } from './scene.js';

// *.dbtest.ts 공용. `pnpm test:db`가 DATABASE_URL을 app_test로 준다. 개발 DB(app)는 건드리지 않는다.
export function openTestDb() {
  const url = process.env.DATABASE_URL ?? '';
  if (!url.endsWith('/app_test')) {
    throw new Error('DATABASE_URL이 app_test를 가리켜야 한다 (pnpm test:db)');
  }
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  });
  // 리포지토리는 $queryRaw/$executeRaw만 쓰므로 PrismaClient로 충분하다.
  const repo = new PostgisCatalogRepository(prisma as unknown as PrismaService);
  return { prisma, repo, close: () => prisma.$disconnect() };
}

export async function fixtureScenes(): Promise<Scene[]> {
  const json = JSON.parse(await readFile(CATALOG_FILE, 'utf8')) as {
    features: unknown[];
  };
  return loadCatalog(json.features).scenes;
}

export const AOIS_FILE = new URL(
  '../../../../../data/aois.geojson',
  import.meta.url,
);
