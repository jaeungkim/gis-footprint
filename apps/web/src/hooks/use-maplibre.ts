import "maplibre-gl/dist/maplibre-gl.css";
import { Map, NavigationControl, setWorkerUrl } from "maplibre-gl";
import { useTheme } from "next-themes";
import { useEffect, useEffectEvent, useRef, type RefObject } from "react";

setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const KOREA_CENTER: [number, number] = [127.8, 36.3];

const STYLE = {
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

// 배경 지도를 한 번 만들고 테마가 바뀌면 스타일만 갈아 끼운다.
// setStyle은 앱이 넣은 source와 layer를 지운다. 스타일이 (다시) 뜰 때마다 onStyleLoad에서 넣는다.
export function useMaplibre(
  containerRef: RefObject<HTMLDivElement | null>,
  onStyleLoad: (map: Map) => void,
) {
  const mapRef = useRef<Map | null>(null);
  const handleStyleLoad = useEffectEvent(onStyleLoad);
  const { resolvedTheme } = useTheme();

  const style = resolvedTheme === "dark" ? STYLE.dark : STYLE.light;
  const appliedStyleRef = useRef(style);

  useEffect(() => {
    const map = new Map({
      container: containerRef.current!,
      style: appliedStyleRef.current,
      center: KOREA_CENTER,
      zoom: 6,
    });

    map.addControl(new NavigationControl(), "top-right");
    map.on("style.load", () => handleStyleLoad(map));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [containerRef]);

  useEffect(() => {
    if (appliedStyleRef.current === style) return;
    appliedStyleRef.current = style;
    // diff: false여야 style.load가 확실히 다시 온다
    mapRef.current?.setStyle(style, { diff: false });
  }, [style]);

  return mapRef;
}
