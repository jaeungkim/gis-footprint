import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PolygonGeometry } from "@/lib/geo";
import type { Aoi } from "../types";

// 저장소에 있는 샘플 AOI. 서버 컴포넌트에서 빌드 때 한 번 읽는다.
export async function loadSampleAois(): Promise<Aoi[]> {
  const file = path.join(process.cwd(), "../../data/aois.geojson");

  const fc = JSON.parse(await readFile(file, "utf8")) as {
    features: {
      id: string;
      properties: { name: string };
      geometry: PolygonGeometry;
    }[];
  };

  return fc.features.map((f) => ({
    id: f.id,
    name: f.properties.name,
    geometry: f.geometry,
  }));
}
