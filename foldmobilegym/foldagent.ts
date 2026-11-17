/**
 * FoldAgent-MobileGym foldable device bridge.
 *
 * The browser exposes explicit fold/unfold controls. Benchmark-owned events and
 * opt-in agent posture actions are recorded separately by the controller.
 */
import { clampFloatingBounds, DEFAULT_FLOATING_BOUNDS, type FloatingBounds } from './os/windowGestures';
import { splitOrientationForPosture, type SplitOrientation } from './foldagent_window_policy';
export type { SplitOrientation } from './foldagent_window_policy';

export type FoldablePosture = 'folded' | 'half_folded' | 'unfolded';
export type PhysicalDeviceState = 'CLOSED' | 'HALF_OPENED' | 'OPENED';

export type FoldableEventEvidence = {
  event_id: string;
  controller: 'benchmark';
  trigger_step: number;
  trigger_state_hash: string;
  posture_before: FoldablePosture;
  posture_after: FoldablePosture;
  layout_before: string;
  layout_after: string;
};

type DisplaySpec = {
  width: number;
  height: number;
  resolution_width: number | null;
  resolution_height: number | null;
  diagonal_inches: number | null;
  ppi: number | null;
  visible: boolean;
  density_dpi: number | null;
  aspect_ratio: string;
};

type FoldFeature = {
  state: 'FLAT' | 'HALF_OPENED';
  orientation: 'vertical' | 'horizontal';
  bounds: [number, number, number, number];
  occlusion_type: 'NONE';
  separating: boolean;
} | null;

export type FoldableMultiWindowState = {
  mode: 'fullscreen' | 'split' | 'triple' | 'floating';
  floating?: { task_id: string; bounds: FloatingBounds; minimized: boolean };
  primary_task_id: string | null;
  secondary_task_id: string | null;
  tertiary_task_id: string | null;
  divider_ratio: number;
  secondary_split_ratio: number;
  split_orientation?: SplitOrientation;
  /** Inner-display preference, retained while split_orientation is stacked on the cover. */
  unfolded_split_orientation?: SplitOrientation;
};

export type FoldableDeviceState = {
  enabled: boolean;
  profile: 'honor_magic_v5';
  manufacturer: 'HONOR';
  model: 'HONOR Magic V5';
  reference_software: 'Unconfirmed recording device';
  continuity_policy: 'continue_active_app';
  posture: FoldablePosture;
  physical_state: PhysicalDeviceState;
  hinge_angle: number;
  active_display: 'inner' | 'cover';
  layout_id: 'inner_wide' | 'inner_book' | 'cover_single';
  window_size_class: 'compact' | 'expanded';
  fold_feature: FoldFeature;
  displays: {
    inner: DisplaySpec;
    cover: DisplaySpec;
  };
  multi_window: FoldableMultiWindowState;
  events: FoldableEventEvidence[];
};

const INNER = {
  // Official panel dimensions in portrait width x height:
  // https://www.honor.com/uk/phones/honor-magic-v5/spec/
  // Keep a 900 CSS-pixel preview height with the exact native aspect ratio.
  width: 900 * 2172 / 2352,
  height: 900,
  resolution_width: 2172,
  resolution_height: 2352,
  diagonal_inches: null,
  ppi: null,
  density_dpi: null,
  aspect_ratio: '2172:2352',
};

const COVER = {
  width: 900 * 1060 / 2376,
  height: 900,
  resolution_width: 1060,
  resolution_height: 2376,
  diagonal_inches: null,
  ppi: null,
  density_dpi: null,
  aspect_ratio: '1060:2376',
};

