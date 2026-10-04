"use client";

import { cn } from "cn";
import { ImageOff, Radar } from "lucide-react";
import { useEffect, useRef } from "react";
import { formatKst } from "@/lib/date";
import { COLLECTION_BY_SENSOR } from "../constants";
import { useSelection } from "../hooks/use-selection";
import { platformLabel } from "../lib/format";
import type { StacItem } from "../types";

export function SceneCard({
  scene,
  hasAoi,
}: {
  scene: StacItem;
  hasAoi: boolean;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const hovered = useSelection((s) => s.hoveredId === scene.id);
  const selected = useSelection((s) => s.selectedId === scene.id);
  const fromMap = useSelection((s) => s.selectedFrom === "map");
  const { hover, select } = useSelection.getState();

  useEffect(() => {
    if (selected && fromMap)
      ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected, fromMap]);

  const p = scene.properties;
  const isSar = scene.collection === COLLECTION_BY_SENSOR.sar;
  const thumb = scene.assets.thumbnail?.href;

  return (
    <li ref={ref}>
      <button
        type="button"
        aria-pressed={selected}
        onMouseEnter={() => hover(scene.id)}
        onMouseLeave={() => hover(null)}
        onFocus={() => hover(scene.id)}
        onBlur={() => hover(null)}
        onClick={() => select(selected ? null : scene.id, "list")}
        className={cn(
          "flex w-full gap-3 rounded-lg border p-2 text-left text-sm transition-colors",
          hovered && "bg-muted",
          selected && "border-primary ring-1 ring-primary",
        )}
      >
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">
          {thumb?.startsWith("https://") ? (
            // 외부 썸네일이라 next/image 최적화가 필요 없다
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt=""
              loading="lazy"
              className="size-full object-cover"
            />
          ) : isSar ? (
            <Radar aria-hidden className="size-6" />
          ) : (
            <ImageOff aria-hidden className="size-6" />
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">
            {platformLabel(p.platform)}{" "}
            <span className="font-normal text-muted-foreground">
              {isSar ? "SAR" : "EO"}
            </span>
          </span>
          <time dateTime={p.datetime} className="text-muted-foreground">
            {formatKst(p.datetime)}
          </time>
          <span className="text-muted-foreground">
            {isSar
              ? "운량 해당 없음"
              : p["eo:cloud_cover"] == null
                ? "운량 정보 없음"
                : `운량 ${p["eo:cloud_cover"].toFixed(1)}%`}
            {hasAoi && p["aoi:coverage_pct"] !== undefined && (
              <>
                {" · "}커버리지 {p["aoi:coverage_pct"].toFixed(1)}% (
                {p["aoi:coverage_km2"]?.toFixed(2)} km²)
              </>
            )}
          </span>
        </div>
      </button>
    </li>
  );
}
