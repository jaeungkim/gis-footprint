import { Input } from "@/components/ui/input";

// TODO(3단계): URL 상태(nuqs)와 연결
export function SceneFilterPanel() {
  return (
    <form className="flex flex-col gap-4 border-b p-4 text-sm">
      <label className="flex flex-col gap-1.5">
        <span className="font-medium">관심 지역</span>
        <select className="h-8 rounded-lg border bg-transparent px-2">
          <option>부산 북항</option>
          <option>평택당진항</option>
          <option>새만금 매립지</option>
        </select>
      </label>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 font-medium">촬영 기간</legend>
        <div className="flex items-center gap-2">
          <Input type="date" defaultValue="2026-07-01" aria-label="시작일" />
          <span>~</span>
          <Input type="date" defaultValue="2026-08-31" aria-label="종료일" />
        </div>
      </fieldset>

      <fieldset className="flex gap-4">
        <legend className="mb-1.5 font-medium">센서</legend>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" defaultChecked /> 광학 (EO)
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" defaultChecked /> 레이더 (SAR)
        </label>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="font-medium">최대 운량 30%</span>
        <input type="range" min={0} max={100} defaultValue={30} />
      </label>
    </form>
  );
}
