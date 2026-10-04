import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { ItemCollection, SearchBody } from "./stac-search";

type Problem = { title?: string; detail?: string };

export function useSceneSearch(body: SearchBody | null) {
  return useInfiniteQuery({
    queryKey: ["stac-search", body],
    enabled: body !== null,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam, signal }) => {
      const { data, error, response } = await api.POST("/api/stac/search", {
        body: { ...body!, token: pageParam },
        signal,
      });
      if (!response.ok) {
        const p = error as Problem | undefined;
        throw new Error(p?.detail ?? p?.title ?? `검색 실패 (${response.status})`);
      }
      return data as unknown as ItemCollection;
    },
    // next.href는 3001 origin이라 안 따라가고 토큰만 쓴다
    getNextPageParam: (last) =>
      last.links.find((l) => l.rel === "next")?.body?.token,
  });
}

// 컬렉션 id → 위성 목록 (summaries.platform)
export function usePlatforms() {
  return useQuery({
    queryKey: ["stac-collections"],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, response } = await api.GET("/api/stac/collections");
      if (!response.ok)
        throw new Error(`컬렉션 조회 실패 (${response.status})`);
      const { collections } = data as unknown as {
        collections: { id: string; summaries?: { platform?: string[] } }[];
      };
      return Object.fromEntries(
        collections.map((c) => [c.id, c.summaries?.platform ?? []]),
      );
    },
  });
}
