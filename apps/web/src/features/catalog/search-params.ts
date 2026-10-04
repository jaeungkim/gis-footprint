import {
  parseAsArrayOf,
  parseAsFloat,
  parseAsInteger,
  parseAsIsoDate,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

// 검색 조건은 전부 URL에 둔다. 새로고침이나 링크 공유로 같은 결과가 나온다.
export const searchParamsParsers = {
  aoi: parseAsString,
  from: parseAsIsoDate,
  to: parseAsIsoDate,
  sensors: parseAsArrayOf(
    parseAsStringLiteral(["eo", "sar"] as const),
  ).withDefault(["eo", "sar"]),
  cloud: parseAsInteger.withDefault(100),
  platforms: parseAsArrayOf(parseAsString).withDefault([]),
  gsd: parseAsFloat,
  sort: parseAsStringLiteral(["latest", "coverage", "cloud"] as const).withDefault(
    "latest",
  ),
};

export const useSearchConditions = () => useQueryStates(searchParamsParsers);

// parseAsIsoDate는 YYYY-MM-DD를 UTC 자정 Date로 읽는다. 다시 날짜 문자열로.
export const toDateString = (d: Date | null) =>
  d ? d.toISOString().slice(0, 10) : null;
