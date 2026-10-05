import type { Sensor } from "./types";

// sentinel-2a → Sentinel-2A
export const platformLabel = (p: string) =>
  p.replace(
    /^sentinel-(\d)(\w)$/,
    (_, n, l) => `Sentinel-${n}${l.toUpperCase()}`,
  );

export const SENSOR_INFO: Record<
  Sensor,
  { label: string; short: string; desc: string; family: string }
> = {
  eo: {
    label: "광학 사진",
    short: "EO",
    desc: "눈으로 보는 컬러 사진이에요. 구름이 끼면 가려져요.",
    family: "Sentinel-2",
  },
  sar: {
    label: "레이더 영상",
    short: "SAR",
    desc: "구름이 끼거나 밤이어도 찍혀요. 흑백 질감 영상이에요.",
    family: "Sentinel-1",
  },
};

// 없는 위성은 설명 없이 이름만 보인다
export const PLATFORM_NOTES: Record<string, string> = {
  "sentinel-2a": "2015년 발사",
  "sentinel-2b": "2017년 발사",
  "sentinel-2c": "2024년 발사, 최신",
  "sentinel-1c": "2024년 발사",
  "sentinel-1d": "2025년 발사, 최신",
};
