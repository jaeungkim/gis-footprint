import { range } from "es-toolkit";
import {
  createParser,
  parseAsArrayOf,
  parseAsNumberLiteral,
  parseAsString,
  parseAsStringLiteral,
  type inferParserType,
} from "nuqs";
import { z } from "zod";
import { CLOUD_STEP, GSD_OPTIONS, SENSORS, SORT_PRESETS } from "./constants";

// KST 날짜 YYYY-MM-DD 문자열 그대로 둔다. 형식이 틀리거나 없는 날짜(02-30)는 조건 없음으로 읽는다.
const parseAsDay = createParser({
  parse: (v) => z.iso.date().safeParse(v).data ?? null,
  serialize: (v: string) => v,
});

// 검색 조건은 전부 URL에 둔다. 새로고침이나 링크 공유로 같은 결과가 나온다.
// 고를 수 없는 값(cloud=33, gsd=15 등)은 조건 없음이나 기본값으로 읽는다.
export const searchParamsParsers = {
  aoi: parseAsString,
  from: parseAsDay,
  to: parseAsDay,
  sensors: parseAsArrayOf(parseAsStringLiteral(SENSORS)).withDefault([
    ...SENSORS,
  ]),
  // 100이면 조건 없음
  cloud: parseAsNumberLiteral(range(0, 101, CLOUD_STEP)).withDefault(100),
  platforms: parseAsArrayOf(parseAsString).withDefault([]),
  gsd: parseAsNumberLiteral(GSD_OPTIONS),
  sort: parseAsStringLiteral(SORT_PRESETS).withDefault("latest"),
};

export type SearchConditions = inferParserType<typeof searchParamsParsers>;
