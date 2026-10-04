// TODO(3단계): 검색 API 결과로 교체
const SAMPLE_SCENES = [
  {
    id: "S2C_52SED_20260722_0_L2A",
    platform: "sentinel-2c",
    sensor: "EO",
    date: "2026-07-22",
    cloudCover: 3.8,
  },
  {
    id: "S1C_IW_GRDH_1SDV_20260727T212357",
    platform: "sentinel-1c",
    sensor: "SAR",
    date: "2026-07-27",
    cloudCover: null,
  },
  {
    id: "S2B_52SED_20260826_0_L2A",
    platform: "sentinel-2b",
    sensor: "EO",
    date: "2026-08-26",
    cloudCover: 1.5,
  },
];

export function SceneList() {
  return (
    <section className="min-h-0 flex-1 overflow-y-auto p-4">
      <h2 className="mb-3 text-sm text-muted-foreground">
        결과 {SAMPLE_SCENES.length}건
      </h2>
      <ul className="flex flex-col gap-2">
        {SAMPLE_SCENES.map((scene) => (
          <li
            key={scene.id}
            className="flex gap-3 rounded-lg border p-2 text-sm"
          >
            <div className="size-14 shrink-0 rounded bg-muted" />
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-medium">{scene.platform}</span>
              <span className="text-muted-foreground">{scene.date}</span>
              <span className="text-muted-foreground">
                {scene.sensor === "SAR"
                  ? "레이더"
                  : `운량 ${scene.cloudCover}%`}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
