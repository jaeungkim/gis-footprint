"use client";

import { useMemo } from "react";
import { BaseMap } from "@/features/map/components/base-map";
import { toDateString, useSearchConditions } from "../search-params";
import { toSearchBody, type AoiGeometry } from "../stac-search";
import { useSceneSearch } from "../use-scene-search";
import { SceneFilterPanel } from "./scene-filter-panel";
import { SceneList } from "./scene-list";

export interface Aoi {
  id: string;
  name: string;
  geometry: AoiGeometry;
}

export function Explore({ aois }: { aois: Aoi[] }) {
  const [params] = useSearchConditions();
  const aoi = aois.find((a) => a.id === params.aoi) ?? null;

  const result = useMemo(
    () =>
      toSearchBody(
        {
          from: toDateString(params.from),
          to: toDateString(params.to),
          sensors: params.sensors,
          cloud: params.cloud,
          platforms: params.platforms,
          gsd: params.gsd,
          sort: params.sort,
        },
        aoi?.geometry ?? null,
      ),
    [params, aoi],
  );
  const search = useSceneSearch(result.ok ? result.body : null);
  const scenes = useMemo(
    () => search.data?.pages.flatMap((p) => p.features) ?? [],
    [search.data],
  );

  return (
    <div className="grid h-full grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-cols-[380px_1fr] md:grid-rows-1">
      <aside className="flex min-h-0 flex-col border-b md:border-r md:border-b-0">
        <SceneFilterPanel
          aois={aois}
          blocked={result.ok ? null : result.reason}
        />
        <SceneList
          search={search}
          scenes={scenes}
          blocked={result.ok ? null : result.reason}
          hasAoi={aoi !== null}
        />
      </aside>
      <BaseMap aoi={aoi?.geometry ?? null} scenes={scenes} />
    </div>
  );
}
