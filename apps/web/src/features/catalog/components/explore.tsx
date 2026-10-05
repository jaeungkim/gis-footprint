"use client";

import { useMemo } from "react";
import { useSceneSearch } from "../hooks/use-scene-search";
import { useSearchConditions } from "../hooks/use-search-conditions";
import { toSearchBody } from "../lib/search-body";
import type { Aoi } from "../types";
import { SceneFilterPanel } from "./scene-filter-panel";
import { SceneList } from "./scene-list";
import { SceneMap } from "./scene-map";

export function Explore({ aois }: { aois: Aoi[] }) {
  const [params] = useSearchConditions();
  const aoi = aois.find((a) => a.id === params.aoi) ?? null;

  const result = useMemo(
    () => toSearchBody(params, aoi?.geometry ?? null),
    [params, aoi],
  );

  const blocked = result.ok ? null : result.reason;
  const search = useSceneSearch(result.ok ? result.body : null);

  const scenes = useMemo(
    () => search.data?.pages.flatMap((p) => p.features) ?? [],
    [search.data],
  );

  return (
    <div className="grid h-full grid-rows-[minmax(0,1fr)_minmax(0,1fr)] md:grid-cols-[380px_1fr] md:grid-rows-1">
      <aside className="flex min-h-0 flex-col border-b md:border-r md:border-b-0">
        <SceneFilterPanel aois={aois} blocked={blocked} />
        <SceneList
          search={search}
          scenes={scenes}
          blocked={blocked}
          hasAoi={aoi !== null}
        />
      </aside>
      <SceneMap aoi={aoi?.geometry ?? null} scenes={scenes} />
    </div>
  );
}
