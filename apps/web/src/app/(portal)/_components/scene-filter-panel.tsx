"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";
import { ko } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { dateToDay, dayToDate } from "@/lib/date";
import { COLLECTION_BY_SENSOR } from "../_lib/constants";
import { usePlatforms } from "../_hooks/use-platforms";
import { useSearchConditions } from "../_hooks/use-search-conditions";
import { PLATFORM_NOTES, platformLabel, SENSOR_INFO } from "../_lib/format";
import type { Aoi, BlockReason, Sensor } from "../_lib/types";

const SENSORS: Sensor[] = ["eo", "sar"];

const GSD_OPTIONS = [10, 20, 30, 60];
// Radix Select는 빈 문자열을 값으로 못 쓴다. "조건 없음"은 이 값으로 두고 URL에선 null.
const ALL = "all";

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
  // 이미 고른 위성이 있으면 펼친 채로 시작
  const [platformsOpen, setPlatformsOpen] = useState(
    params.platforms.length > 0,
  );
  const cloud = cloudDraft ?? params.cloud;

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
  const { from, to } = params;

  return (
    <form
      className="flex shrink-0 flex-col gap-3 border-b p-4 text-sm"
      onSubmit={(e) => e.preventDefault()}
    >
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">관심 지역</span>
        <Select
          value={params.aoi ?? ALL}
          onValueChange={(v) => setParams({ aoi: v === ALL ? null : v })}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>전체 (지역 조건 없음)</SelectItem>
            {aois.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 font-medium">촬영 기간 (한국 시간)</legend>
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="justify-start font-normal"
              aria-invalid={blocked === "date-range"}
            >
              <CalendarIcon />
              {from || to ? (
                `${from ?? ""} ~ ${to ?? ""}`
              ) : (
                <span className="text-muted-foreground">전체 기간</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto" align="start">
            <Calendar
              mode="range"
              locale={ko}
              resetOnSelect
              defaultMonth={from ? dayToDate(from) : undefined}
              selected={{
                from: from ? dayToDate(from) : undefined,
                to: to ? dayToDate(to) : undefined,
              }}
              onSelect={(r) =>
                setParams({
                  from: r?.from ? dateToDay(r.from) : null,
                  to: r?.to ? dateToDay(r.to) : null,
                })
              }
            />
            <Button
              variant="ghost"
              size="sm"
              className="self-end"
              disabled={!from && !to}
              onClick={() => setParams({ from: null, to: null })}
            >
              지우기
            </Button>
          </PopoverContent>
        </Popover>
        {blocked === "date-range" && (
          <p role="alert" className="text-destructive">
            시작일이 종료일보다 늦어요.
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 font-medium">영상 종류</legend>
        <div className="grid grid-cols-2 gap-2">
          {SENSORS.map((s) => {
            const info = SENSOR_INFO[s];
            return (
              <label
                key={s}
                className="flex cursor-pointer flex-col gap-1 rounded-lg border p-2.5 transition-colors has-data-checked:border-primary has-data-checked:bg-primary/5"
              >
                <span className="flex items-center gap-1.5 font-medium">
                  <Checkbox
                    checked={params.sensors.includes(s)}
                    onCheckedChange={(on) => toggleSensor(s, on === true)}
                  />
                  {info.label}
                  <span className="font-normal text-muted-foreground">
                    {info.short}
                  </span>
                </span>
                <span className="text-xs text-muted-foreground">
                  {info.desc}
                </span>
                <span className="text-xs text-muted-foreground">
                  {info.family} 위성
                </span>
              </label>
            );
          })}
        </div>
        {blocked === "no-sensor" && (
          <p role="alert" className="text-destructive">
            영상 종류를 하나 이상 골라 주세요.
          </p>
        )}
      </fieldset>

      {platformOptions.length > 0 && (
        <details
          open={platformsOpen}
          onToggle={(e) => setPlatformsOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer font-medium select-none">
            위성 직접 고르기{" "}
            <span className="font-normal text-muted-foreground">
              {params.platforms.length > 0
                ? `(${params.platforms.length}개 선택)`
                : "(선택, 안 고르면 전체)"}
            </span>
          </summary>
          <p className="mt-1.5 text-xs text-muted-foreground">
            같은 계열 위성(예: 2A·2B·2C)은 성능이 같아요. 보통은 고를 필요
            없어요.
          </p>
          <div className="mt-2 flex flex-col gap-1.5">
            {platformOptions.map((p) => (
              <label key={p} className="flex items-center gap-1.5">
                <Checkbox
                  checked={params.platforms.includes(p)}
                  onCheckedChange={(on) => togglePlatform(p, on === true)}
                />
                {platformLabel(p)}
                {PLATFORM_NOTES[p] && (
                  <span className="text-xs text-muted-foreground">
                    {PLATFORM_NOTES[p]}
                  </span>
                )}
              </label>
            ))}
          </div>
        </details>
      )}

      <label className="flex flex-col gap-2.5">
        <span className="font-medium">
          최대 운량 {cloud === 100 ? "제한 없음" : `${cloud}%`}
          {!hasEo && (
            <span className="font-normal text-muted-foreground">
              {" "}
              (광학 사진만 해당)
            </span>
          )}
        </span>
        <Slider
          min={0}
          max={100}
          step={5}
          value={[cloud]}
          disabled={!hasEo}
          onValueChange={([v]) => setCloudDraft(v)}
          onValueCommit={([v]) => {
            setParams({ cloud: v });
            setCloudDraft(null);
          }}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">최대 해상도</span>
          <Select
            value={params.gsd === null ? ALL : String(params.gsd)}
            onValueChange={(v) =>
              setParams({ gsd: v === ALL ? null : Number(v) })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>제한 없음</SelectItem>
              {GSD_OPTIONS.map((g) => (
                <SelectItem key={g} value={String(g)}>
                  {g}m 이하
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="font-medium">정렬</span>
          <Select
            value={sort}
            onValueChange={(v) => setParams({ sort: v as typeof sort })}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">최신순</SelectItem>
              <SelectItem value="coverage" disabled={!hasAoi}>
                커버리지 높은순{!hasAoi && " (지역 필요)"}
              </SelectItem>
              <SelectItem value="cloud">운량 낮은순</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>
    </form>
  );
}
