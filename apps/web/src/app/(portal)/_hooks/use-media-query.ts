import { useCallback, useSyncExternalStore } from "react";

// 서버 렌더와 hydration 때는 데스크톱으로 보고, 그 뒤 실제 값으로 바꾼다.
export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );

  return useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
    () => true,
  );
}
