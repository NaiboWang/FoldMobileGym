/** Coordinates are physical CSS pixels relative to the displayed device, not its native panel. */
export function classifyBottomGesture(dx: number, up: number, width: number, height: number, unfolded: boolean) {
  const diagonal = up >= Math.min(110, height * 0.16)
    && Math.abs(dx) >= Math.min(90, width * 0.18)
    && Math.abs(dx) >= up * 0.38;
  if (diagonal && dx > 0) return 'floating' as const;
  if (diagonal && dx < 0 && unfolded) return 'split' as const;
  return 'vertical' as const;
}

/** Start the visual response before the release threshold, without committing a window.
 * Only the inner-display left drag gains an early preview; Home, Recents and floating
 * release classification keep their existing thresholds. Ignore small pointer jitter.
 */
export function previewBottomGesture(dx: number, up: number, width: number, height: number, unfolded: boolean) {
  const committed = classifyBottomGesture(dx, up, width, height, unfolded);
  if (committed !== 'vertical') return committed;
  const slop = Math.min(8, width * 0.02, height * 0.02);
  return unfolded && dx < -slop && up > slop && -dx >= up * 0.38 ? 'split' as const : 'vertical' as const;
}

export type FloatingBounds = { x: number; y: number; width: number; height: number };
export const DEFAULT_FLOATING_BOUNDS: FloatingBounds = { x: 0.53, y: 0.08, width: 0.44, height: 0.68 };
export function clampFloatingBounds(bounds: FloatingBounds): FloatingBounds {
  const finite = (n: number, fallback: number) => Number.isFinite(n) ? n : fallback;
  const width = Math.max(0.32, Math.min(0.92, finite(bounds.width, 0.44)));
  const height = Math.max(0.35, Math.min(0.88, finite(bounds.height, 0.68)));
  return { width, height,
    x: Math.max(0, Math.min(1 - width, finite(bounds.x, 0.53))),
    y: Math.max(0.04, Math.min(0.96 - height, finite(bounds.y, 0.08))),
  };
}

/** Reference-informed presentation, not a second app viewport or native-pixel claim.
 * The original app surface keeps its width/height; only its compositor transform changes.
 */
export function splitCardPresentation(dxRatio: number, upRatio: number, parked = false) {
  const safe = (value: number) => Number.isFinite(value) ? value : 0;
  const progress = parked ? 1 : Math.max(0, Math.min(1, Math.max(-safe(dxRatio) / 0.28, safe(upRatio) / 0.27)));
  // The held surface is smaller; after release it grows while sliding to its parked edge.
  const scale = parked ? 0.91 : 1 - 0.22 * progress;
  return {
    x: parked ? 0.048 - scale : Math.max(0.048 - scale, Math.min(0, safe(dxRatio))),
    y: (parked ? 0.04 : 0.025) * progress,
    scale,
    radius: 28 * progress,
  };
}
