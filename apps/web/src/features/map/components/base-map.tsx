"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { Map, NavigationControl, setWorkerUrl } from "maplibre-gl";
import { useTheme } from "next-themes";
import { useEffect, useRef } from "react";

setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");

const KOREA_CENTER: [number, number] = [127.8, 36.3];
const STYLE = {
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
};

export function BaseMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<Map | null>(null);
  const { resolvedTheme } = useTheme();
  const style = resolvedTheme === "dark" ? STYLE.dark : STYLE.light;

  useEffect(() => {
    const map = new Map({
      container: containerRef.current!,
      style,
      center: KOREA_CENTER,
      zoom: 6,
    });
    map.addControl(new NavigationControl(), "top-right");
    mapRef.current = map;
    return () => map.remove();
    // 지도는 한 번만 만들고, 테마 변경은 아래 effect에서 setStyle로 처리
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    mapRef.current?.setStyle(style);
  }, [style]);

  return <div ref={containerRef} className="h-full min-h-80 w-full" />;
}
