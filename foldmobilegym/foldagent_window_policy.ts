export type SplitOrientation = 'side_by_side' | 'stacked';

/** The cover uses top/bottom panes; the inner display restores the pair's preference. */
export function splitOrientationForPosture(posture: string, unfoldedOrientation: SplitOrientation = 'side_by_side'): SplitOrientation {
  return posture === 'folded' ? 'stacked' : unfoldedOrientation;
}
