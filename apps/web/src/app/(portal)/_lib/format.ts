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
    desc: "구름이 끼면 가려져요",
    family: "Sentinel-2",
  },
  sar: {
    label: "레이더 영상",
    short: "SAR",
    desc: "구름이 껴도, 밤에도 찍혀요",
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

// 1234 → "1,234", 218.684 → "218.7", 100.0 → "100"
const num = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });

export const formatNumber = (n: number) => num.format(n);
