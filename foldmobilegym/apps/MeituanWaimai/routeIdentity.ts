/** Invalid or unknown routes must not silently select a different shop. */
export function readShopRouteId(pathname: string): string | null {
  const match = /^\/shop\/([^/]+)(?:\/(?:reviews|info))?$/.exec(pathname);
  if (!match) return null;
  try { return decodeURIComponent(match[1]); } catch { return null; }
}

export function readShopRouteSection(pathname: string): 'menu' | 'reviews' | 'info' | null {
  if (readShopRouteId(pathname) === null) return null;
  const section = /^\/shop\/[^/]+\/(reviews|info)$/.exec(pathname)?.[1];
  return section === 'reviews' || section === 'info' ? section : 'menu';
}
