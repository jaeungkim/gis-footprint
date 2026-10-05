"use client";

import { useState } from "react";
import { CalendarIcon, ChevronRight, RotateCcw } from "lucide-react";
import { ko } from "react-day-picker/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
  FieldTitle,
} from "@/components/ui/field";
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
import { dateToDay, dayToDate, monthsBetween } from "@/lib/date";
import { COLLECTION_BY_SENSOR } from "../_lib/constants";
import { useCollections } from "../_hooks/use-collections";
import { useMediaQuery } from "../_hooks/use-media-query";
import { useSearchConditions } from "../_hooks/use-search-conditions";
import { PLATFORM_NOTES, platformLabel, SENSOR_INFO } from "../_lib/format";
import type { Aoi, BlockReason, Sensor } from "../_lib/types";

const SENSORS: Sensor[] = ["eo", "sar"];

const GSD_OPTIONS = [10, 20, 30, 60];
// Radix Select는 빈 문자열을 값으로 못 쓴다. "조건 없음"은 이 값으로 두고 URL에선 null.
const ALL = "all";

type Conditions = ReturnType<typeof useSearchConditions>[0];

// 2026-07-01 → 7.1
const shortDay = (day: string) => {
  const [, m, d] = day.split("-").map(Number);
  return `${m}.${d}`;
};

// 접었을 때 보여 줄 조건 요약. 기본값과 다른 것만, 정렬은 조건이 아니라 뺀다.
function summarize(p: Conditions, aoiName: string | undefined) {
  const chips: string[] = [];

  if (aoiName) chips.push(aoiName);
  if (p.from || p.to)
    chips.push(
      `${p.from ? shortDay(p.from) : ""} ~ ${p.to ? shortDay(p.to) : ""}`,
    );
  if (p.sensors.length === 0) chips.push("영상 종류 없음");
  if (p.sensors.length === 1)
    chips.push(`${SENSOR_INFO[p.sensors[0]].label}만`);
  if (p.platforms.length > 0)
    chips.push(
      p.platforms.length <= 2
        ? p.platforms.map(platformLabel).join(", ")
        : `위성 ${p.platforms.length}개`,
    );
  if (p.cloud < 100 && p.sensors.includes("eo"))
    chips.push(`운량 ${p.cloud}% 이하`);
  if (p.gsd !== null) chips.push(`해상도 ${p.gsd}m 이하`);

  return chips;
}

