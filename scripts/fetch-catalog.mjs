// Pulls Sentinel-1 GRD and Sentinel-2 L2A STAC Items over South Korea from Earth Search
// and writes them as ItemCollections under data/. Metadata only: nothing here downloads imagery.
//
//   node scripts/fetch-catalog.mjs
//
// data/catalog/items.json  July-August: the catalog the api loads at startup (step 1)
// data/stac/items.json     September: "new" Items that only mock/stac-api serves (step 6 ingest)
import { mkdir, writeFile } from 'node:fs/promises';

const API = 'https://earth-search.aws.element84.com/v1/search';
const BBOX = [125.0, 33.0, 129.6, 38.6];
const COLLECTIONS = ['sentinel-2-l2a', 'sentinel-1-grd'];

async function search(datetime) {
  const items = [];
  let body = { collections: COLLECTIONS, bbox: BBOX, datetime, limit: 200 };
  while (body) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
    const page = await res.json();
    items.push(...page.features.map(slim));
    body = page.links.find((l) => l.rel === 'next')?.body ?? null;
    process.stdout.write(`\r${datetime}: ${items.length}`);
  }
  process.stdout.write('\n');
  return items.sort((a, b) => a.properties.datetime.localeCompare(b.properties.datetime));
}

// Drop the JPEG2000 duplicates of every S2 band to keep the snapshot small. Everything else stays as served.
function slim(item) {
  const assets = Object.fromEntries(Object.entries(item.assets).filter(([k]) => !k.endsWith('-jp2')));
  return { ...item, assets };
}

async function save(path, features) {
  await mkdir(path.slice(0, path.lastIndexOf('/')), { recursive: true });
  await writeFile(path, JSON.stringify({ type: 'FeatureCollection', features }) + '\n');
  console.log(`${path}: ${features.length} items`);
}

await save('data/catalog/items.json', await search('2026-07-01T00:00:00+09:00/2026-08-31T23:59:59+09:00'));
await save('data/stac/items.json', await search('2026-09-01T00:00:00+09:00/2026-09-30T23:59:59+09:00'));
