"use client";

import { useMemo, useRef } from "react";
import { useSceneSearch } from "../_hooks/use-scene-search";
import { useSearchConditions } from "../_hooks/use-search-conditions";
import { toSearchBody } from "../_lib/search-body";
import type { Aoi } from "../_lib/types";
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

  // 필터와 목록이 같이 스크롤된다. 필터 머리줄만 위에 붙어 있다.
  const scrollRef = useRef<HTMLElement>(null);

  return (
    <div className="grid h-full grid-rows-[40dvh_minmax(0,1fr)] md:grid-cols-[380px_1fr] md:grid-rows-1">
      <aside
        ref={scrollRef}
        className="min-h-0 overflow-y-auto border-t md:border-t-0 md:border-r"
      >
        <SceneFilterPanel aois={aois} blocked={blocked} />
        <SceneList
          search={search}
          scenes={scenes}
          blocked={blocked}
          hasAoi={aoi !== null}
          scrollRef={scrollRef}
        />
      </aside>
      {/* 모바일은 지도가 위, 목록이 아래 */}
      <div className="relative min-h-0 max-md:order-first">
        <SceneMap aoi={aoi?.geometry ?? null} scenes={scenes} />
      </div>
    </div>
  );
}
