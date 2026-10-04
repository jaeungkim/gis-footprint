import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

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
