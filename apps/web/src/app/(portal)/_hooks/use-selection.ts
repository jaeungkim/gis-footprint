import { create } from "zustand";

// 지도와 목록이 같이 보는 상태. URL에는 안 둔다.
interface Selection {
  hoveredId: string | null;
  selectedId: string | null;
  selectedFrom: "map" | "list" | null; // 지도에서 고르면 목록이 그 항목으로 한 번 스크롤하고 null로 돌린다
  hover: (id: string | null) => void;
  select: (id: string | null, from: "map" | "list") => void;
}

export const useSelection = create<Selection>((set) => ({
  hoveredId: null,
  selectedId: null,
  selectedFrom: null,
  hover: (hoveredId) => set({ hoveredId }),
  select: (selectedId, selectedFrom) => set({ selectedId, selectedFrom }),
}));
