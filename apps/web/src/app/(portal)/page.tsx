import { SceneFilterPanel } from "@/features/catalog/components/scene-filter-panel";
import { SceneList } from "@/features/catalog/components/scene-list";
import { BaseMap } from "@/features/map/components/base-map";

export default function ExplorePage() {
  return (
    <div className="grid h-full grid-rows-[auto_1fr] md:grid-cols-[360px_1fr] md:grid-rows-1">
      <aside className="flex min-h-0 flex-col border-b md:border-r md:border-b-0">
        <SceneFilterPanel />
        <SceneList />
      </aside>
      <BaseMap />
    </div>
  );
}
