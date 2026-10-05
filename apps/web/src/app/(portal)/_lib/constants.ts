import type { Sensor } from "./types";

export const SENSORS = ["eo", "sar"] as const;
export const SORT_PRESETS = ["latest", "coverage", "cloud"] as const;
export const GSD_OPTIONS = [10, 20, 30, 60] as const;
export const CLOUD_STEP = 5; // 운량 슬라이더 눈금(%)

export const COLLECTION_BY_SENSOR: Record<Sensor, string> = {
  eo: "sentinel-2-l2a",
  sar: "sentinel-1-grd",
};

export const PAGE_SIZE = 20;
