"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { toDateString, useSearchConditions } from "../search-params";
import {
  COLLECTION_BY_SENSOR,
  platformLabel,
  type Aoi,
  type BlockReason,
  type Sensor,
} from "../stac-search";
import { usePlatforms } from "../use-scene-search";

const SENSORS: { value: Sensor; label: string }[] = [
  { value: "eo", label: "광학 (EO)" },
  { value: "sar", label: "레이더 (SAR)" },
];
const GSD_OPTIONS = [10, 20, 30, 60];
const selectClass = "h-8 rounded-lg border bg-transparent px-2";

export function SceneFilterPanel({
  aois,
  blocked,
}: {
  aois: Aoi[];
  blocked: BlockReason | null;
}) {
  const [params, setParams] = useSearchConditions();
  const platformsByCollection = usePlatforms().data ?? {};
  // 슬라이더는 놓을 때만 URL에 반영한다. 드래그 중 매번 검색하지 않게.
  const [cloudDraft, setCloudDraft] = useState<number | null>(null);
  const cloud = cloudDraft ?? params.cloud;
  const commitCloud = () => {
    if (cloudDraft !== null) setParams({ cloud: cloudDraft });
    setCloudDraft(null);
  };

  const platformsOf = (s: Sensor) =>
    platformsByCollection[COLLECTION_BY_SENSOR[s]] ?? [];
  const toggleSensor = (s: Sensor, on: boolean) => {
    const hidden = new Set(on ? [] : platformsOf(s));
    setParams({
      sensors: on
        ? [...params.sensors, s]
        : params.sensors.filter((x) => x !== s),
      // 꺼진 센서의 위성 선택은 지운다
      platforms: params.platforms.filter((p) => !hidden.has(p)),
    });
  };
  const togglePlatform = (p: string, on: boolean) =>
    setParams({
      platforms: on
        ? [...params.platforms, p]
        : params.platforms.filter((x) => x !== p),
    });

  const hasEo = params.sensors.includes("eo");
  const platformOptions = params.sensors.flatMap(platformsOf);
  const hasAoi = aois.some((a) => a.id === params.aoi);
  const sort = params.sort === "coverage" && !hasAoi ? "latest" : params.sort;

  return (
    <form
      className="flex shrink-0 flex-col gap-3 border-b p-4 text-sm"
      onSubmit={(e) => e.preventDefault()}
    >
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">관심 지역</span>
        <select
          className={selectClass}
          value={params.aoi ?? ""}
          onChange={(e) => setParams({ aoi: e.target.value || null })}
        >
          <option value="">전체 (지역 조건 없음)</option>
          {aois.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 font-medium">촬영 기간 (한국 시간)</legend>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="시작일"
            value={toDateString(params.from) ?? ""}
            onChange={(e) =>
              setParams({
                from: e.target.value ? new Date(e.target.value) : null,
              })
            }
            aria-invalid={blocked === "date-range"}
          />
          <span>~</span>
          <Input
            type="date"
            aria-label="종료일"
            value={toDateString(params.to) ?? ""}
            onChange={(e) =>
              setParams({
                to: e.target.value ? new Date(e.target.value) : null,
              })
            }
            aria-invalid={blocked === "date-range"}
          />
        </div>
        {blocked === "date-range" && (
          <p role="alert" className="text-destructive">
            시작일이 종료일보다 늦어요.
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 font-medium">센서</legend>
        <div className="flex gap-4">
          {SENSORS.map((s) => (
            <label key={s.value} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={params.sensors.includes(s.value)}
                onChange={(e) => toggleSensor(s.value, e.target.checked)}
              />
              {s.label}
            </label>
          ))}
        </div>
        {blocked === "no-sensor" && (
          <p role="alert" className="text-destructive">
            센서를 하나 이상 고르세요.
          </p>
        )}
      </fieldset>

      {platformOptions.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 font-medium">
            위성{" "}
            <span className="font-normal text-muted-foreground">
              (안 고르면 전체)
            </span>
          </legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {platformOptions.map((p) => (
              <label key={p} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={params.platforms.includes(p)}
                  onChange={(e) => togglePlatform(p, e.target.checked)}
                />
                {platformLabel(p)}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="font-medium">
          최대 운량 {cloud === 100 ? "제한 없음" : `${cloud}%`}
          {!hasEo && (
            <span className="font-normal text-muted-foreground">
              {" "}
              (광학만 해당)
            </span>
          )}
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={cloud}
          disabled={!hasEo}
          onChange={(e) => setCloudDraft(Number(e.target.value))}
          onPointerUp={commitCloud}
          onKeyUp={commitCloud}
          onBlur={commitCloud}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">최대 해상도</span>
          <select
            className={selectClass}
            value={params.gsd ?? ""}
            onChange={(e) =>
              setParams({ gsd: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">제한 없음</option>
            {GSD_OPTIONS.map((g) => (
              <option key={g} value={g}>
                {g}m 이하
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">정렬</span>
          <select
            className={selectClass}
            value={sort}
            onChange={(e) => setParams({ sort: e.target.value as typeof sort })}
          >
            <option value="latest">최신순</option>
            <option value="coverage" disabled={!hasAoi}>
              커버리지 높은순{!hasAoi && " (지역 필요)"}
            </option>
            <option value="cloud">운량 낮은순</option>
          </select>
        </label>
      </div>
    </form>
  );
}
