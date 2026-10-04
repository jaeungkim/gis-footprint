// sentinel-2a → Sentinel-2A
export const platformLabel = (p: string) =>
  p.replace(
    /^sentinel-(\d)(\w)$/,
    (_, n, l) => `Sentinel-${n}${l.toUpperCase()}`,
  );
