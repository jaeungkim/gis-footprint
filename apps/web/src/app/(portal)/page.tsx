import { Suspense } from "react";
import { Explore } from "@/features/catalog/components/explore";
import { loadSampleAois } from "@/features/catalog/lib/sample-aois";

export default async function ExplorePage() {
  const aois = await loadSampleAois();

  return (
    // nuqs(useSearchParams)는 Suspense 경계가 있어야 정적 렌더가 된다
    <Suspense>
      <Explore aois={aois} />
    </Suspense>
  );
}
