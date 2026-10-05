"use client";

import type {
  ExpressionSpecification,
  GeoJSONSource,
  GeoJSONSourceSpecification,
  Map,
} from "maplibre-gl";
import { useEffect, useRef } from "react";
import { useMaplibre } from "@/hooks/use-maplibre";
import { bboxOf, type PolygonGeometry } from "@/lib/geo";
import { useSelection } from "../_hooks/use-selection";
import type { StacItem } from "../_lib/types";

const COLOR = { scene: "#3b82f6", selected: "#f97316", aoi: "#e11d48" };

// 워커로 보내는 건 geometry와 id뿐. id는 promoteId로 feature-state 키가 된다.
const scenesData = (
  scenes: StacItem[],
): GeoJSONSourceSpecification["data"] => ({
  type: "FeatureCollection",
  features: scenes.map((s) => ({
    type: "Feature",
    geometry: s.geometry,
    properties: { id: s.id },
  })),
});

const aoiData = (
  aoi: PolygonGeometry | null,
): GeoJSONSourceSpecification["data"] => ({
  type: "FeatureCollection",
  features: aoi ? [{ type: "Feature", geometry: aoi, properties: {} }] : [],
});

const state = (key: "hover" | "selected"): ExpressionSpecification => [
  "boolean",
  ["feature-state", key],
  false,
];

function setState(
  map: Map,
  id: string | null,
  key: "hover" | "selected",
  on: boolean,
) {
  if (id && map.getSource("scenes"))
    map.setFeatureState({ source: "scenes", id }, { [key]: on });
}

// 검색 결과 footprint와 AOI를 그리고, 목록과 hover/선택을 맞춘다.
export function SceneMap({
  aoi,
  scenes,
}: {
  aoi: PolygonGeometry | null;
  scenes: StacItem[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // style.load 때 다시 그릴 최신 데이터
  const dataRef = useRef({ aoi, scenes });

  const mapRef = useMaplibre(containerRef, (map) => {
    map.addSource("scenes", {
      type: "geojson",
      data: scenesData(dataRef.current.scenes),
      promoteId: "id",
    });

    map.addSource("aoi", {
      type: "geojson",
      data: aoiData(dataRef.current.aoi),
    });

    map.addLayer({
      id: "scene-fill",
      type: "fill",
      source: "scenes",
      paint: {
        "fill-color": ["case", state("selected"), COLOR.selected, COLOR.scene],
        "fill-opacity": [
          "case",
          state("selected"),
          0.3,
          state("hover"),
          0.25,
          // 결과가 수십 장 겹쳐서 기본은 테두리만. 채우면 배경 지도가 안 보인다.
          0,
        ],
      },
    });

    map.addLayer({
      id: "scene-line",
      type: "line",
      source: "scenes",
      paint: {
        "line-color": ["case", state("selected"), COLOR.selected, COLOR.scene],
        "line-width": ["case", state("selected"), 2.5, state("hover"), 2, 0.75],
        "line-opacity": ["case", state("selected"), 1, state("hover"), 1, 0.5],
      },
    });

    map.addLayer({
      id: "aoi-line",
      type: "line",
      source: "aoi",
      paint: {
        "line-color": COLOR.aoi,
        "line-width": 2.5,
        "line-dasharray": [2, 1],
      },
    });

    const { hoveredId, selectedId } = useSelection.getState();
    setState(map, hoveredId, "hover", true);
    setState(map, selectedId, "selected", true);
  });

  // 지도가 만들어진 뒤(useMaplibre의 effect 다음) 선택 상태와 마우스 이벤트를 잇는다.
  useEffect(() => {
    const map = mapRef.current!;

    const unsubscribe = useSelection.subscribe((s, prev) => {
      if (s.hoveredId !== prev.hoveredId) {
        setState(map, prev.hoveredId, "hover", false);
        setState(map, s.hoveredId, "hover", true);
      }
      if (s.selectedId !== prev.selectedId) {
        setState(map, prev.selectedId, "selected", false);
        setState(map, s.selectedId, "selected", true);
      }
    });

    const idAt = (e: {
      features?: { properties: Record<string, unknown> }[];
    }) => (e.features?.[0]?.properties.id as string | undefined) ?? null;

    map.on("mousemove", "scene-fill", (e) => {
      map.getCanvas().style.cursor = "pointer";
      const id = idAt(e);
      if (id !== useSelection.getState().hoveredId)
        useSelection.getState().hover(id);
    });

    map.on("mouseleave", "scene-fill", () => {
      map.getCanvas().style.cursor = "";
      useSelection.getState().hover(null);
    });

    map.on("click", "scene-fill", (e) =>
      useSelection.getState().select(idAt(e), "map"),
    );

    return unsubscribe;
  }, [mapRef]);

  useEffect(() => {
    dataRef.current.scenes = scenes;
    (mapRef.current?.getSource("scenes") as GeoJSONSource | undefined)?.setData(
      scenesData(scenes),
    );
  }, [mapRef, scenes]);

  useEffect(() => {
    dataRef.current.aoi = aoi;

    const map = mapRef.current;
    if (!map) return;

    (map.getSource("aoi") as GeoJSONSource | undefined)?.setData(aoiData(aoi));
    if (aoi) map.fitBounds(bboxOf(aoi), { padding: 48, maxZoom: 13 });
  }, [mapRef, aoi]);

  return <div ref={containerRef} className="h-full min-h-80 w-full" />;
}
