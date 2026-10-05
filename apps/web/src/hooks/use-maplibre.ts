import "maplibre-gl/dist/maplibre-gl.css";
import {
  Map,
  setWorkerUrl,
  type MapOptions,
  type StyleSpecification,
} from "maplibre-gl";
import { useTheme } from "next-themes";
import {
  useEffect,
  useEffectEvent,
  useRef,
  useState,
  type RefObject,
} from "react";
import { MapControls } from "@/lib/map-controls";

setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

// 남한 전체가 한 화면에 들어오는 시작 화면
const KOREA_VIEW: Pick<MapOptions, "center" | "zoom"> = {
  center: [127.8, 36.3],
  zoom: 6,
};

// Sentinel-2 cloudless 2016 모자이크는 CC BY 4.0이라 키 없이 출처 표기만 하면 된다.
const SATELLITE: StyleSpecification = {
  version: 8,
  sources: {
    s2cloudless: {
      type: "raster",
      tiles: [
        "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/g/{z}/{y}/{x}.jpg",
      ],
      tileSize: 256,
      attribution:
        '<a href="https://s2maps.eu">Sentinel-2 cloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016)',
    },
  },
  layers: [{ id: "s2cloudless", type: "raster", source: "s2cloudless" }],
};

const STYLE = {
  light: "https://tiles.openfreemap.org/styles/positron",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

function basemapStyle(satellite: boolean, theme: string | undefined) {
  if (satellite) return SATELLITE;
  if (theme === "dark") return STYLE.dark;
  return STYLE.light;
}

// 배경 지도와 컨트롤(확대, 축소, 나침반, 위성 전환)을 한 번 만들고
// 테마나 위성 여부가 바뀌면 스타일만 갈아 끼운다.
// setStyle은 앱이 넣은 source와 layer를 지운다. 스타일이 (다시) 뜰 때마다 onStyleLoad에서 넣는다.
export function useMaplibre(
  containerRef: RefObject<HTMLDivElement | null>,
  onStyleLoad: (map: Map) => void,
) {
  const mapRef = useRef<Map | null>(null);
  const handleStyleLoad = useEffectEvent(onStyleLoad);
  const { resolvedTheme } = useTheme();
  const [satellite, setSatellite] = useState(false);
  const controlsRef = useRef<MapControls | null>(null);

  const style = basemapStyle(satellite, resolvedTheme);
  const appliedStyleRef = useRef(style);

  useEffect(() => {
    const map = new Map({
      container: containerRef.current!,
      style: appliedStyleRef.current,
      ...KOREA_VIEW,
    });

    // maplibre DOM은 브라우저에서만 만들 수 있어 effect 안에서 만든다
    const controls = new MapControls(() => setSatellite((on) => !on));
    map.addControl(controls, "top-right");
    controlsRef.current = controls;
    map.on("style.load", () => handleStyleLoad(map));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [containerRef]);

  useEffect(() => controlsRef.current?.showBasemap(satellite), [satellite]);

  useEffect(() => {
    if (appliedStyleRef.current === style) return;
    appliedStyleRef.current = style;
    // diff: false여야 style.load가 확실히 다시 온다
    mapRef.current?.setStyle(style, { diff: false });
  }, [style]);

  return mapRef;
}
