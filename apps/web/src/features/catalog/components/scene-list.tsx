"use client";

import { cn } from "cn";
import { ImageOff, Radar } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { useSelection } from "../selection-store";
import {
  COLLECTION_BY_SENSOR,
  platformLabel,
  type BlockReason,
  type StacItem,
} from "../stac-search";
import type { useSceneSearch } from "../use-scene-search";

const kst = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  dateStyle: "medium",
  timeStyle: "short",
});

export function SceneList({
  search,
  scenes,
  blocked,
  hasAoi,
}: {
  search: ReturnType<typeof useSceneSearch>;
  scenes: StacItem[];
  blocked: BlockReason | null;
  hasAoi: boolean;
}) {
  const rootRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = search;

  // 목록 끝이 보이면 다음 페이지
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { root: rootRef.current, rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  let body: React.ReactNode;
  if (blocked) {
    body = <Message>조건을 고치면 검색해요.</Message>;
  } else if (search.isPending) {
    body = <Skeleton />;
  } else if (search.isError && scenes.length === 0) {
    body = (
      <Message>
        <span className="text-destructive">{search.error.message}</span>
        <Button variant="outline" size="sm" onClick={() => search.refetch()}>
          다시 시도
        </Button>
      </Message>
    );
  } else if (scenes.length === 0) {
    body = <Message>조건에 맞는 영상이 없어요.</Message>;
  } else {
    body = (
      <>
        <ul className="flex flex-col gap-2">
          {scenes.map((scene) => (
            <SceneItem key={scene.id} scene={scene} hasAoi={hasAoi} />
          ))}
        </ul>
        <div ref={sentinelRef} />
        {isFetchingNextPage && <Skeleton rows={2} />}
        {search.isFetchNextPageError && (
          <Message>
            <span className="text-destructive">{search.error?.message}</span>
            <Button variant="outline" size="sm" onClick={() => fetchNextPage()}>
              다시 시도
            </Button>
          </Message>
        )}
      </>
    );
  }

  const matched = search.data?.pages[0]?.numberMatched;
  return (
    <section
      ref={rootRef}
      aria-label="검색 결과"
      className="min-h-0 flex-1 overflow-y-auto p-4"
    >
      <h2 className="mb-3 text-sm text-muted-foreground">
        {blocked || matched === undefined ? "결과" : `결과 ${matched}건`}
      </h2>
      {body}
    </section>
  );
}

function SceneItem({ scene, hasAoi }: { scene: StacItem; hasAoi: boolean }) {
  const ref = useRef<HTMLLIElement>(null);
  const hovered = useSelection((s) => s.hoveredId === scene.id);
  const selected = useSelection((s) => s.selectedId === scene.id);
  const fromMap = useSelection((s) => s.selectedFrom === "map");
  const { hover, select } = useSelection.getState();

  useEffect(() => {
    if (selected && fromMap)
      ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected, fromMap]);

  const p = scene.properties;
  const isSar = scene.collection === COLLECTION_BY_SENSOR.sar;
  const thumb = scene.assets.thumbnail?.href;

  return (
    <li ref={ref}>
      <button
        type="button"
        aria-pressed={selected}
        onMouseEnter={() => hover(scene.id)}
        onMouseLeave={() => hover(null)}
        onFocus={() => hover(scene.id)}
        onBlur={() => hover(null)}
        onClick={() => select(selected ? null : scene.id, "list")}
        className={cn(
          "flex w-full gap-3 rounded-lg border p-2 text-left text-sm transition-colors",
          hovered && "bg-muted",
          selected && "border-primary ring-1 ring-primary",
        )}
      >
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">
          {thumb?.startsWith("https://") ? (
            // 외부 썸네일이라 next/image 최적화가 필요 없다
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : isSar ? (
            <Radar aria-hidden className="size-6" />
          ) : (
            <ImageOff aria-hidden className="size-6" />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">
            {platformLabel(p.platform)}{" "}
            <span className="font-normal text-muted-foreground">
              {isSar ? "SAR" : "EO"}
            </span>
          </span>
          <time dateTime={p.datetime} className="text-muted-foreground">
            {kst.format(new Date(p.datetime))}
          </time>
          <span className="text-muted-foreground">
            {isSar
              ? "운량 해당 없음"
              : p["eo:cloud_cover"] == null
                ? "운량 정보 없음"
                : `운량 ${p["eo:cloud_cover"].toFixed(1)}%`}
            {hasAoi && p["aoi:coverage_pct"] !== undefined && (
              <>
                {" · "}커버리지 {p["aoi:coverage_pct"].toFixed(1)}% (
                {p["aoi:coverage_km2"]?.toFixed(2)} km²)
              </>
            )}
          </span>
        </div>
      </button>
    </li>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <ul
      aria-busy="true"
      aria-label="불러오는 중"
      className="mt-2 flex flex-col gap-2"
    >
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="h-[82px] animate-pulse rounded-lg bg-muted" />
      ))}
    </ul>
  );
}
