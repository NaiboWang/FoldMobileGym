import { APP_REGISTRY } from '../data/appRegistry';
import type { AppManifest } from '../types/manifest';
import { debouncedSetItem, cancelPending, flushKey } from '../debouncedPersist';
import {
  buildDefaultLauncherLayout,
  normalizeLauncherLayout,
  reconcileLauncherLayoutWithRegistry,
} from './layout';
import {
  LAUNCHER_LAYOUT_VERSION,
  LAUNCHER_STORAGE_KEY,
  type LauncherLayout,
  type LauncherWallpaper,
} from './types';

export const LAUNCHER_WALLPAPER_CHANGED_EVENT = 'launcher:wallpaper-changed';

function safeJsonParse(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function loadLauncherLayout(appRegistry: AppManifest[] = APP_REGISTRY): LauncherLayout {
  const raw = localStorage.getItem(LAUNCHER_STORAGE_KEY);
  const referenceMarker = 'launcher.reference_20261014';
  if (!localStorage.getItem(referenceMarker)) {
    // Change only the desktop arrangement; retain the complete previous layout.
    if (raw && !localStorage.getItem('launcher.before_reference_20261014')) {
      localStorage.setItem('launcher.before_reference_20261014', raw);
    }
    const referenceLayout = buildDefaultLauncherLayout(appRegistry);
    saveLauncherLayout(referenceLayout);
    flushKey(LAUNCHER_STORAGE_KEY);
    localStorage.setItem(referenceMarker, '1');
    return referenceLayout;
  }
  if (!raw) {
    const layout = buildDefaultLauncherLayout(appRegistry);
    saveLauncherLayout(layout);
    return layout;
  }

  const parsed = safeJsonParse(raw);
  if (!parsed || parsed.version !== LAUNCHER_LAYOUT_VERSION) {
    const layout = buildDefaultLauncherLayout(appRegistry);
    saveLauncherLayout(layout);
    return layout;
  }

  // Normalize + reconcile against current registry (for forward compatibility).
  const normalized = normalizeLauncherLayout(parsed as LauncherLayout, appRegistry);
  const reconciled = reconcileLauncherLayoutWithRegistry(normalized, appRegistry);
  // Persist back if changed shape (best-effort).
  saveLauncherLayout(reconciled);
  return reconciled;
}

export function saveLauncherLayout(layout: LauncherLayout): void {
  debouncedSetItem(LAUNCHER_STORAGE_KEY, JSON.stringify(layout));
}

export function applyLauncherWallpaper(wallpaper: LauncherWallpaper): void {
  const layout = loadLauncherLayout();
  saveLauncherLayout({ ...layout, wallpaper });
  flushKey(LAUNCHER_STORAGE_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<LauncherWallpaper>(LAUNCHER_WALLPAPER_CHANGED_EVENT, { detail: wallpaper }));
  }
}

export function clearLauncherLayout(): void {
  cancelPending(LAUNCHER_STORAGE_KEY);
  try {
    localStorage.removeItem(LAUNCHER_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function resetLauncherLayout(appRegistry: AppManifest[] = APP_REGISTRY): LauncherLayout {
  const layout = buildDefaultLauncherLayout(appRegistry);
  saveLauncherLayout(layout);
  return layout;
}
