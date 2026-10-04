import { readFile } from "node:fs/promises";
import path from "node:path";
import { Suspense } from "react";
import { Explore } from "@/features/catalog/components/explore";
import type { Aoi, AoiGeometry } from "@/features/catalog/stac-search";

// 저장소에 있는 샘플 AOI. 빌드 때 한 번 읽는다.
async function loadSampleAois(): Promise<Aoi[]> {
  const file = path.join(process.cwd(), "../../data/aois.geojson");
  const fc = JSON.parse(await readFile(file, "utf8")) as {
    features: {
      id: string;
      properties: { name: string };
      geometry: AoiGeometry;
    }[];
  };
  return fc.features.map((f) => ({
    id: f.id,
    name: f.properties.name,
    geometry: f.geometry,
  }));
}

export default async function ExplorePage() {
  const aois = await loadSampleAois();
  return (
    // nuqs(useSearchParams)는 Suspense 경계가 있어야 정적 렌더가 된다
    <Suspense>
      <Explore aois={aois} />
    </Suspense>
  );
}
