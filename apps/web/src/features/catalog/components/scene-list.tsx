"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import type { useSceneSearch } from "../hooks/use-scene-search";
import type { BlockReason, StacItem } from "../types";
import { SceneCard } from "./scene-card";

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
            <SceneCard key={scene.id} scene={scene} hasAoi={hasAoi} />
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