const stateForPosture = (posture: FoldablePosture) => {
  if (posture === 'folded') {
    return {
      physical_state: 'CLOSED' as const,
      hinge_angle: 0,
      active_display: 'cover' as const,
      layout_id: 'cover_single' as const,
      window_size_class: 'compact' as const,
      fold_feature: null,
    };
  }
  if (posture === 'half_folded') {
    return {
      physical_state: 'HALF_OPENED' as const,
      hinge_angle: 90,
      active_display: 'inner' as const,
      layout_id: 'inner_book' as const,
      window_size_class: 'expanded' as const,
      fold_feature: {
        state: 'HALF_OPENED' as const,
        orientation: 'horizontal' as const,
        bounds: [0, INNER.height / 2 - 1, INNER.width, INNER.height / 2 + 1] as [number, number, number, number],
        occlusion_type: 'NONE' as const,
        separating: true,
      },
    };
  }
  return {
    physical_state: 'OPENED' as const,
    hinge_angle: 180,
    active_display: 'inner' as const,
    layout_id: 'inner_wide' as const,
    window_size_class: 'expanded' as const,
    fold_feature: {
      state: 'FLAT' as const,
      orientation: 'vertical' as const,
      bounds: [INNER.width / 2 - 1, 0, INNER.width / 2 + 1, INNER.height] as [number, number, number, number],
      occlusion_type: 'NONE' as const,
      separating: false,
    },
  };
};

let state: FoldableDeviceState = {
  enabled: true,
  profile: 'honor_magic_v5',
  manufacturer: 'HONOR',
  model: 'HONOR Magic V5',
  reference_software: 'Unconfirmed recording device',
  continuity_policy: 'continue_active_app',
  posture: 'unfolded',
  ...stateForPosture('unfolded'),
  displays: {
    inner: { ...INNER, visible: true },
    cover: { ...COVER, visible: false },
  },
  multi_window: { mode: 'fullscreen', primary_task_id: null, secondary_task_id: null, tertiary_task_id: null, divider_ratio: 0.5, secondary_split_ratio: 0.5 },
  events: [],
};

// Presentation chrome is for a human-operated visual demo only.  Never infer
// it from navigator.webdriver: CDP/headless sessions do not consistently set
// that flag, which previously leaked posture controls into agent screenshots.
// Benchmark runs remain clean unless a human explicitly opts in via URL.
const isPresentationMode = () => {
  // Human controls now live in the browser extension, outside the page.
  // Ignore the legacy presentation query so old bookmarks also remain clean.
  return false;
};

function currentViewport() {
  // Both human previews and automated sessions use the same native-ratio
  // logical canvas; CSS preview pixels are not physical panel pixels.
  return state.active_display === 'cover' ? COVER : INNER;
}

function refreshScale(width: number, height: number) {
  const reservePanel = isPresentationMode() && window.innerWidth >= 1040 ? 280 : 0;
  const availableWidth = Math.max(320, window.innerWidth - reservePanel - 48);
  const availableHeight = Math.max(320, window.innerHeight - 48);
  const scale = Math.min(availableWidth / width, availableHeight / height, 1);
  document.documentElement.style.setProperty('--sim-scale', String(scale));
}

function renderDevice() {
  const viewport = currentViewport();
  document.documentElement.dataset.foldagentPosture = state.posture;
  document.documentElement.dataset.foldagentDisplay = state.active_display;
  document.documentElement.dataset.foldagentWindowMode = state.multi_window.mode;
  document.documentElement.dataset.foldagentPresentation = String(isPresentationMode());
  document.documentElement.style.setProperty('--foldagent-device-width', `${viewport.width}px`);
  document.documentElement.style.setProperty('--foldagent-device-height', `${viewport.height}px`);
  document.documentElement.style.setProperty('--foldagent-hinge-angle', `${state.hinge_angle}deg`);
  refreshScale(viewport.width, viewport.height);
  window.dispatchEvent(new CustomEvent('foldagent:posturechange', { detail: getState() }));
}


export function getState(): FoldableDeviceState {
  return JSON.parse(JSON.stringify(state)) as FoldableDeviceState;
}

export function setPosture(
  posture: FoldablePosture,
  options?: { reset_events?: boolean; event?: FoldableEventEvidence },
): FoldableDeviceState {
  if (options?.reset_events) state.events = [];
  const postureState = stateForPosture(posture);
  const preferred = state.multi_window.unfolded_split_orientation ?? state.multi_window.split_orientation ?? 'side_by_side';
  state = {
    ...state,
    posture,
    ...postureState,
    displays: {
      inner: { ...INNER, visible: posture !== 'folded' },
      cover: { ...COVER, visible: posture === 'folded' },
    },
    multi_window: state.multi_window.mode === 'split'
      ? { ...state.multi_window, unfolded_split_orientation: preferred,
          split_orientation: splitOrientationForPosture(posture, preferred) }
      : posture === 'folded'
        ? { mode: 'fullscreen', primary_task_id: null, secondary_task_id: null, tertiary_task_id: null, divider_ratio: 0.5, secondary_split_ratio: 0.5 }
        : state.multi_window,
    events: options?.event ? [...state.events, options.event] : state.events,
  };
  renderDevice();
  return getState();
}

