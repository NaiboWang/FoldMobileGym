import { useCallback, useEffect, useRef, useState } from 'react';
import { normalizeLauncherLayout, reconcileLauncherLayoutWithRegistry } from './layout';
import { LAUNCHER_WALLPAPER_CHANGED_EVENT, loadLauncherLayout, resetLauncherLayout, saveLauncherLayout } from './storage';
import type { LauncherLayout, LauncherWallpaper } from './types';
import { APP_REGISTRY } from '../data/appRegistry';

type LayoutUpdater = LauncherLayout | ((prev: LauncherLayout) => LauncherLayout);

/**
 * Launcher layout state with localStorage persistence.
 * - Loads once on mount
 * - Debounced persistence on changes
 */
export function useLauncherLayout() {
  const [layout, setLayoutState] = useState<LauncherLayout>(() => loadLauncherLayout(APP_REGISTRY));
  const saveTimerRef = useRef<number | null>(null);

  const setLayout = useCallback((updater: LayoutUpdater) => {
    setLayoutState(prev => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      const normalized = normalizeLauncherLayout(next, APP_REGISTRY);
      return reconcileLauncherLayoutWithRegistry(normalized, APP_REGISTRY);
    });
  }, []);

  const reset = useCallback(() => {
    setLayoutState(resetLauncherLayout(APP_REGISTRY));
  }, []);

  const setWallpaper = useCallback((wallpaper: LauncherWallpaper) => {
    setLayout(prev => ({ ...prev, wallpaper }));
  }, [setLayout]);

  useEffect(() => {
    const onWallpaperChanged = (event: Event) => {
      const wallpaper = (event as CustomEvent<LauncherWallpaper>).detail;
      if (wallpaper?.kind === 'image' && wallpaper.imageUrl) setWallpaper(wallpaper);
    };
    window.addEventListener(LAUNCHER_WALLPAPER_CHANGED_EVENT, onWallpaperChanged);
    return () => window.removeEventListener(LAUNCHER_WALLPAPER_CHANGED_EVENT, onWallpaperChanged);
  }, [setWallpaper]);

  // Debounced persistence.
  useEffect(() => {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    saveTimerRef.current = window.setTimeout(() => {
      saveLauncherLayout(layout);
      saveTimerRef.current = null;
    }, 80);
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
  }, [layout]);

  return {
    layout,
    setLayout,
    reset,
    setWallpaper,
  };
}