export function SceneFilterPanel({
  aois,
  blocked,
}: {
  aois: Aoi[];
  blocked: BlockReason | null;
}) {
  const [params, setParams] = useSearchConditions();
  const catalog = useCollections().data;
  const isDesktop = useMediaQuery("(min-width: 768px)");

  // 처음엔 데스크톱은 펼치고 모바일은 접는다. 한 번 누른 뒤로는 사용자 선택을 따른다.
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? isDesktop;
  const [dateOpen, setDateOpen] = useState(false);

  // 슬라이더는 놓을 때만 URL에 반영한다. 드래그 중 매번 검색하지 않게.
  const [cloudDraft, setCloudDraft] = useState<number | null>(null);
  // 이미 고른 위성이 있으면 펼친 채로 시작
  const [platformsOpen, setPlatformsOpen] = useState(
    params.platforms.length > 0,
  );
  const cloud = cloudDraft ?? params.cloud;

  const platformsOf = (s: Sensor) =>
    catalog?.platforms[COLLECTION_BY_SENSOR[s]] ?? [];

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
  const aoiName = aois.find((a) => a.id === params.aoi)?.name;
  const sort = params.sort === "coverage" && !aoiName ? "latest" : params.sort;
  const { from, to } = params;
  const chips = summarize(params, aoiName);
  // 카탈로그는 고정 스냅샷이라 "최근 n일" 대신 데이터가 있는 달을 고르게 한다
  const months =
    catalog?.from && catalog.to ? monthsBetween(catalog.from, catalog.to) : [];

  return (
    <Collapsible open={open} onOpenChange={setUserOpen} className="text-sm">
      <div className="sticky top-0 z-10 border-b bg-background px-4 py-2">
        <div className="flex items-center gap-2">
          <CollapsibleTrigger className="group flex flex-1 items-center gap-1.5 py-1 font-medium">
            <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90" />
            검색 조건
            {chips.length > 0 && (
              <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums">
                {chips.length}
              </span>
            )}
          </CollapsibleTrigger>
          <Button
            variant="ghost"
            size="sm"
            disabled={chips.length === 0}
            onClick={() => setParams(null)}
          >
            <RotateCcw />
            초기화
          </Button>
        </div>
        {!open && (
          <ul className="flex flex-wrap gap-1.5 pt-1 pb-1">
            {chips.length === 0 ? (
              <li className="text-muted-foreground">조건 없이 전체 영상</li>
            ) : (
              chips.map((c) => (
                <li
                  key={c}
                  className="rounded-md bg-muted px-2 py-0.5 text-xs text-foreground"
                >
                  {c}
                </li>
              ))
            )}
          </ul>
        )}
      </div>

      <CollapsibleContent asChild>
        <form
          className="flex flex-col gap-3 border-b p-4"
          onSubmit={(e) => e.preventDefault()}
        >
          <Field>
            <FieldLabel htmlFor="aoi">관심 지역</FieldLabel>
            <Select
              value={params.aoi ?? ALL}
              onValueChange={(v) => setParams({ aoi: v === ALL ? null : v })}
            >
              <SelectTrigger id="aoi" className="w-full">
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
          </Field>

          <FieldSet className="gap-1.5">
            <FieldLegend variant="label">촬영 기간 (한국 시간)</FieldLegend>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
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
                {months.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="mr-auto text-xs text-muted-foreground">
                      빠른 선택
                    </span>
                    {months.map((m) => (
                      <Button
                        key={m.from}
                        variant={
                          from === m.from && to === m.to
                            ? "secondary"
                            : "outline"
                        }
                        size="sm"
                        onClick={() => {
                          setParams({ from: m.from, to: m.to });
                          setDateOpen(false);
                        }}
                      >
                        {m.label}
                      </Button>
                    ))}
                  </div>
                )}
                <Calendar
                  mode="range"
                  locale={ko}
                  resetOnSelect
                  // 데이터가 없는 이번 달 대신 카탈로그 마지막 달부터 보여 준다
                  defaultMonth={
                    from
                      ? dayToDate(from)
                      : catalog?.to
                        ? dayToDate(catalog.to)
                        : undefined
                  }
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
              <FieldError>시작일이 종료일보다 늦어요.</FieldError>
            )}
          </FieldSet>

          <FieldSet className="gap-1.5">
            <FieldLegend variant="label">영상 종류</FieldLegend>
            <div className="grid grid-cols-2 gap-2">
              {SENSORS.map((s) => {
                const info = SENSOR_INFO[s];
                return (
                  <FieldLabel key={s} htmlFor={`sensor-${s}`}>
                    <Field orientation="horizontal">
                      <Checkbox
                        id={`sensor-${s}`}
                        checked={params.sensors.includes(s)}
                        onCheckedChange={(on) => toggleSensor(s, on === true)}
                      />
                      <FieldContent>
                        <FieldTitle>
                          {info.label}
                          <span className="font-normal text-muted-foreground">
                            {info.short}
                          </span>
                        </FieldTitle>
                        <FieldDescription className="text-xs">
                          {info.family} · {info.desc}
                        </FieldDescription>
                      </FieldContent>
                    </Field>
                  </FieldLabel>
                );
              })}
            </div>
            {blocked === "no-sensor" && (
              <FieldError>영상 종류를 하나 이상 골라 주세요.</FieldError>
            )}
          </FieldSet>

          {platformOptions.length > 0 && (
            <Collapsible open={platformsOpen} onOpenChange={setPlatformsOpen}>
              <CollapsibleTrigger className="group flex items-center gap-1 font-medium">
                <ChevronRight className="size-4 transition-transform group-data-[state=open]:rotate-90" />
                위성 직접 고르기
                <span className="font-normal text-muted-foreground">
                  {params.platforms.length > 0
                    ? `(${params.platforms.length}개 선택)`
                    : "(선택, 안 고르면 전체)"}
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-1.5 flex flex-col gap-2">
                <FieldDescription className="text-xs">
                  같은 계열 위성(예: 2A·2B·2C)은 성능이 같아요. 보통은 고를 필요
                  없어요.
                </FieldDescription>
                {platformOptions.map((p) => (
                  <Field key={p} orientation="horizontal" className="gap-1.5">
                    <Checkbox
                      id={`platform-${p}`}
                      checked={params.platforms.includes(p)}
                      onCheckedChange={(on) => togglePlatform(p, on === true)}
                    />
                    <FieldLabel
                      htmlFor={`platform-${p}`}
                      className="font-normal"
                    >
                      {platformLabel(p)}
                      {PLATFORM_NOTES[p] && (
                        <span className="text-xs text-muted-foreground">
                          {PLATFORM_NOTES[p]}
                        </span>
                      )}
                    </FieldLabel>
                  </Field>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}

          <Field data-disabled={!hasEo} className="gap-2.5">
            <div className="flex items-center justify-between">
              <FieldLabel htmlFor="cloud">최대 운량</FieldLabel>
              <span className="text-muted-foreground tabular-nums">
                {!hasEo
                  ? "광학 사진만 해당"
                  : cloud === 100
                    ? "제한 없음"
                    : `${cloud}% 이하`}
              </span>
            </div>
            <Slider
              id="cloud"
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
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor="gsd">최대 해상도</FieldLabel>
              <Select
                value={params.gsd === null ? ALL : String(params.gsd)}
                onValueChange={(v) =>
                  setParams({ gsd: v === ALL ? null : Number(v) })
                }
              >
                <SelectTrigger id="gsd" className="w-full">
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
            </Field>
            <Field>
              <FieldLabel htmlFor="sort">정렬</FieldLabel>
              <Select
                value={sort}
                onValueChange={(v) => setParams({ sort: v as typeof sort })}
              >
                <SelectTrigger id="sort" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">최신순</SelectItem>
                  <SelectItem value="coverage" disabled={!aoiName}>
                    커버리지 높은순{!aoiName && " (지역 필요)"}
                  </SelectItem>
                  <SelectItem value="cloud">운량 낮은순</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}
