import type { Sensor } from "./types";

export const COLLECTION_BY_SENSOR: Record<Sensor, string> = {
  eo: "sentinel-2-l2a",
  sar: "sentinel-1-grd",
};
export const PAGE_SIZE = 20;
