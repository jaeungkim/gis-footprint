"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import {
  Map,
  NavigationControl,
  setWorkerUrl,
  type ExpressionSpecification,
  type GeoJSONSource,
  type GeoJSONSourceSpecification,
} from "maplibre-gl";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";
import { useSelection } from "@/features/catalog/selection-store";
import type { AoiGeometry, StacItem } from "@/features/catalog/stac-search";

setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const KOREA_CENTER: [number, number] = [127.8, 36.3];
const STYLE = {
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
};
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
  aoi: AoiGeometry | null,
): GeoJSONSourceSpecification["data"] => ({
  type: "FeatureCollection",
  features: aoi ? [{ type: "Feature", geometry: aoi, properties: {} }] : [],
});

function bboxOf(g: AoiGeometry): [number, number, number, number] {
  const rings = g.type === "Polygon" ? g.coordinates : g.coordinates.flat();
  const xs = rings.flat().map((p) => p[0]);
  const ys = rings.flat().map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

const state = (key: "hover" | "selected"): ExpressionSpecification => [
  "boolean",
  ["feature-state", key],
  false,
];

export function BaseMap({
  aoi,
  scenes,
}: {
  aoi: AoiGeometry | null;
  scenes: StacItem[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  // style.load 때 다시 그릴 최신 데이터
  const dataRef = useRef({ aoi, scenes });
  const { resolvedTheme } = useTheme();
  const style = resolvedTheme === "dark" ? STYLE.dark : STYLE.light;
  const appliedStyleRef = useRef(style);

  useEffect(() => {
    const map = new Map({
      container: containerRef.current!,
      style,
      center: KOREA_CENTER,
      zoom: 6,
    });
    map.addControl(new NavigationControl(), "top-right");
    mapRef.current = map;

    const setState = (
      id: string | null,
      key: "hover" | "selected",
      on: boolean,
    ) => {
      if (id && map.getSource("scenes"))
        map.setFeatureState({ source: "scenes", id }, { [key]: on });
    };

    // setStyle은 우리 source와 layer를 지운다. 스타일이 (다시) 뜰 때마다 넣는다.
    map.on("style.load", () => {
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
          "fill-color": [
            "case",
            state("selected"),
            COLOR.selected,
            COLOR.scene,
          ],
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
          "line-color": [
            "case",
            state("selected"),
            COLOR.selected,
            COLOR.scene,
          ],
          "line-width": [
            "case",
            state("selected"),
            2.5,
            state("hover"),
            2,
            0.75,
          ],
          "line-opacity": [
            "case",
            state("selected"),
            1,
            state("hover"),
            1,
            0.5,
          ],
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
      setState(hoveredId, "hover", true);
      setState(selectedId, "selected", true);
    });

    const unsubscribe = useSelection.subscribe((s, prev) => {
      if (s.hoveredId !== prev.hoveredId) {
        setState(prev.hoveredId, "hover", false);
        setState(s.hoveredId, "hover", true);
      }
      if (s.selectedId !== prev.selectedId) {
        setState(prev.selectedId, "selected", false);
        setState(s.selectedId, "selected", true);
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

    return () => {
      unsubscribe();
      map.remove();
    };
    // 지도는 한 번만 만들고, 테마 변경은 아래 effect에서 setStyle로 처리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (appliedStyleRef.current === style) return;
    appliedStyleRef.current = style;
    // diff: false여야 style.load가 확실히 다시 온다
    mapRef.current?.setStyle(style, { diff: false });
  }, [style]);

  useEffect(() => {
    dataRef.current.scenes = scenes;
    (mapRef.current?.getSource("scenes") as GeoJSONSource | undefined)?.setData(
      scenesData(scenes),
    );
  }, [scenes]);

  useEffect(() => {
    dataRef.current.aoi = aoi;
    const map = mapRef.current;
    if (!map) return;
    (map.getSource("aoi") as GeoJSONSource | undefined)?.setData(aoiData(aoi));
    if (aoi) map.fitBounds(bboxOf(aoi), { padding: 48, maxZoom: 13 });
  }, [aoi]);

  return <div ref={containerRef} className="h-full min-h-80 w-full" />;
}
