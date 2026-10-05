import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { polygonGeometrySchema } from "@/lib/geo";
import type { Aoi } from "./types";

const aoiFileSchema = z.object({
  features: z.array(
    z.object({
      id: z.string(),
      properties: z.object({ name: z.string() }),
      geometry: polygonGeometrySchema,
    }),
  ),
});

// 저장소에 있는 샘플 AOI. 서버 컴포넌트에서 빌드 때 한 번 읽는다. 파일이 틀리면 빌드가 실패한다.
export async function loadSampleAois(): Promise<Aoi[]> {
  const file = path.join(process.cwd(), "../../data/aois.geojson");
  const { features } = aoiFileSchema.parse(
    JSON.parse(await readFile(file, "utf8")),
  );

  return features.map((f) => ({
    id: f.id,
    name: f.properties.name,
    geometry: f.geometry,
  }));
}
