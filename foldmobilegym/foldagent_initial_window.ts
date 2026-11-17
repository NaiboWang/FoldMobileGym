import type { SplitOrientation } from './foldagent';
import { splitOrientationForPosture } from './foldagent_window_policy';

export type InitialWindowConfig = {
  posture: 'folded' | 'unfolded' | 'tabletop';
  layout: string;
  focused_app: string;
  mode: 'fullscreen' | 'split' | 'freeform';
  split_apps?: [string, string];
  /** Preferred inner-display direction; folded initialization always renders stacked. */
  split_orientation?: SplitOrientation;
  divider_ratio?: number;
};

type InitialWindow = { appId: string; posture: string; layout?: string; mode?: string; orientation?: SplitOrientation };
type InitialWindowProbe = {
  read: () => { appId: string | null | undefined; posture: string | undefined; layout: string | undefined;
    mode?: string; orientation?: SplitOrientation; visible: boolean; routeReady: boolean; launcher: boolean; recents: boolean };
  nextFrame: () => Promise<void>;
  now: () => number;
};

/** Schema modes are not proof that this adapter can establish their panes. */
export function requireSupportedInitialMode(mode: unknown, openInitialApp = true): void {
  if (openInitialApp && mode !== 'fullscreen' && mode !== 'split') {
    throw Error(`Unsupported initial window mode: ${String(mode)}`);
  }
}

/** Validate before reset; a schema mode alone does not identify the two panes. */
export function validateInitialWindow(config: InitialWindowConfig, apps: string[], openInitialApp = true): void {
  if (!openInitialApp) return; // Explicit diagnostics never promise window setup.
  requireSupportedInitialMode(config?.mode);
  if (!apps.includes(config.focused_app)) throw Error('Initial focused_app must belong to task.apps');
  if (config.mode === 'split') {
    const panes = config.split_apps;
    if (!Array.isArray(panes) || panes.length !== 2 || panes[0] === panes[1]
      || panes.some(app => typeof app !== 'string' || !apps.includes(app))) {
      throw Error('Initial split_apps must contain two distinct task apps in pane order');
    }
    if (!panes.includes(config.focused_app)) throw Error('Initial focused_app must belong to split_apps');
    if (!['side_by_side', 'stacked'].includes(config.split_orientation!)) throw Error('Initial split_orientation must be side_by_side or stacked');
    if (config.posture !== 'unfolded' && config.posture !== 'folded') throw Error('Initial split requires unfolded or folded posture');
    if (config.divider_ratio !== undefined && (!Number.isFinite(config.divider_ratio) || config.divider_ratio < 0.33 || config.divider_ratio > 0.67)) {
      throw Error('Initial divider_ratio must be between 0.33 and 0.67');
    }
  } else if (config.split_apps !== undefined || config.split_orientation !== undefined || config.divider_ratio !== undefined) {
    throw Error('Split configuration requires mode=split');
  }
}

/** Wait for actual startup observations; never write OS state or action evidence. */
export async function settleInitialWindow(expected: InitialWindow, probe: InitialWindowProbe, timeoutMs = 10000): Promise<void> {
  const deadline = probe.now() + timeoutMs;
  while (true) {
    const state = probe.read();
    if (state.appId === expected.appId && state.posture === expected.posture
      && (!expected.layout || state.layout === expected.layout)
      && (!expected.mode || state.mode === expected.mode)
      && (!expected.orientation || state.orientation === splitOrientationForPosture(expected.posture, expected.orientation))
      && state.visible && state.routeReady && !state.launcher && !state.recents) return;
    if (probe.now() >= deadline) throw Error(`Initial app window did not settle: ${expected.appId}`);
    await probe.nextFrame();
  }
}
