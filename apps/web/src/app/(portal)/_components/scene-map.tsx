"use client";

import {
  Popup,
  type ExpressionSpecification,
  type GeoJSONSource,
  type GeoJSONSourceSpecification,
  type LngLat,
  type Map,
} from "maplibre-gl";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMaplibre } from "@/hooks/use-maplibre";
import { formatKst } from "@/lib/date";
import { bboxOf, type PolygonGeometry } from "@/lib/geo";
import { useSelection } from "../_hooks/use-selection";
import { platformLabel } from "../_lib/format";
import type { StacItem } from "../_lib/types";

// selected는 globals.css의 --color-selected와 같은 값
const COLOR = { scene: "#60a5fa", selected: "#f97316", aoi: "#e11d48" };

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
  const [loading, setLoading] = useState(true);
  // footprint가 겹친 곳을 누르면 고를 수 있게 목록 팝업을 띄운다
  const [pick, setPick] = useState<{
    lngLat: LngLat;
    ids: string[];
    scenes: StacItem[];
  } | null>(null);
  // 결과가 바뀌면 팝업 목록은 낡았으니 안 띄운다
  const activePick = pick?.scenes === scenes ? pick : null;
  const [popupEl] = useState(() =>
    typeof document === "undefined" ? null : document.createElement("div"),
  );

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
          0.15,
          state("hover"),
          0.25,
          // 수십 장이 겹쳐서 아주 옅게. 겹친 만큼 진해져서 테두리가 화면 밖이어도 결과가 보인다.
          0.02,
        ],
      },
    });

    map.addLayer({
      id: "scene-line",
      type: "line",
      source: "scenes",
      paint: {
        "line-color": ["case", state("selected"), COLOR.selected, COLOR.scene],
        "line-width": ["case", state("selected"), 3, state("hover"), 2, 1],
        "line-opacity": ["case", state("selected"), 1, state("hover"), 1, 0.8],
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
    map.once("load", () => setLoading(false));

    const unsubscribe = useSelection.subscribe((s, prev) => {
      if (s.hoveredId !== prev.hoveredId) {
        setState(map, prev.hoveredId, "hover", false);
        setState(map, s.hoveredId, "hover", true);
      }
      if (s.selectedId !== prev.selectedId) {
        setState(map, prev.selectedId, "selected", false);
        setState(map, s.selectedId, "selected", true);

        // 목록에서 고르면 그 영상(과 AOI)이 다 보이게 옮긴다. 지도에서 고른 건 이미 보고 있다.
        const { scenes, aoi } = dataRef.current;
        const scene =
          s.selectedFrom === "list" &&
          scenes.find((x) => x.id === s.selectedId);
        if (scene)
          map.fitBounds(bboxOf(scene.geometry, ...(aoi ? [aoi] : [])), {
            padding: 48,
          });
      }
    });

    map.on("mousemove", "scene-fill", (e) => {
      map.getCanvas().style.cursor = "pointer";
      const id = (e.features?.[0]?.properties.id as string | undefined) ?? null;
      if (id !== useSelection.getState().hoveredId)
        useSelection.getState().hover(id);
    });

    map.on("mouseleave", "scene-fill", () => {
      map.getCanvas().style.cursor = "";
      useSelection.getState().hover(null);
    });

    // 한 장이면 바로 고르고, 여러 장이면 팝업에서 고르고, 빈 곳이면 선택을 푼다
    map.on("click", (e) => {
      if (!map.getLayer("scene-fill")) return;

      const ids = [
        ...new Set(
          map
            .queryRenderedFeatures(e.point, { layers: ["scene-fill"] })
            .map((f) => f.properties.id as string),
        ),
      ];

      if (ids.length > 1)
        setPick({ lngLat: e.lngLat, ids, scenes: dataRef.current.scenes });
      else useSelection.getState().select(ids[0] ?? null, "map");
    });

    return unsubscribe;
  }, [mapRef]);

  useEffect(() => {
    const map = mapRef.current;
    if (!activePick || !map || !popupEl) return;

    const popup = new Popup({ closeButton: false, maxWidth: "280px" })
      .setLngLat(activePick.lngLat)
      .setDOMContent(popupEl)
      .addTo(map);
    const onClose = () => {
      setPick(null);
      useSelection.getState().hover(null);
    };
    popup.on("close", onClose);

    // 다른 지점을 눌러 pick이 바뀔 땐 onClose 없이 지운다
    return () => {
      popup.off("close", onClose);
      popup.remove();
    };
  }, [mapRef, activePick, popupEl]);

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

  const { hover, select } = useSelection.getState();

  return (
    <div className="relative size-full">
      <div ref={containerRef} className="size-full" />
      {loading && (
        <div className="absolute inset-0 grid place-items-center bg-muted text-sm text-muted-foreground">
          <span className="animate-pulse">지도를 불러오는 중이에요</span>
        </div>
      )}
      {activePick &&
        popupEl &&
        createPortal(
          <div className="flex flex-col text-sm">
            <p className="px-2 pt-1 pb-1.5 text-xs text-muted-foreground">
              이 지점에 영상 {activePick.ids.length}장이 겹쳐 있어요
            </p>
            <ul className="max-h-60 overflow-y-auto">
              {scenes
                .filter((s) => activePick.ids.includes(s.id))
                .map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      className="w-full rounded px-2 py-1.5 text-left hover:bg-muted"
                      onMouseEnter={() => hover(s.id)}
                      onMouseLeave={() => hover(null)}
                      onClick={() => {
                        select(s.id, "map");
                        setPick(null);
                      }}
                    >
                      {platformLabel(s.properties.platform)}
                      <span className="text-muted-foreground">
                        {" "}
                        · {formatKst(s.properties.datetime)}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </div>,
          popupEl,
        )}
    </div>
  );
}
