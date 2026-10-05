import {
  createParser,
  parseAsArrayOf,
  parseAsFloat,
  parseAsInteger,
  parseAsString,
  parseAsStringLiteral,
  useQueryStates,
} from "nuqs";

// YYYY-MM-DD 문자열 그대로 둔다. 형식이 틀린 값은 조건 없음으로 읽는다.
const parseAsDay = createParser({
  parse: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null),
  serialize: (v: string) => v,
});

// 검색 조건은 전부 URL에 둔다. 새로고침이나 링크 공유로 같은 결과가 나온다.
export const searchParamsParsers = {
  aoi: parseAsString,
  from: parseAsDay,
  to: parseAsDay,

  sensors: parseAsArrayOf(
    parseAsStringLiteral(["eo", "sar"] as const),
  ).withDefault(["eo", "sar"]),

  cloud: parseAsInteger.withDefault(100),
  platforms: parseAsArrayOf(parseAsString).withDefault([]),
  gsd: parseAsFloat,

  sort: parseAsStringLiteral([
    "latest",
    "coverage",
    "cloud",
  ] as const).withDefault("latest"),
};

export const useSearchConditions = () => useQueryStates(searchParamsParsers);