/** Public device controls; repeated requests keep the current posture. */
export function fold(): FoldableDeviceState {
  return state.posture === 'folded' ? getState() : setPosture('folded');
}

export function unfold(): FoldableDeviceState {
  return state.posture === 'unfolded' ? getState() : setPosture('unfolded');
}

export function setMultiWindow(
  mode: 'fullscreen' | 'split' | 'triple',
  primaryTaskId: string | null = null,
  secondaryTaskId: string | null = null,
  dividerRatio = 0.5,
  tertiaryTaskId: string | null = null,
  secondarySplitRatio = 0.5,
  splitOrientation?: SplitOrientation,
): FoldableDeviceState {
  if (mode !== 'fullscreen' && state.posture !== 'unfolded' && !(mode === 'split' && state.posture === 'folded')) {
    throw new Error('This multi-window mode is unavailable on the current display.');
  }
  if (mode === 'triple' && !tertiaryTaskId) {
    throw new Error('Triple-window mode requires a tertiary task.');
  }
  if (splitOrientation !== undefined && !['side_by_side', 'stacked'].includes(splitOrientation)) {
    throw new Error('Invalid split orientation.');
  }
  // The argument sets the inner-display preference. Resizing the same pair
  // preserves it even while the cover's effective orientation is stacked.
  const orientation = splitOrientation ?? (mode === 'split'
    && state.multi_window.primary_task_id === primaryTaskId
    && state.multi_window.secondary_task_id === secondaryTaskId
    ? state.multi_window.unfolded_split_orientation ?? state.multi_window.split_orientation : undefined) ?? 'side_by_side';
  state = {
    ...state,
    multi_window: {
      mode,
      primary_task_id: mode !== 'fullscreen' ? primaryTaskId : null,
      secondary_task_id: mode !== 'fullscreen' ? secondaryTaskId : null,
      tertiary_task_id: mode === 'triple' ? tertiaryTaskId : null,
      divider_ratio: Math.max(0.33, Math.min(0.67, dividerRatio)),
      secondary_split_ratio: Math.max(0.35, Math.min(0.65, secondarySplitRatio)),
      ...(mode === 'split' ? { unfolded_split_orientation: orientation,
        split_orientation: splitOrientationForPosture(state.posture, orientation) } : {}),
    },
  };
  document.documentElement.dataset.foldagentWindowMode = mode;
  window.dispatchEvent(new CustomEvent('foldagent:windowchange', { detail: getState() }));
  return getState();
}

/** Volatile freeform window; existing task/activity instances remain the content owners. */
export function setFloatingWindow(taskId: string, bounds = DEFAULT_FLOATING_BOUNDS, minimized = false): FoldableDeviceState {
  if (!taskId) throw new Error('Floating window requires a task.');
  state = { ...state, multi_window: {
    mode: 'floating', primary_task_id: taskId, secondary_task_id: null,
    tertiary_task_id: null, divider_ratio: 0.5, secondary_split_ratio: 0.5,
    floating: { task_id: taskId, bounds: clampFloatingBounds(bounds), minimized },
  } };
  document.documentElement.dataset.foldagentWindowMode = 'floating';
  window.dispatchEvent(new CustomEvent('foldagent:windowchange', { detail: getState() }));
  return getState();
}
declare global {
  interface Window {
    __FOLDAGENT__?: { getState: typeof getState; fold: typeof fold; unfold: typeof unfold; setPosture: typeof setPosture; setMultiWindow: typeof setMultiWindow; setFloatingWindow: typeof setFloatingWindow };
  }
}

if (typeof window !== 'undefined') {
  window.__FOLDAGENT__ = { getState, fold, unfold, setPosture, setMultiWindow, setFloatingWindow };
  window.addEventListener('resize', () => {
    const viewport = currentViewport();
    refreshScale(viewport.width, viewport.height);
  });
  renderDevice();
}
