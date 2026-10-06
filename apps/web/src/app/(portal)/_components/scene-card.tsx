"use client";

import { cn } from "cn";
import { compact } from "es-toolkit";
import { Copy, ImageOff, Radar } from "lucide-react";
import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { formatKst } from "@/lib/date";
import { COLLECTION_BY_SENSOR } from "../_lib/constants";
import { useSelection } from "../_hooks/use-selection";
import { formatNumber, platformLabel, SENSOR_INFO } from "../_lib/format";
import type { StacItem } from "../_lib/types";

const ORBIT = { ascending: "상승", descending: "하강" };

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

  // 지도에서 고른 직후 한 번만. 검색이 바뀌어 카드가 다시 마운트될 때 또 끌려가지 않게 지운다.
  useEffect(() => {
    if (!selected || !fromMap) return;
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    useSelection.setState({ selectedFrom: null });
  }, [selected, fromMap]);

  const p = scene.properties;
  const isSar = scene.collection === COLLECTION_BY_SENSOR.sar;
  const thumb = scene.assets.thumbnail?.href;
  // s3:// 썸네일(SAR)은 브라우저가 못 연다
  const thumbUrl = thumb?.startsWith("https://") ? thumb : undefined;
  const cloud = p["eo:cloud_cover"];

  const badges: string[] = [];
  if (!isSar)
    badges.push(
      cloud == null ? "운량 정보 없음" : `운량 ${formatNumber(cloud)}%`,
    );
  if (p.gsd !== undefined) badges.push(`해상도 ${p.gsd}m`);
  if (hasAoi && p["aoi:coverage_pct"] !== undefined)
    badges.push(
      `커버리지 ${formatNumber(p["aoi:coverage_pct"])}% · ${formatNumber(p["aoi:coverage_km2"] ?? 0)}km²`,
    );

  return (
    <li
      ref={ref}
      className={cn(
        // 위에 붙은 필터 머리줄에 가리지 않게
        "scroll-mt-20 overflow-hidden rounded-lg border transition-colors",
        hovered && "bg-muted",
        selected && "border-selected ring-1 ring-selected",
      )}
    >
      <button
        type="button"
        aria-expanded={selected}
        onMouseEnter={() => hover(scene.id)}
        onMouseLeave={() => hover(null)}
        onFocus={() => hover(scene.id)}
        onBlur={() => hover(null)}
        onClick={() => select(selected ? null : scene.id, "list")}
        className="flex w-full gap-3 p-2 text-left text-sm"
      >
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded bg-muted text-muted-foreground">
          {thumbUrl ? (
            // 외부 썸네일이라 next/image 최적화가 필요 없다
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbUrl}
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
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate font-medium">
            {SENSOR_INFO[isSar ? "sar" : "eo"].label}{" "}
            <span className="font-normal text-muted-foreground">
              · {platformLabel(p.platform)}
            </span>
          </span>
          <time dateTime={p.datetime} className="text-muted-foreground">
            {formatKst(p.datetime)}
          </time>
          {badges.length > 0 && (
            <ul className="flex flex-wrap gap-1">
              {badges.map((b) => (
                <li
                  key={b}
                  className="rounded border px-1.5 text-xs text-muted-foreground tabular-nums"
                >
                  {b}
                </li>
              ))}
            </ul>
          )}
        </div>
      </button>
      {selected && (
        <SceneDetail scene={scene} isSar={isSar} thumbUrl={thumbUrl} />
      )}
    </li>
  );
}

function SceneDetail({
  scene,
  isSar,
  thumbUrl,
}: {
  scene: StacItem;
  isSar: boolean;
  thumbUrl: string | undefined;
}) {
  const p = scene.properties;
  const rows: [string, string | undefined][] = isSar
    ? [
        [
          "촬영 모드",
          compact([
            p["sar:instrument_mode"],
            p["sar:polarizations"]?.join("+"),
          ]).join(" · "),
        ],
        [
          "궤도",
          p["sat:orbit_state"] &&
            `${ORBIT[p["sat:orbit_state"]]} · 상대 궤도 ${p["sat:relative_orbit"]}`,
        ],
      ]
    : [
        ["타일", p["grid:code"]],
        [
          "태양 고도",
          p["view:sun_elevation"] !== undefined
            ? `${formatNumber(p["view:sun_elevation"])}°`
            : undefined,
        ],
      ];

  // http로 열면(localhost 말고) navigator.clipboard가 없어서 바로 던진다. 그것도 토스트로.
  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(scene, null, 2));
      toast.success("STAC JSON을 복사했어요.");
    } catch {
      toast.error("복사하지 못했어요.");
    }
  };

  return (
    <div className="flex flex-col gap-3 border-t p-3 text-sm">
      {thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt={`${platformLabel(p.platform)} ${formatKst(p.datetime)} 미리보기`}
          className="aspect-square w-full rounded bg-muted object-cover"
        />
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted-foreground">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        <dt className="text-muted-foreground">ID</dt>
        <dd className="font-mono text-xs break-all">{scene.id}</dd>
      </dl>
      <Button variant="outline" size="sm" onClick={copyJson}>
        <Copy />
        STAC JSON 복사
      </Button>
    </div>
  );
}
