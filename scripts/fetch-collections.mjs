// Pulls the two Earth Search Collection records the catalog uses and writes them to
// data/catalog/collections.json. Metadata only. The api serves these (with extent and
// summaries recomputed from the database) at /api/stac/collections.
//
//   node scripts/fetch-collections.mjs
import { writeFile } from 'node:fs/promises';

const ROOT = 'https://earth-search.aws.element84.com/v1/collections';
const collections = [];
for (const id of ['sentinel-2-l2a', 'sentinel-1-grd']) {
  const res = await fetch(`${ROOT}/${id}`);
  if (!res.ok) throw new Error(`${id}: ${res.status} ${await res.text()}`);
  collections.push(await res.json());
}
await writeFile('data/catalog/collections.json', JSON.stringify({ collections }, null, 2) + '\n');
console.log(`data/catalog/collections.json: ${collections.map((c) => c.id).join(', ')}`);
