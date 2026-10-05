"use client";

import { Delay } from "@suspensive/react";
import { range } from "es-toolkit";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import type { useSceneSearch } from "../_hooks/use-scene-search";
import { formatNumber } from "../_lib/format";
import type { BlockReason, StacItem } from "../_lib/types";
import { SceneCard } from "./scene-card";

export function SceneList({
  search,
  scenes,
  blocked,
  hasAoi,
  scrollRef,
}: {
  search: ReturnType<typeof useSceneSearch>;
  scenes: StacItem[];
  blocked: BlockReason | null;
  hasAoi: boolean;
  scrollRef: React.RefObject<HTMLElement | null>;
}) {
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
      { root: scrollRef.current, rootMargin: "200px" },
    );

    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, scrollRef]);

  let body: React.ReactNode;
  if (blocked) {
    body = <Message>조건을 고치면 검색해요.</Message>;
  } else if (search.isPending) {
    body = <Loading />;
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
        {isFetchingNextPage && <Loading rows={2} />}
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
  let title = "결과";
  if (!blocked && matched !== undefined) {
    title = `결과 ${formatNumber(matched)}건`;
    // 지도에는 불러온 페이지만 그려진다
    if (scenes.length < matched)
      title += ` · 지도에 ${formatNumber(scenes.length)}건 표시`;
  }

  return (
    <section aria-label="검색 결과" className="p-4">
      <h2 className="mb-3 text-sm text-muted-foreground">{title}</h2>
      {body}
    </section>
  );
}

function Message({ children }: { children: React.ReactNode }) {
  return (
    <Empty className="gap-3 p-0 py-8">
      <EmptyDescription className="flex flex-col items-center gap-3">
        {children}
      </EmptyDescription>
    </Empty>
  );
}

// 로컬 API는 수십 ms라 바로 띄우면 깜빡인다. 200ms 넘게 걸릴 때만 보인다.
function Loading({ rows = 4 }: { rows?: number }) {
  return (
    <Delay ms={200}>
      <ul
        aria-busy="true"
        aria-label="불러오는 중"
        className="mt-2 flex flex-col gap-2"
      >
        {range(rows).map((i) => (
          <li key={i}>
            <Skeleton className="h-[82px] rounded-lg" />
          </li>
        ))}
      </ul>
    </Delay>
  );
}
