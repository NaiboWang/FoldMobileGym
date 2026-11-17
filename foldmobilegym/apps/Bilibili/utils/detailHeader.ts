import { dimens } from '../res/dimens';
/** App-local layout pixels, never host-window/native-panel dimensions. */
export const COMPACT_VIDEO_HEIGHT = dimens.video_compact_height;
const positive = (value: number) => Number.isFinite(value) ? Math.max(0, value) : 0;
/** Recover only a visible body with no viewport; never scroll a hidden surface. */
export function recoverVideoBodyOffset(top: number, viewportHeight: number, collapseMax: number, visible: boolean): number | null {
  const budget = positive(collapseMax);
  return visible && viewportHeight === 0 && budget > 0 ? Math.max(positive(top), budget) : null;
}
export function videoHeaderLayout(width: number, scrollTop: number) {
  const maxCollapse = Math.max(0, positive(width) * 9 / 16 - COMPACT_VIDEO_HEIGHT);
  const collapse = Math.min(maxCollapse, positive(scrollTop));
  return { maxCollapse, collapse, compact: maxCollapse > 0 && collapse >= maxCollapse - 0.5 };
}
/** Retain body progress after a window change, not the old display's header budget.
 * A partially collapsed header retains its fraction; a fully collapsed one keeps
 * the same content offset. This memory is volatile and belongs to one entry/tab.
 */
export function rebaseVideoDetailOffset(top: number, oldExtent: number, newExtent: number) {
  const offset = positive(top), before = positive(oldExtent), after = positive(newExtent);
  if (!before) return offset;
  return Math.max(0, offset - before) + after * Math.min(1, offset / before);
}
