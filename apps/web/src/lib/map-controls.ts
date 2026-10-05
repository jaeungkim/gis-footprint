import { NavigationControl, type IControl, type Map } from "maplibre-gl";

// lucide map, satellite 아이콘
const svg = (paths: string[]) =>
  `<svg class="maplibregl-ctrl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths.map((d) => `<path d="${d}"/>`).join("")}</svg>`;

const ICON = {
  map: svg([
    "M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z",
    "M15 5.764v15",
    "M9 3.236v15",
  ]),
  satellite: svg([
    "m13.5 6.5-3.148-3.148a1.205 1.205 0 0 0-1.704 0L6.352 5.648a1.205 1.205 0 0 0 0 1.704L9.5 10.5",
    "M16.5 7.5 19 5",
    "m17.5 10.5 3.148 3.148a1.205 1.205 0 0 1 0 1.704l-2.296 2.296a1.205 1.205 0 0 1-1.704 0L13.5 14.5",
    "M9 21a6 6 0 0 0-6-6",
    "M9.352 10.648a1.205 1.205 0 0 0 0 1.704l2.296 2.296a1.205 1.205 0 0 0 1.704 0l4.296-4.296a1.205 1.205 0 0 0 0-1.704l-2.296-2.296a1.205 1.205 0 0 0-1.704 0z",
  ]),
};

// NavigationControl 그룹(확대, 축소, 나침반)에 배경 지도 버튼을 붙여 컨트롤을 한 묶음으로 둔다.
export class MapControls implements IControl {
  nav = new NavigationControl({ visualizePitch: true });
  button = document.createElement("button");

  constructor(onToggle: () => void) {
    this.button.type = "button";
    this.button.addEventListener("click", onToggle);
    this.showBasemap(false);
  }

  // 버튼은 누르면 바뀔 지도를 보여준다
  showBasemap(satellite: boolean) {
    const label = satellite ? "일반 지도" : "위성 지도";
    this.button.title = label;
    this.button.ariaLabel = label;
    this.button.ariaPressed = String(satellite);
    this.button.innerHTML = satellite ? ICON.map : ICON.satellite;
  }

  onAdd(map: Map) {
    const group = this.nav.onAdd(map);
    group.append(this.button);
    return group;
  }

  onRemove() {
    this.nav.onRemove();
  }
}
