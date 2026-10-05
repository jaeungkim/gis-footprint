import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { toKstDay } from "@/lib/date";

interface Collection {
  id: string;
  summaries?: { platform?: string[] };
  extent?: { temporal?: { interval?: (string | null)[][] } };
}

// 컬렉션 id → 위성 목록(summaries.platform), 카탈로그 전체 촬영 기간(한국 시간 날짜)
export function useCollections() {
  return useQuery({
    queryKey: ["stac-collections"],
    staleTime: Infinity,
    queryFn: async () => {
      const { data, response } = await api.GET("/api/stac/collections");
      if (!response.ok)
        throw new Error(`컬렉션 조회 실패 (${response.status})`);

      const { collections } = data as unknown as { collections: Collection[] };
      const intervals = collections.map(
        (c) => c.extent?.temporal?.interval?.[0] ?? [],
      );
      // ISO(Z) 문자열은 사전순이 곧 시간순
      const starts = intervals.flatMap(([s]) => s ?? []).sort();
      const ends = intervals.flatMap(([, e]) => e ?? []).sort();

      return {
        platforms: Object.fromEntries(
          collections.map((c) => [c.id, c.summaries?.platform ?? []]),
        ) as Record<string, string[]>,
        from: starts.length > 0 ? toKstDay(starts[0]) : null,
        to: ends.length > 0 ? toKstDay(ends.at(-1)!) : null,
      };
    },
  });
}
