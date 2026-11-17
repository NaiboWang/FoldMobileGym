/** Match map-adaptive.css using the Activity size, never the host browser size. */
export function getRouteSheetLayout(width: number, height: number) {
  const full = Math.max(0, height - 48);
  return {
    wide: width >= 600,
    collapsed: Math.min(155, full),
    medium: Math.min(300, full),
    full,
  };
}
