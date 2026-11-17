/** A pointer beyond a sheet boundary still updates the sheet to that boundary. */
export function clampSheetDragHeight(height: number, minHeight: number, maxHeight?: number): number {
  return Math.min(maxHeight ?? Infinity, Math.max(minHeight, height));
}
