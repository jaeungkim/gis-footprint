import { skipToken, useInfiniteQuery } from "@tanstack/react-query";
import { z } from "zod";
import { api } from "@/lib/api";
import { itemCollectionSchema, type SearchBody } from "../_lib/types";

const problemSchema = z
  .object({ title: z.string(), detail: z.string() })
  .partial();

async function searchPage(
  body: SearchBody,
  token: string | undefined,
  signal: AbortSignal,
) {
  const { data, error, response } = await api.POST("/api/stac/search", {
    body: { ...body, token },
    signal,
  });

  if (!response.ok) {
    const p = problemSchema.safeParse(error).data;
    throw Object.assign(
      new Error(p?.detail ?? p?.title ?? `검색 실패 (${response.status})`),
      { status: response.status },
    );
  }

  const parsed = itemCollectionSchema.safeParse(data);
  if (!parsed.success)
    throw new Error("검색 결과 형식이 달라요", { cause: parsed.error });

  return parsed.data;
}

// 조건이 막혀 body가 null이면 요청하지 않는다
export function useSceneSearch(body: SearchBody | null) {
  return useInfiniteQuery({
    queryKey: ["stac-search", body],
    queryFn: body
      ? ({ pageParam, signal }) => searchPage(body, pageParam, signal)
      : skipToken,
    initialPageParam: undefined as string | undefined,
    // 5xx와 네트워크 오류(fetch의 TypeError)만 재시도. 4xx와 형식이 틀린 응답은 다시 받아도 같다.
    retry: (count, err) =>
      count < 3 &&
      (err instanceof TypeError ||
        ((err as { status?: number }).status ?? 0) >= 500),
    // next.href는 3001 origin이라 안 따라가고 토큰만 쓴다
    getNextPageParam: (last) =>
      last.links.find((l) => l.rel === "next")?.body?.token,
  });
}
