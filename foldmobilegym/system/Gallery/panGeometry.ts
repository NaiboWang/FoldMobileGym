export type PanPoint = { x: number; y: number };
/** Positions use pre-zoom local CSS coordinates, not panel or host pixels. */
export function panLimits(imageWidth: number, imageHeight: number, viewportWidth: number, viewportHeight: number, scale: number): PanPoint {
  if (![imageWidth,imageHeight,viewportWidth,viewportHeight,scale].every(Number.isFinite)
    || Math.min(imageWidth,imageHeight,viewportWidth,viewportHeight) <= 0 || scale <= 1) return { x: 0, y: 0 };
  return { x: Math.max(0,(imageWidth*scale-viewportWidth)/(2*scale)), y: Math.max(0,(imageHeight*scale-viewportHeight)/(2*scale)) };
}
export function clampPan(point: PanPoint, limits: PanPoint): PanPoint {
  return { x: Math.max(-limits.x,Math.min(limits.x,point.x)), y: Math.max(-limits.y,Math.min(limits.y,point.y)) };
}
