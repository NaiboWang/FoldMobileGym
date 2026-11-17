
import React, { useState, useRef, useEffect, useSyncExternalStore, useCallback, useMemo } from 'react';
import './styles/device-typography.css';
import { prioritizeVisibleActivityImages } from './activityImagePriority';
import './styles/multi-window.css';
import { classifyBottomGesture, previewBottomGesture, splitCardPresentation, type FloatingBounds } from './windowGestures';
import { splitOrientationForPosture } from '../foldagent_window_policy';
import { BackDispatcher } from './BackDispatcher';
import { FloatingWindowChrome } from './components/WindowControls';
import { EdgeGestures } from './components/EdgeGestures';
import { useOS } from './OSContext';
import { SIMULATOR_CONFIG } from './data';
import { APP_REGISTRY, renderAppContent, getAppManifest, getLocalizedAppName } from './data/appRegistry';

const {
  recentsCardWidth, recentsAppPreviewWidth, recentsCardGap, recentsTopPadding,
  recentsScrollContainerHeight, recentsCardHeight, recentsCardBorderRadius,
  recentsAppPreviewHeight, recentsOpacityDivisor, recentsBackgroundOpacity,
  recentsSwipeThreshold, recentsHoldDuration,
  zIndexRecentsCards, zIndexApp, zIndexRecentsBlur, zIndexRecentsChrome,
  zIndexStatusBar, zIndexGestureBar,
  statusBarHeight, transitionDuration,
  gestureBarOpacityLight, gestureBarOpacityDark, gestureProgressDivisor,
  homeSwipeThreshold,
  bottomGestureHeight, gestureBarWidth, gestureBarHeight, gestureProgressScale,
  edgeGestureWidth, swipeThreshold, backIndicatorSize, backIndicatorOpacity,
  viewportWidth: fwViewportWidth,
} = SIMULATOR_CONFIG.framework;
import { initScrollMeta } from './scrollMeta';
import { initSimInput } from './simInput';
import { Wifi, Bluetooth, Signal, BatteryMedium, Plane } from 'lucide-react';
import { Launcher } from './launcher/Launcher';
import { useTheme } from './ThemeContext';
import { AppIcon } from './components/AppIcon';
import { MediaPickerHost } from './components/MediaPickerHost';
import { KeyboardOverlay } from './components/KeyboardOverlay';
import { TextSelectionMenu } from './components/TextSelectionMenu';
import { TextSelectionHandles } from './components/TextSelectionHandles';
import { SteadyTextCaret } from './components/SteadyTextCaret';
import { HeadsUpNotification } from './components/HeadsUpNotification';
import { SystemShade } from './components/SystemShade';
import { PermissionDialogHost } from './components/PermissionDialog';
import { SystemErrorBoundary } from './components/SystemErrorBoundary';
import { TopEdgeShadeGestureCatcher } from './components/TopEdgeShadeGestureCatcher';
import { DeviceEffects } from './components/DeviceEffects';
import { IntentChooserSheet } from './components/IntentChooserSheet';
import { useGlobalLongPress } from './hooks/useGlobalLongPress';
import { TextSelectionService } from './TextSelectionService';
import * as TimeService from './TimeService';
import BroadcastBus, { ACTION_TIME_SET } from './BroadcastBus';
import { SystemShadeService } from './SystemShadeService';
import QuickSettingsService from './QuickSettingsService';
import { useOsT } from './i18n';
import StatusBarService from './StatusBarService';
import * as SkinService from './SkinService';
import { themeToCssVars } from './utils/themeToCssVars';
import { getActiveTopActivityId, getTaskTopActivity, getTasksMRU } from './taskUtils';
import { ActivityContext } from './ActivityContext';
import { KeyboardService } from './keyboard/KeyboardService';
import { getVisibleKeyboardHeight } from './keyboard/keyboardLayout';
import { TaskManager } from './TaskManager';
import type { AppId, OSState } from './types';

const computeActivityContainerStyle = (args: {
  isRecentsVisible: boolean;
  isActive: boolean;
  recentsSlot?: { index: number };
  shouldHide?: boolean;
}): { containerStyle: React.CSSProperties; innerStyle: React.CSSProperties } => {
  const isFoldInner = typeof document !== 'undefined' && document.documentElement.dataset.foldagentDisplay === 'inner';
  // One UI uses larger, horizontally browsable cards on the Fold main display.
  const cardWidth = isFoldInner ? 236 : recentsCardWidth;
  const cardHeight = isFoldInner ? 430 : recentsCardHeight;
  const cardGap = isFoldInner ? 16 : recentsCardGap;
  const scrollHeight = isFoldInner ? 500 : recentsScrollContainerHeight;
  const topPadding = isFoldInner ? 130 : recentsTopPadding;
  const scale = cardWidth / recentsAppPreviewWidth;
  const paddingLeft = isFoldInner ? 44 : 48;
  const cardStride = cardWidth + cardGap;
  const cardTop = topPadding + (scrollHeight - cardHeight) / 2;

  if (args.shouldHide) {
    return {
      containerStyle: {
        visibility: 'hidden',
        pointerEvents: 'none',
        display: 'none',
        position: 'absolute',
        top: 0,
        right: 0,
        bottom: 0,
        left: 0,
        overflow: 'hidden',
      },
      innerStyle: { width: '100%', height: '100%', transform: 'translateZ(0)' },
    };
  }

  if (args.isRecentsVisible && args.recentsSlot) {
    return {
      containerStyle: {
        position: 'fixed',
        top: `${cardTop}px`,
        left: `calc(${paddingLeft + (args.recentsSlot.index * cardStride)}px - var(--recents-scroll, 0px))`,
        width: `${cardWidth}px`,
        height: `${cardHeight}px`,
        zIndex: zIndexRecentsCards,
        visibility: 'visible',
        pointerEvents: 'none',
        overflow: 'hidden',
        borderRadius: `${isFoldInner ? 22 : recentsCardBorderRadius}px`,
        backgroundColor: '#fff',
      },
      innerStyle: {
        width: `${recentsAppPreviewWidth}px`,
        height: `${recentsAppPreviewHeight}px`,
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
      },
    };
  }

  const isVisible = args.isActive && !args.isRecentsVisible;
  return {
    containerStyle: {
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
      zIndex: zIndexApp,
      display: isVisible ? 'block' : 'none',
      visibility: isVisible ? 'visible' : 'hidden',
      pointerEvents: isVisible ? 'auto' : 'none',
      overflow: 'hidden',
    },
    innerStyle: { width: '100%', height: '100%', transform: 'translateZ(0)' },
  };
};

const noopSubscribe = () => () => {};
const getZeroSnapshot = () => 0;
const getKeyboardHeightSnapshot = () => getVisibleKeyboardHeight(KeyboardService.getState());

function syncSwipeToActivityContainer(
  topActivityId: string,
  taskId: string,
  offset: number,
  mode: 'drag' | 'resetAnimated' | 'resetImmediate' = 'drag',
): void {
  const activityContainerEl = document.getElementById(`activity-container-${topActivityId}`) as HTMLElement | null;
  const escapedTaskId =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(taskId) : taskId;
  const chromeCardEl = document.querySelector(
    `[data-recents-card="${escapedTaskId}"]`
  ) as HTMLElement | null;

  const targets = [activityContainerEl, chromeCardEl].filter(Boolean) as HTMLElement[];
  if (targets.length === 0) return;

  if (mode === 'resetImmediate') {
    targets.forEach((el) => {
      el.style.transform = '';
      el.style.opacity = '';
      el.style.transition = '';
    });
    return;
  }

  if (mode === 'resetAnimated') {
    targets.forEach((el) => {
      el.style.transform = '';
      el.style.opacity = '';
      el.style.transition = 'transform 0.2s, opacity 0.2s';
    });
    return;
  }

  {
    const opacity = String(Math.max(0, 1 - offset / recentsOpacityDivisor));
    targets.forEach((el) => {
      el.style.transform = `translateY(${-offset}px)`;
      el.style.opacity = opacity;
      el.style.transition = 'none';
    });
  }
}

const RecentsBlur: React.FC = () => {
  const { state, goHome } = useOS();
  if (!state.isRecentsVisible) return null;
  return (
    <div
      className="absolute inset-0 backdrop-blur-sm"
      style={{
        zIndex: zIndexRecentsBlur,
        backgroundColor: `rgba(0, 0, 0, ${recentsBackgroundOpacity})`,
      }}
      onClick={goHome}
    />
  );
};

const RecentsChrome: React.FC = () => {
  const { state, launchTaskById, closeTask, goHome, launchApp } = useOS();
  const t = useOsT();
  const scrollRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<{ pid: number; y: number; taskId: string } | null>(null);
  const swipeOffset = useRef(0);
  const lastDismissTs = useRef(0);

  const tasksMRU = useMemo(() => getTasksMRU(state.tasks), [state.tasks]);
  const isFoldInner = typeof document !== 'undefined' && document.documentElement.dataset.foldagentDisplay === 'inner';
  const cardWidth = isFoldInner ? 236 : recentsCardWidth;
  const cardHeight = isFoldInner ? 430 : recentsCardHeight;
  const cardGap = isFoldInner ? 16 : recentsCardGap;
  const scrollHeight = isFoldInner ? 500 : recentsScrollContainerHeight;
  const topPadding = isFoldInner ? 130 : recentsTopPadding;
  const edgePanelApps = useMemo(() => {
    const preferred = ['wechat', 'map', 'alipay', 'ebay', 'wechat_reading', 'tencent_meeting'];
    return preferred.map(id => APP_REGISTRY.find(app => app.id === id)).filter((app): app is NonNullable<typeof app> => !!app);
  }, []);
  const topActivityByTaskId = useMemo(() => {
    const map = new Map<string, string>();
    for (const task of tasksMRU) {
      const top = getTaskTopActivity(task);
      if (top) map.set(task.taskId, top.activityId);
    }
    return map;
  }, [tasksMRU]);

  const handleScroll = useCallback(() => {
    document.documentElement.style.setProperty(
      '--recents-scroll',
      `${scrollRef.current?.scrollLeft ?? 0}px`
    );
  }, []);

  useEffect(() => {
    if (!state.isRecentsVisible) return;
    document.documentElement.style.setProperty('--recents-scroll', '0px');
    handleScroll();
    return () => {
      document.documentElement.style.removeProperty('--recents-scroll');
    };
  }, [state.isRecentsVisible, handleScroll]);

  useEffect(() => {
    if (!state.isRecentsVisible) return;
    // 确保进入/退出多任务时，不残留上滑 transform/opacity
    tasksMRU.forEach((task) => {
      const topActivityId = topActivityByTaskId.get(task.taskId);
      if (topActivityId) {
        syncSwipeToActivityContainer(topActivityId, task.taskId, 0, 'resetImmediate');
      }
    });

    return () => {
      tasksMRU.forEach((task) => {
        const topActivityId = topActivityByTaskId.get(task.taskId);
        if (topActivityId) {
          syncSwipeToActivityContainer(topActivityId, task.taskId, 0, 'resetImmediate');
        }
      });
    };
  }, [state.isRecentsVisible, tasksMRU, topActivityByTaskId]);

  if (!state.isRecentsVisible) return null;

  const handleClearAll = () => {
    const taskIds = tasksMRU.map(task => task.taskId);
    taskIds.forEach(taskId => closeTask(taskId));
    goHome();
  };

  const handleScrollContainerClick = (e: React.MouseEvent) => {
    if (TimeService.realNow() - lastDismissTs.current < 400) return;
    if (e.target === e.currentTarget) {
      goHome();
    }
  };

  const handleCardPointerDown = (e: React.PointerEvent, taskId: string) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    swipeStartRef.current = { pid: e.pointerId, y: e.clientY, taskId };
    swipeOffset.current = 0;
    const topActivityId = topActivityByTaskId.get(taskId);
    if (topActivityId) syncSwipeToActivityContainer(topActivityId, taskId, 0, 'resetImmediate');
    try { (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const handleCardPointerMove = (e: React.PointerEvent) => {
    const s = swipeStartRef.current;
    if (!s || s.pid !== e.pointerId) return;
    const diff = s.y - e.clientY;
    if (diff <= 0) return; // 只允许向上滑动
    swipeOffset.current = diff;
    const topActivityId = topActivityByTaskId.get(s.taskId);
    if (topActivityId) syncSwipeToActivityContainer(topActivityId, s.taskId, diff, 'drag');
  };

  const handleCardPointerEnd = (e: React.PointerEvent) => {
    const s = swipeStartRef.current;
    if (!s || s.pid !== e.pointerId) return;

    const offset = swipeOffset.current;
    const topActivityId = topActivityByTaskId.get(s.taskId);

    if (offset > recentsSwipeThreshold) {
      lastDismissTs.current = TimeService.realNow();
      closeTask(s.taskId);
      if (tasksMRU.length === 1) {
        goHome();
      }
    } else {
      if (topActivityId) syncSwipeToActivityContainer(topActivityId, s.taskId, 0, 'resetAnimated');
    }

    swipeStartRef.current = null;
    swipeOffset.current = 0;
  };

  return (
    <div
      className="absolute inset-0 flex flex-col items-center pointer-events-none"
      style={{
        zIndex: zIndexRecentsChrome,
        paddingTop: `${topPadding}px`,
      }}
    >
      <div className="foldagent-recents-header pointer-events-auto">
        <span>{tasksMRU.length} 个最近使用的应用</span><span aria-hidden="true">⌕</span>
      </div>
      <div
        ref={scrollRef}
        className="flex overflow-x-auto w-full px-12 no-scrollbar items-center pointer-events-auto"
        style={{
          gap: `${cardGap}px`,
          height: `${scrollHeight}px`,
        }}
        onScroll={handleScroll}
        onClick={handleScrollContainerClick}
      >
        {tasksMRU.map((task) => {
          const manifest = getAppManifest(task.rootAppId);
          return (
            <div
              key={task.taskId}
              data-recents-card={task.taskId}
              className="flex-shrink-0 relative group cursor-pointer touch-none"
              style={{
                width: `${cardWidth}px`,
                height: `${cardHeight}px`,
              }}
              onPointerDown={(e) => handleCardPointerDown(e, task.taskId)}
              onPointerMove={handleCardPointerMove}
              onPointerUp={handleCardPointerEnd}
              onPointerCancel={handleCardPointerEnd}
              onClick={() => launchTaskById(task.taskId)}
            >
              <div className="recents-task-label absolute -top-7 left-3 flex items-center gap-2 pointer-events-none z-10">
                {manifest ? (
                  <AppIcon manifest={manifest} size={28} radius={8} showShadow />
                ) : null}
                <span className="text-white text-[13px] font-medium drop-shadow-lg">
                  {getLocalizedAppName(task.rootAppId)}
                </span>
              </div>
              <div
                className="overflow-hidden shadow-2xl relative border border-white/10"
                style={{
                  width: `${cardWidth}px`,
                  height: `${cardHeight}px`,
                  borderRadius: `${isFoldInner ? 22 : recentsCardBorderRadius}px`,
                }}
              />
            </div>
          );
        })}
      </div>

      {state.tasks.length > 0 && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleClearAll();
          }}
          className="foldagent-recents-clear mt-3 bg-white/10 px-8 py-2 rounded-full text-white text-[12px] font-medium border border-white/10 active:scale-95 transition-transform pointer-events-auto"
        >
          {t('清除全部')}
        </button>
      )}
      {isFoldInner && state.tasks.length > 0 && (
        <div className="foldagent-recents-suggestions pointer-events-auto" aria-label="建议应用">
          {edgePanelApps.map((manifest) => (
            <button key={manifest.id} type="button" aria-label={`打开 ${getLocalizedAppName(manifest.id)}`} onClick={() => launchApp(manifest.id)}>
              <AppIcon manifest={manifest} size={42} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const getLightTextFromDeclaredForeground = (foreground: string | null | undefined): boolean | null => {
  if (foreground === 'light') return true;
  if (foreground === 'dark') return false;
  return null;
};

const getLightTextFromManifestForeground = (foreground: 'dark' | 'light' | undefined): boolean | null => {
  if (foreground === 'light') return true;
  if (foreground === 'dark') return false;
  return null;
};

const queryLastForegroundDeclaration = (
  root: ParentNode | null,
  attributeName: 'data-status-bar-foreground' | 'data-navigation-bar-foreground' | 'data-status-bar-hidden',
): HTMLElement | null => {
  if (!root) return null;
  if (root instanceof HTMLElement && root.hasAttribute(attributeName)) {
    return root;
  }
  const matches = root.querySelectorAll<HTMLElement>(`[${attributeName}]`);
  return matches.length > 0 ? matches[matches.length - 1] : null;
};

type ChromeTaskSnapshot = {
  activeTopActivityId: string | null;
  activeRootAppId: AppId | null;
  isLauncherVisible: boolean;
  isRecentsVisible: boolean;
};

const getChromeTaskSnapshot = (state: OSState): ChromeTaskSnapshot => {
  const activeTask = state.activeTaskId
    ? state.tasks.find((task) => task.taskId === state.activeTaskId) ?? null
    : null;
  return {
    activeTopActivityId: getActiveTopActivityId(state),
    activeRootAppId: activeTask?.rootAppId ?? null,
    isLauncherVisible: state.isLauncherVisible,
    isRecentsVisible: state.isRecentsVisible,
  };
};

const areChromeTaskSnapshotsEqual = (a: ChromeTaskSnapshot, b: ChromeTaskSnapshot): boolean => {
  return a.activeTopActivityId === b.activeTopActivityId
    && a.activeRootAppId === b.activeRootAppId
    && a.isLauncherVisible === b.isLauncherVisible
    && a.isRecentsVisible === b.isRecentsVisible;
};

function useTaskManagerSelector<T>(
  selector: (state: OSState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T {
  const cacheRef = useRef<T>(selector(TaskManager.getState()));
  const subscribe = useCallback((onStoreChange: () => void) => {
    return TaskManager.subscribe(() => onStoreChange());
  }, []);
  const getSnapshot = useCallback(() => {
    const next = selector(TaskManager.getState());
    if (isEqual(cacheRef.current, next)) return cacheRef.current;
    cacheRef.current = next;
    return next;
  }, [selector, isEqual]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

const getForegroundObserverTarget = (
  activeTopActivityId: string | null,
  isLauncherVisible: boolean,
  isRecentsVisible: boolean,
): ParentNode | null => {
  if (isLauncherVisible && !isRecentsVisible) {
    return document.querySelector('[data-launcher="true"]');
  }
  if (!activeTopActivityId) return null;
  return document.getElementById(`activity-container-${activeTopActivityId}`);
};

const getDeclaredForeground = (
  root: ParentNode | null,
  attributeName: 'data-status-bar-foreground' | 'data-navigation-bar-foreground',
): boolean | null => {
  return getLightTextFromDeclaredForeground(
    queryLastForegroundDeclaration(root, attributeName)?.getAttribute(attributeName),
  );
};

const getDeclaredHidden = (
  root: ParentNode | null,
  attributeName: 'data-status-bar-hidden',
): boolean => {
  const value = queryLastForegroundDeclaration(root, attributeName)?.getAttribute(attributeName);
  return value === 'true';
};


const StatusBar = () => {
  const {
    activeTopActivityId,
    activeRootAppId,
    isLauncherVisible,
    isRecentsVisible,
  } = useTaskManagerSelector(getChromeTaskSnapshot, areChromeTaskSnapshotsEqual);
  const { themeService, version } = useTheme();
  const [time, setTime] = useState(() => TimeService.formatTime());
  const [isLight, setIsLight] = useState(true); // true = white text, false = black text
  const [isHidden, setIsHidden] = useState(false);
  const [shadeOpen, setShadeOpen] = useState(SystemShadeService.getState().open);
  const [themedIconTick, setThemedIconTick] = useState(0);
  const [qs, setQs] = useState(() => QuickSettingsService.getState());
  const [dyn, setDyn] = useState(() => StatusBarService.getState());

  useEffect(() => {
    let active = true;
    const updateTime = () => {
      if (active) setTime(TimeService.formatTime());
    };
    // A benchmark reset can move the clock between polls. Reflect TIME_SET
    // before the next rendered screenshot instead of displaying the old time.
    const unsubscribeTimeSet = BroadcastBus.registerReceiver(ACTION_TIME_SET, updateTime);
    updateTime();
    const t = setInterval(updateTime, 1000);
    return () => {
      active = false;
      unsubscribeTimeSet();
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    return SystemShadeService.subscribe(s => setShadeOpen(s.open));
  }, []);

  useEffect(() => {
    return QuickSettingsService.subscribe(setQs);
  }, []);

  useEffect(() => {
    return StatusBarService.subscribe(setDyn);
  }, []);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      themeService.getStatusBarIconAsync('bluetooth'),
      themeService.getStatusBarIconAsync('signal'),
      themeService.getStatusBarIconAsync('wifi'),
      themeService.getStatusBarIconAsync('battery'),
    ])
      .then(() => {
        if (!cancelled) setThemedIconTick((x) => x + 1);
      })
      .catch(() => { });
    return () => {
      cancelled = true;
    };
  }, [themeService, version]);

  useEffect(() => {
    const detectChromeState = () => {
      const targetElement = getForegroundObserverTarget(
        activeTopActivityId,
        isLauncherVisible,
        isRecentsVisible,
      );
      setIsHidden(getDeclaredHidden(targetElement, 'data-status-bar-hidden'));
      const declaredLightText = getDeclaredForeground(targetElement, 'data-status-bar-foreground');
      if (declaredLightText !== null) {
        setIsLight(declaredLightText);
        return;
      }

      if (isRecentsVisible) {
        setIsLight(true);
        return;
      }

      if (!isLauncherVisible && activeRootAppId) {
        const activeManifest = getAppManifest(activeRootAppId);
        const manifestLightText = getLightTextFromManifestForeground(
          activeManifest?.theme.colors.statusBarForeground,
        );
        if (manifestLightText !== null) {
          setIsLight(manifestLightText);
          return;
        }
      }

      // 不再做 DOM 颜色采样；无声明时默认使用深色文字。
      setIsLight(false);
    };

    detectChromeState();

    const targetElement = getForegroundObserverTarget(
      activeTopActivityId,
      isLauncherVisible,
      isRecentsVisible,
    );

    let observer: MutationObserver | null = null;
    if (targetElement) {
      observer = new MutationObserver(() => {
        requestAnimationFrame(detectChromeState);
      });
      observer.observe(targetElement, {
        childList: true,
        attributes: true,
        subtree: true,
        attributeFilter: ['data-status-bar-foreground', 'data-status-bar-hidden'],
      });
    }

    return () => {
      observer?.disconnect();
    };
  }, [activeRootAppId, activeTopActivityId, isLauncherVisible, isRecentsVisible]);

  const textColor = isLight ? 'text-white' : 'text-black';

  // Themed status bar icons are PNGs with baked-in colors (usually white).
  // We apply a CSS filter to re-tint them to match the current textColor:
  //   brightness(0)  → forces all pixels to black
  //   invert(1)      → flips black → white  (only when we need white text)
  const iconTintFilter = isLight ? 'brightness(0) invert(1)' : 'brightness(0)';

  if (shadeOpen || isHidden) return null;

  const wifiVisible = qs.wifiEnabled;
  const btVisible = qs.bluetoothEnabled;
  const airplaneMode = qs.airplaneModeEnabled;
  const noSim = dyn.noSim;
  const signalVisible = !airplaneMode && !noSim;

  const vpnUrl = dyn.vpn ? themeService.getStatusBarIcon('vpn') : null;
  const alarmUrl = dyn.alarm ? themeService.getStatusBarIcon('alarm') : null;
  const headsetUrl = dyn.headset ? themeService.getStatusBarIcon('headset') : null;
  const silentUrl = dyn.silent ? themeService.getStatusBarIcon('silent') : null;
  const nfcUrl = qs.nfcEnabled ? themeService.getStatusBarIcon('nfc') : null;

  const airplaneUrl = airplaneMode ? themeService.getStatusBarIcon('airplane') : null;
  const noSimUrl = !airplaneMode && noSim
    ? themeService.getStatusBarIcon('no_sim') || themeService.getStatusBarIcon('signal_null')
    : null;

  const wifiUrl = wifiVisible ? themeService.getStatusBarWifiIcon(dyn.wifiLevel) : null;
  const signalUrl = signalVisible ? themeService.getStatusBarSignalIcon(dyn.signalLevel) : null;
  const dataTypeVisible =
    signalVisible && qs.mobileDataEnabled && dyn.mobileDataType !== 'none';
  const dataTypeUrl = dataTypeVisible ? themeService.getStatusBarDataTypeIcon(dyn.mobileDataType) : null;

  // ---- Battery rendering ----
  //
  // Priority hierarchy (theme-first, system-fallback):
  //   1. saver+charging → theme `power_save_charge` variant (if any) → render RGBA
  //   2. charging       → theme `charge` variant (if any) → render RGBA (bolt baked in)
  //   3. saver          → theme `power_save` variant (if any) → render RGBA
  //   4. fallback       → base sprite + system tint (mask-image), with bolt overlay
  //                       when charging, plus low-battery red when <20% & not charging.
  //
  // RGBA mode preserves theme designer's chosen color palette (which varies by
  // theme: AP15 ships saturated green for charging, 夜半 a darker forest green,
  // some themes choose teal or blue). Tint mode enforces a consistent system
  // visual when the theme didn't ship the matching variant.
  const baseSprite = themeService.getStatusBarBatterySprite();
  const lowBattery = !dyn.charging && dyn.batteryPercent < 20;

  let themeRgbaSprite: { url: string; frames: number; frameSide: number } | null = null;
  let rgbaHasBakedBolt = false;
  if (qs.batterySaverEnabled && dyn.charging) {
    // Saver wins for body color. Try the most specific variant (yellow + bolt
    // baked); else fall back to power_save (yellow body, bolt added separately
    // via overlay). DO NOT fall through to `charge` here — that would render
    // green and lose the saver indication.
    themeRgbaSprite = themeService.getStatusBarBatteryVariantSprite('power_save_charge');
    if (themeRgbaSprite) rgbaHasBakedBolt = true;
    if (!themeRgbaSprite) {
      themeRgbaSprite = themeService.getStatusBarBatteryVariantSprite('power_save');
    }
  } else if (dyn.charging) {
    themeRgbaSprite = themeService.getStatusBarBatteryVariantSprite('charge');
    if (themeRgbaSprite) rgbaHasBakedBolt = true;
  } else if (qs.batterySaverEnabled) {
    themeRgbaSprite = themeService.getStatusBarBatteryVariantSprite('power_save');
  }

  const batterySprite = themeRgbaSprite ?? baseSprite;
  const batteryFallback = themeService.getStatusBarIcon('battery');

  const batteryPct = Math.min(Math.max(dyn.batteryPercent, 0), 100);
  const batteryFrames = batterySprite?.frames ?? 0;
  const batteryFrameIdx =
    batterySprite && batteryFrames > 1
      ? Math.min(
        Math.max(Math.floor(((batteryFrames - 1) * batteryPct) / 100), 0),
        batteryFrames - 1
      )
      : 0;

  // System-tint mode only — color used when we fall back to alpha-mask + bg.
  const systemTintColor = qs.batterySaverEnabled
    ? '#F5C518' // saver yellow
    : dyn.charging
      ? '#22C55E' // charging green (普通充电也变绿)
      : lowBattery
        ? '#EF4444' // low battery red
        : isLight
          ? '#FFFFFF'
          : '#000000';

  // Charging bolt overlay: needed when charging AND the body-rendering layer
  // doesn't already have a bolt baked in. So:
  //   - tint mode + charging         → overlay needed
  //   - rgba `charge`/`power_save_charge` variant → bolt baked, no overlay
  //   - rgba `power_save` (saver+charging fallback) → overlay needed (yellow body, no bolt)
  const useThemeRgba = themeRgbaSprite !== null;
  const needsBoltOverlay = dyn.charging && !rgbaHasBakedBolt;
  const batteryBoltUrl = needsBoltOverlay
    ? themeService.getStatusBarBatteryBoltOverlay()
    : null;
  // 快充叠一层更深的内核 + 略大的 halo，让闪电在 25% 这种小填充态也清晰可见。
  const batteryBoltCoreColor = dyn.fastCharging ? 'rgba(0,0,0,0.92)' : 'rgba(0,0,0,0.78)';
  const batteryBoltHaloColor = systemTintColor;

  return (
    <div
      className={`absolute top-0 w-full flex justify-between items-center px-6 ${textColor} text-[13px] font-medium pointer-events-none transition-colors`}
      style={{
        height: `${statusBarHeight}px`,
        zIndex: zIndexStatusBar,
        transitionDuration: `${transitionDuration}ms`
      }}
    >
      <div>{time}</div>
      <div className="flex items-center gap-1.5">
        {vpnUrl ? (
          <img
            key={`vpn_${version}_${themedIconTick}`}
            src={vpnUrl}
            className="w-[14px] h-[14px] object-contain transition-[filter]"
            style={{ filter: iconTintFilter }}
            alt="vpn"
          />
        ) : null}

        {alarmUrl ? (
          <img
            key={`alarm_${version}_${themedIconTick}`}
            src={alarmUrl}
            className="w-[14px] h-[14px] object-contain transition-[filter]"
            style={{ filter: iconTintFilter }}
            alt="alarm"
          />
        ) : null}

        {headsetUrl ? (
          <img
            key={`headset_${version}_${themedIconTick}`}
            src={headsetUrl}
            className="w-[14px] h-[14px] object-contain transition-[filter]"
            style={{ filter: iconTintFilter }}
            alt="headset"
          />
        ) : null}

        {silentUrl ? (
          <img
            key={`silent_${version}_${themedIconTick}`}
            src={silentUrl}
            className="w-[14px] h-[14px] object-contain transition-[filter]"
            style={{ filter: iconTintFilter }}
            alt="silent"
          />
        ) : null}

        {nfcUrl ? (
          <img
            key={`nfc_${version}_${themedIconTick}`}
            src={nfcUrl}
            className="w-[14px] h-[14px] object-contain transition-[filter]"
            style={{ filter: iconTintFilter }}
            alt="nfc"
          />
        ) : null}

        {btVisible ? (
          themeService.getStatusBarIcon('bluetooth') ? (
            <img
              key={`bt_${version}_${themedIconTick}`}
              src={themeService.getStatusBarIcon('bluetooth')!}
              className="w-[14px] h-[14px] object-contain transition-[filter]"
              style={{ filter: iconTintFilter }}
              alt="bluetooth"
            />
          ) : (
            <Bluetooth size={14} />
          )
        ) : null}

        {airplaneMode ? (
          airplaneUrl ? (
            <img
              key={`airplane_${version}_${themedIconTick}`}
              src={airplaneUrl}
              className="w-[14px] h-[14px] object-contain transition-[filter]"
              style={{ filter: iconTintFilter }}
              alt="airplane"
            />
          ) : (
            <Plane size={14} />
          )
        ) : noSim ? (
          noSimUrl ? (
            <img
              key={`no_sim_${version}_${themedIconTick}`}
              src={noSimUrl}
              className="w-[14px] h-[14px] object-contain transition-[filter]"
              style={{ filter: iconTintFilter }}
              alt="no-sim"
            />
          ) : null
        ) : signalUrl ? (
          <img
            key={`signal_${dyn.signalLevel}_${version}_${themedIconTick}`}
            src={signalUrl}
            className="w-[14px] h-[14px] object-contain transition-[filter]"
            style={{ filter: iconTintFilter }}
            alt="signal"
          />
        ) : (
          <Signal size={14} />
        )}

        {dataTypeUrl ? (
          <img
            key={`data_${dyn.mobileDataType}_${version}_${themedIconTick}`}
            src={dataTypeUrl}
            className="w-[14px] h-[14px] object-contain transition-[filter]"
            style={{ filter: iconTintFilter }}
            alt={`data-${dyn.mobileDataType}`}
          />
        ) : null}

        {wifiVisible ? (
          wifiUrl ? (
            <img
              key={`wifi_${dyn.wifiLevel}_${version}_${themedIconTick}`}
              src={wifiUrl}
              className="w-[14px] h-[14px] object-contain transition-[filter]"
              style={{ filter: iconTintFilter }}
              alt="wifi"
            />
          ) : (
            <Wifi size={14} />
          )
        ) : null}

        <span className="text-[11px] leading-none">{batteryPct}%</span>

        {batterySprite ? (
          // Two render modes:
          //   - useThemeRgba: render the variant sprite directly via background-image
          //     (theme color baked into RGB). Bolt is pre-baked in `_charge` variants.
          //   - else: alpha-mask + system tint color, plus optional bolt overlay
          //     when charging.
          <div
            key={`battery_${batteryPct}_${dyn.charging ? 1 : 0}_${dyn.fastCharging ? 1 : 0}_${qs.batterySaverEnabled ? 1 : 0}_${useThemeRgba ? 'r' : 't'}_${version}_${themedIconTick}`}
            className="relative w-[20px] h-[20px]"
            aria-label="battery"
          >
            {useThemeRgba ? (
              <div
                className="absolute inset-0 bg-no-repeat"
                style={{
                  backgroundImage: `url(${batterySprite.url})`,
                  backgroundSize: `20px ${batteryFrames * 20}px`,
                  backgroundPosition: `0px ${-batteryFrameIdx * 20}px`,
                }}
              />
            ) : (
              <div
                className="absolute inset-0"
                style={{
                  backgroundColor: systemTintColor,
                  WebkitMaskImage: `url(${batterySprite.url})`,
                  maskImage: `url(${batterySprite.url})`,
                  WebkitMaskSize: `20px ${batteryFrames * 20}px`,
                  maskSize: `20px ${batteryFrames * 20}px`,
                  WebkitMaskPosition: `0px ${-batteryFrameIdx * 20}px`,
                  maskPosition: `0px ${-batteryFrameIdx * 20}px`,
                  WebkitMaskRepeat: 'no-repeat',
                  maskRepeat: 'no-repeat',
                }}
              />
            )}
            {batteryBoltUrl ? (
              <>
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: batteryBoltHaloColor,
                    WebkitMaskImage: `url(${batteryBoltUrl})`,
                    maskImage: `url(${batteryBoltUrl})`,
                    WebkitMaskSize: '22px 22px',
                    maskSize: '22px 22px',
                    WebkitMaskPosition: '-1px -1px',
                    maskPosition: '-1px -1px',
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundColor: batteryBoltCoreColor,
                    WebkitMaskImage: `url(${batteryBoltUrl})`,
                    maskImage: `url(${batteryBoltUrl})`,
                    WebkitMaskSize: '20px 20px',
                    maskSize: '20px 20px',
                    WebkitMaskRepeat: 'no-repeat',
                    maskRepeat: 'no-repeat',
                  }}
                  aria-label="battery-charging"
                />
              </>
            ) : null}
          </div>
        ) : batteryFallback ? (
          <img
            key={`battery_${version}_${themedIconTick}`}
            src={batteryFallback}
            className="w-[20px] h-[20px] object-contain transition-[filter]"
            style={{ filter: iconTintFilter }}
            alt="battery"
          />
        ) : (
          <BatteryMedium size={20} fill="currentColor" />
        )}
      </div>
    </div>
  );
};

type WindowDragPreview = { direction: 'split' | 'floating'; progress: number; dxRatio: number; upRatio: number; taskId: string | null } | null;
const GestureBar = ({ onWindowGesture, onPreview }: {
  onWindowGesture: (mode: 'split' | 'floating') => void; onPreview: (preview: WindowDragPreview) => void;
}) => {
  const t = useOsT();
  const {
    activeTopActivityId,
    activeRootAppId,
    isLauncherVisible,
    isRecentsVisible,
  } = useTaskManagerSelector(getChromeTaskSnapshot, areChromeTaskSnapshotsEqual);
  const barRef = useRef<HTMLDivElement | null>(null);
  const pointer = useRef<{ id: number; x: number; y: number; time: number; width: number; height: number; held: boolean; task: string | null } | null>(null);
  const [swipeProgress, setSwipeProgress] = useState(0);
  const holdTimerRef = useRef<number | null>(null);
  // 检测背景颜色：桌面/多任务 或 声明式属性（限定在当前活跃应用内查找）
  const getActiveActivityContainer = () => activeTopActivityId
    ? document.getElementById(`activity-container-${activeTopActivityId}`)
    : null;

  const getIsOnDarkBg = () => {
    if (isLauncherVisible || isRecentsVisible) return true;
    const container = getActiveActivityContainer();
    const activeManifest = activeRootAppId ? getAppManifest(activeRootAppId) : undefined;

    // 1. 优先检查 data-navigation-bar-foreground（底部独立前景信号）
    const declaredNavLight = getDeclaredForeground(container, 'data-navigation-bar-foreground');
    if (declaredNavLight !== null) return declaredNavLight;

    // 2. 优先使用 app 级 navigationBar 默认值，再回退到共享的 status bar 信号
    const manifestNavLight = getLightTextFromManifestForeground(
      activeManifest?.theme.colors.navigationBarForeground,
    );
    if (manifestNavLight !== null) return manifestNavLight;

    // 3. 再回退到 status bar 声明（顶底共享信号）
    const declaredLight = getDeclaredForeground(container, 'data-status-bar-foreground');
    if (declaredLight !== null) return declaredLight;

    // 4. Final semantic fallback: reuse status bar manifest when nav is unspecified.
    const manifestStatusLight = getLightTextFromManifestForeground(
      activeManifest?.theme.colors.statusBarForeground,
    );
    if (manifestStatusLight !== null) return manifestStatusLight;

    return false;
  };

  const [isOnDarkBg, setIsOnDarkBg] = useState(getIsOnDarkBg);

  // 仅在关键状态变化时重新检测（延迟一帧，确保新页面 DOM 已渲染）
  useEffect(() => {
    requestAnimationFrame(() => {
      setIsOnDarkBg(getIsOnDarkBg());
    });
  }, [isLauncherVisible, isRecentsVisible, activeTopActivityId, activeRootAppId]);

  // 监听属性变化及子节点变化（应用内路由切换会替换子组件）
  useEffect(() => {
    if (!activeTopActivityId || isLauncherVisible || isRecentsVisible) return;

    const activityContainer = document.getElementById(`activity-container-${activeTopActivityId}`);
    if (!activityContainer) return;

    const redetect = () => requestAnimationFrame(() => {
      setIsOnDarkBg(getIsOnDarkBg());
    });

    const observer = new MutationObserver(redetect);

    observer.observe(activityContainer, {
      attributes: true,
      attributeFilter: ['data-status-bar-foreground', 'data-navigation-bar-foreground'],
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [activeTopActivityId, isLauncherVisible, isRecentsVisible, activeRootAppId]);

  const barOpacity = isOnDarkBg ? gestureBarOpacityLight : gestureBarOpacityDark;
  const barColor = isOnDarkBg ? 'white' : 'black';

  const clearHold = useCallback(() => {
    if (holdTimerRef.current !== null) window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = null;
  }, []);
  const cancelGesture = useCallback(() => {
    clearHold();
    pointer.current = null;
    setSwipeProgress(0);
    onPreview(null);
    if (barRef.current) {
      delete barRef.current.dataset.windowGesture;
      delete barRef.current.dataset.windowHint;
    }
  }, [clearHold, onPreview]);
  useEffect(() => {
    const cancel = () => cancelGesture();
    window.addEventListener('blur', cancel);
    window.addEventListener('foldagent:posturechange', cancel);
    return () => {
      clearHold();
      onPreview(null);
      window.removeEventListener('blur', cancel);
      window.removeEventListener('foldagent:posturechange', cancel);
    };
  }, [cancelGesture, clearHold, onPreview]);

  useEffect(() => { cancelGesture(); }, [activeTopActivityId, cancelGesture]);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!e.isPrimary || e.button !== 0 || SystemShadeService.isOpen()) return;
    const rect = e.currentTarget.parentElement!.getBoundingClientRect();
    pointer.current = { id: e.pointerId, x: e.clientX, y: e.clientY, time: TimeService.realNow(),
      width: rect.width, height: rect.height, held: false, task: TaskManager.getState().activeTaskId };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = pointer.current;
    if (!start || start.id !== e.pointerId) return;
    const up = start.y - e.clientY, dx = e.clientX - start.x;
    const mode = classifyBottomGesture(dx, up, start.width, start.height, window.__FOLDAGENT__?.getState().posture === 'unfolded');
    e.currentTarget.dataset.windowGesture = mode;
    e.currentTarget.dataset.windowHint = mode === 'split' ? t('松开选择分屏应用') : mode === 'floating' ? t('松开进入悬浮窗') : '';
    const previewMode = previewBottomGesture(dx, up, start.width, start.height, window.__FOLDAGENT__?.getState().posture === 'unfolded');
    const latest = TaskManager.getState();
    onPreview(previewMode === 'vertical' || !start.task || latest.isLauncherVisible || latest.isRecentsVisible ? null
      : { direction: previewMode, progress: Math.min(1, up / 240),
        dxRatio: dx / start.width, upRatio: up / start.height, taskId: start.task });
    setSwipeProgress(Math.min(Math.max(up / gestureProgressDivisor, 0), 1));
    // A diagonal drag never also opens Recents. Holding a straight swipe still does.
    if (previewMode !== 'vertical' || Math.abs(dx) > 38 || up < homeSwipeThreshold) clearHold();
    else if (holdTimerRef.current === null && !start.held) {
      holdTimerRef.current = window.setTimeout(() => {
        if (pointer.current !== start || TaskManager.getState().activeTaskId !== start.task) return;
        start.held = true;
        window.__OS__?.showRecents();
        holdTimerRef.current = null;
      }, recentsHoldDuration);
    }
  };
  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = pointer.current;
    if (!start || start.id !== e.pointerId) return;
    const up = start.y - e.clientY, dx = e.clientX - start.x;
    const mode = classifyBottomGesture(dx, up, start.width, start.height, window.__FOLDAGENT__?.getState().posture === 'unfolded');
    cancelGesture();
    delete e.currentTarget.dataset.windowGesture;
    const latest = TaskManager.getState();
    if (start.held || latest.activeTaskId !== start.task || latest.isRecentsVisible || latest.isLauncherVisible) return;
    if (mode !== 'vertical') onWindowGesture(mode);
    else if (up > homeSwipeThreshold && Math.abs(dx) < 60 && TimeService.realNow() - start.time < recentsHoldDuration) window.__OS__?.goHome();
  };

  // 在App内时，减小触摸区域避免遮挡TabBar
  const isInApp = activeTopActivityId !== null && !isLauncherVisible && !isRecentsVisible;
  const touchAreaHeight = isInApp ? bottomGestureHeight : bottomGestureHeight * 2;

  return (
    <div
      ref={barRef}
      className="absolute bottom-0 w-full flex justify-center items-end pb-1"
      data-gesture-bar="true"
      style={{
        zIndex: zIndexGestureBar,
        touchAction: 'none',
        height: `${touchAreaHeight}px`
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={cancelGesture}
      onLostPointerCapture={cancelGesture}
    >
      <div
        className="rounded-full pointer-events-none"
        style={{
          width: `${gestureBarWidth}px`,
          height: `${gestureBarHeight}px`,
          backgroundColor: barColor,
          opacity: barOpacity,
          transform: `scaleX(${1 + swipeProgress * gestureProgressScale})`,
          transitionDuration: `${transitionDuration}ms`,
        }}
      />
    </div>
  );
};

// Samsung three-button navigation. The reference photo uses the optional
// Back–Home–Recents order, positioned at the lower right of the main screen.
const SamsungNavigationButtons = () => {
  const { goHome, showRecents } = useOS();
  return (
    <nav className="foldagent-samsung-nav-buttons" aria-label="系统导航">
      <button type="button" aria-label="返回" onClick={() => window.__OS__?.handleBack()}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15.5 4.5 8 12l7.5 7.5" /></svg>
      </button>
      <button type="button" aria-label="主页" onClick={goHome}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="6.25" /></svg>
      </button>
      <button type="button" aria-label="最近任务" onClick={showRecents}>
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5v14M12 5v14M18 5v14" /></svg>
      </button>
    </nav>
  );
};
// 侧边返回手势
/**
 * Isolates keyboard-height subscription so that SystemShell (and all mounted
 * apps) do NOT re-render when the keyboard opens/closes.  Only this thin
 * wrapper re-renders; its `children` reference stays stable because the
 * parent (SystemShell) didn't re-render, so React skips the subtree.
 */
const AdjustResizeContainer: React.FC<{ isActive: boolean; splitResize?: boolean; floatingResize?: boolean; children: React.ReactNode }> = ({ isActive, splitResize, floatingResize, children }) => {
  const resizeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isActive) return;
    const root = resizeRef.current;
    if (root) return prioritizeVisibleActivityImages(root);
  }, [isActive]);
  const subscribe = isActive ? KeyboardService.subscribe : noopSubscribe;
  const getSnapshot = isActive ? getKeyboardHeightSnapshot : getZeroSnapshot;
  const kbHeight = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getZeroSnapshot,
  );
  React.useLayoutEffect(() => {
    if (!floatingResize) return;
    const frame = resizeRef.current?.closest<HTMLElement>('[data-foldagent-pane="floating"]');
    if (!frame) return;
    // Accommodate the keyboard in the compositor frame, not by subtracting its
    // entire height again inside an already smaller floating application.
    frame.style.setProperty('--os-floating-keyboard-height', `${kbHeight}px`);
    return () => { frame.style.removeProperty('--os-floating-keyboard-height'); };
  }, [floatingResize, kbHeight]);

  return (
    <div
      ref={resizeRef}
      data-adjust-resize
      {...(isActive && kbHeight > 0 ? { 'data-keyboard-active': '' } : {})}
      style={
        isActive && kbHeight > 0 && !splitResize && !floatingResize
          ? { width: '100%', height: `calc(100% - ${kbHeight}px)`, overflow: 'hidden' }
          : { width: '100%', height: '100%' }
      }
    >
      {children}
    </div>
  );
};

/**
 * Memoized activity content — prevents app component trees from re-rendering
 * when SystemShell re-renders due to OS state changes (task switch, recents,
 * brightness, etc.). Only re-renders when the activity identity or viewport
 * actually changes.  Also memoizes the ActivityContext value to avoid
 * unnecessary consumer re-renders.
 */
const MemoizedActivityContent = React.memo<{
  activityId: string;
  appId: AppId;
  taskId: string;
  viewportWidth: number;
}>(({ activityId, appId, taskId, viewportWidth }) => {
  const ctxValue = useMemo(
    () => ({ activityId, appId, taskId }),
    [activityId, appId, taskId],
  );

  const manifest = getAppManifest(appId);
  const designWidth = manifest?.designViewportWidth ?? viewportWidth;
  // Real foldables let apps reflow on larger windows. Scale only when a split
  // pane is narrower than the app's minimum design canvas; never magnify a
  // phone layout across the entire inner display.
  const contentScale = designWidth > 0 ? Math.min(1, viewportWidth / designWidth) : 1;
  const needsZoom = contentScale < 1;

  return (
    <ActivityContext.Provider value={ctxValue}>
      <div
        className="foldagent-activity-surface"
        data-adaptive-width={viewportWidth >= 600 ? 'expanded' : viewportWidth >= 480 ? 'medium' : 'compact'}
        style={{
          '--os-activity-content-scale': contentScale,
          ...(needsZoom ? {
            transform: `scale(${contentScale})`,
            transformOrigin: 'top left',
            width: `${100 / contentScale}%`,
            height: `${100 / contentScale}%`,
          } : { width: '100%', height: '100%' }),
        } as React.CSSProperties & { '--os-activity-content-scale': number }}
      >
        {renderAppContent(appId)}
      </div>
    </ActivityContext.Provider>
  );
});

export const SystemShell: React.FC = () => {
  const t = useOsT();
  const { state, launchApp, launchTaskById, intentChooser, chooseIntentActivity, cancelIntentChooser } = useOS();
  // FoldAgent changes the simulated physical display outside of React. Keep
  // app-level design-viewport adaptation in sync with that device change.
  const [foldableDevice, setFoldableDevice] = useState(() => window.__FOLDAGENT__?.getState());
  const [splitTasks, setSplitTasks] = useState<{ primary: string; secondary: string; tertiary?: string } | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const workspaceRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Divide the space above the keyboard between all split panes. Subtracting
    // a whole keyboard from just the bottom pane can erase its editor entirely.
    const sync = () => workspaceRef.current?.style.setProperty('--os-split-keyboard-height', `${getKeyboardHeightSnapshot()}px`);
    sync();
    return KeyboardService.subscribe(sync);
  }, []);
  const [splitCandidate, setSplitCandidate] = useState<string | null>(null);
  const [windowPreview, setWindowPreview] = useState<WindowDragPreview>(null);
  const [floatingBackground, setFloatingBackground] = useState<string | null>(null);
  const floating = foldableDevice?.multi_window.mode === 'floating' ? foldableDevice.multi_window.floating : undefined;
  const [secondarySplitRatio, setSecondarySplitRatio] = useState(0.5);
  const [splitDropTaskId, setSplitDropTaskId] = useState<string | null>(null);
  const [edgePanelOpen, setEdgePanelOpen] = useState(false);
  const splitDragRef = useRef<{ pointerId: number; origin: number; size: number; stacked: boolean } | null>(null);
  const horizontalSplitDragRef = useRef<{ pointerId: number; top: number; height: number } | null>(null);
  const foldableViewportWidth = foldableDevice?.displays[foldableDevice.active_display].width ?? fwViewportWidth ?? 360;
  const isUnfolded = foldableDevice?.posture === 'unfolded';
  const isStackedSplit = !!splitTasks && !splitTasks.tertiary && (
    (foldableDevice?.multi_window.split_orientation ?? splitOrientationForPosture(
      foldableDevice?.posture ?? 'unfolded', foldableDevice?.multi_window.unfolded_split_orientation)) === 'stacked'
  );
  // Benchmark canvas mode keeps App content unobstructed; no bottom overlay in an open App.
  const showInAppTaskbar = false;
  const skin = useSyncExternalStore(SkinService.subscribe, SkinService.getState, SkinService.getState);
  const skinImageFilter = skin.imageFilter;
  const activeTopActivityId = getActiveTopActivityId(state);
  const tasksMRU = useMemo(() => getTasksMRU(state.tasks), [state.tasks]);
  const isFoldInner = typeof document !== 'undefined' && document.documentElement.dataset.foldagentDisplay === 'inner';
  const cardWidth = isFoldInner ? 236 : recentsCardWidth;
  const cardHeight = isFoldInner ? 430 : recentsCardHeight;
  const cardGap = isFoldInner ? 16 : recentsCardGap;
  const scrollHeight = isFoldInner ? 500 : recentsScrollContainerHeight;
  const topPadding = isFoldInner ? 130 : recentsTopPadding;
  const edgePanelApps = useMemo(() => {
    const preferred = ['wechat', 'map', 'alipay', 'ebay', 'wechat_reading', 'tencent_meeting'];
    return preferred.map(id => APP_REGISTRY.find(app => app.id === id)).filter((app): app is NonNullable<typeof app> => !!app);
  }, []);
  // One UI keeps favourite apps first and optionally appends a small recent-app section.
  // This is a system strip, not a floating quick-launch window.
  const taskbarEntries = useMemo(() => {
    const pinnedIds = new Set(edgePanelApps.map(app => app.id));
    const recent = tasksMRU
      .map(task => getAppManifest(task.rootAppId))
      .filter((app): app is NonNullable<typeof app> => !!app && !pinnedIds.has(app.id))
      .slice(0, 2);
    return [
      ...edgePanelApps.map(manifest => ({ manifest, kind: 'pinned' as const })),
      ...recent.map(manifest => ({ manifest, kind: 'recent' as const })),
    ];
  }, [edgePanelApps, tasksMRU]);
  const recentsSlotByTaskId = useMemo(() => {
    const map = new Map<string, { index: number }>();
    tasksMRU.forEach((task, index) => map.set(task.taskId, { index }));
    return map;
  }, [tasksMRU]);
  const allActivities = useMemo(() => (
    state.tasks.flatMap(task => task.stack.map((activity, index) => ({
      ...activity,
      taskId: task.taskId,
      rootAppId: task.rootAppId,
      isTaskTop: index === task.stack.length - 1,
    })))
  ), [state.tasks]);

  const themeVarsByApp = useMemo(() => {
    const map: Record<string, Record<string, string>> = {};
    for (const activity of allActivities) {
      if (map[activity.appId]) continue;
      const manifest = getAppManifest(activity.appId);
      const colors = manifest ? SkinService.applySkinToThemeColors(manifest.theme.colors) : null;
      map[activity.appId] = colors ? themeToCssVars(colors) : {};
    }
    return map;
  }, [allActivities, skin]);

  // 初始化滚动状态观测 API
  useEffect(() => {
    initScrollMeta();
    initSimInput();
  }, []);

  useEffect(() => {
    const syncFoldableViewport = () => {
      const device = window.__FOLDAGENT__?.getState();
      if (device) {
        setFoldableDevice(device);
        splitDragRef.current = null;
        horizontalSplitDragRef.current = null;
        if (device.multi_window.mode !== 'split' && device.posture === 'folded') setSplitTasks(null);
      }
    };
    window.addEventListener('foldagent:posturechange', syncFoldableViewport);
    return () => window.removeEventListener('foldagent:posturechange', syncFoldableViewport);
  }, []);

  useEffect(() => {
    const syncMultiWindow = () => {
      const device = window.__FOLDAGENT__?.getState();
      setFoldableDevice(device);
      const multi = device?.multi_window;
      if (multi?.mode !== 'fullscreen' && multi?.primary_task_id && multi.secondary_task_id) {
        setSplitTasks({
          primary: multi.primary_task_id,
          secondary: multi.secondary_task_id,
          tertiary: multi.mode === 'triple' ? multi.tertiary_task_id ?? undefined : undefined,
        });
        setSplitRatio(multi.divider_ratio);
        setSecondarySplitRatio(multi.secondary_split_ratio ?? 0.5);
      } else {
        setSplitTasks(null);
      }
    };
    syncMultiWindow();
    window.addEventListener('foldagent:windowchange', syncMultiWindow);
    return () => window.removeEventListener('foldagent:windowchange', syncMultiWindow);
  }, []);

  // System chooser is a volatile OS surface, not an application-owned route.
  useEffect(() => {
    if (!splitCandidate) return;
    return BackDispatcher.register('window.splitPicker', () => { setSplitCandidate(null); return true; }, 650);
  }, [splitCandidate]);
  useEffect(() => {
    if (state.isLauncherVisible || !floating) setFloatingBackground(null);
    else if (state.activeTaskId && state.activeTaskId !== floating.task_id) setFloatingBackground(state.activeTaskId);
    if (splitCandidate && (!isUnfolded || state.isLauncherVisible || state.isRecentsVisible
      || state.activeTaskId !== splitCandidate || !state.tasks.some(task => task.taskId === splitCandidate))) setSplitCandidate(null);
    if (floating && !state.tasks.some(task => task.taskId === floating.task_id)) window.__FOLDAGENT__?.setMultiWindow('fullscreen');
    if (splitTasks && !state.isLauncherVisible && !state.isRecentsVisible && state.activeTaskId
      && ![splitTasks.primary, splitTasks.secondary, splitTasks.tertiary].includes(state.activeTaskId)) window.__FOLDAGENT__?.setMultiWindow('fullscreen');
  }, [splitCandidate, isUnfolded, state, floating, splitTasks]);

  const beginWindowGesture = (mode: 'split' | 'floating') => {
    const latest = TaskManager.getState();
    if (!latest.activeTaskId || latest.isLauncherVisible || latest.isRecentsVisible) return;
    document.activeElement instanceof HTMLElement && document.activeElement.blur();
    KeyboardService.hide();
    setEdgePanelOpen(false);
    setSplitDropTaskId(null);
    setSplitTasks(null);
    window.__FOLDAGENT__?.setMultiWindow('fullscreen');
    if (mode === 'split' && isUnfolded) setSplitCandidate(latest.activeTaskId);
    else if (mode === 'floating') {
      setSplitCandidate(null);
      window.__FOLDAGENT__?.setFloatingWindow(latest.activeTaskId, isUnfolded ? undefined : { x: 0.1, y: 0.09, width: 0.82, height: 0.68 });
      // The recording reveals the desktop under the shrinking application.
      window.__OS__?.goHome();
    }
  };
  const chooseSplitApp = (appId: string) => {
    const latest = TaskManager.getState();
    const source = latest.tasks.find(task => task.taskId === splitCandidate);
    if (!source || latest.activeTaskId !== splitCandidate || !isUnfolded
      || !APP_REGISTRY.some(app => app.id === appId)) return;
    if (appId === source.rootAppId) { setSplitCandidate(null); return; }
    launchApp(appId);
    const target = TaskManager.getState().tasks.find(task => task.rootAppId === appId);
    if (!target) return;
    setSplitCandidate(null);
    window.__FOLDAGENT__?.setMultiWindow('split', source.taskId, target.taskId, 0.5);
  };
  const updateFloating = (bounds: FloatingBounds, minimized = false) => {
    if (floating) window.__FOLDAGENT__?.setFloatingWindow(floating.task_id, bounds, minimized);
  };
  const maximizeFloating = () => {
    if (!floating) return;
    window.__FOLDAGENT__?.setMultiWindow('fullscreen');
    launchTaskById(floating.task_id);
  };
  const dismissFloating = () => {
    if (!floating) return;
    window.__FOLDAGENT__?.setMultiWindow('fullscreen');
    if (floatingBackground && state.tasks.some(task => task.taskId === floatingBackground)) launchTaskById(floatingBackground);
    else if (state.activeTaskId === floating.task_id) window.__OS__?.goHome();
  };

  // 启用全局长按检测（剪贴板菜单）
  useGlobalLongPress();

  // Android-like: hide system selection menu on major OS UI transitions
  useEffect(() => {
    TextSelectionService.hideSelectionMenu();
  }, [activeTopActivityId, state.isLauncherVisible, state.isRecentsVisible]);

  useEffect(() => {
    if (!splitTasks) return;
    const valid = new Set(state.tasks.map(task => task.taskId));
    if ([splitTasks.primary, splitTasks.secondary, splitTasks.tertiary].filter(Boolean).some(taskId => !valid.has(taskId!))) {
      setSplitTasks(null);
      window.__FOLDAGENT__?.setMultiWindow('fullscreen');
    }
  }, [splitTasks, state.tasks]);

  const exitMultiWindow = useCallback((preferredTaskId?: string) => {
    const validTaskIds = new Set(state.tasks.map(task => task.taskId));
    const keepTaskId = [
      preferredTaskId,
      state.activeTaskId,
      splitTasks?.primary,
      splitTasks?.secondary,
      splitTasks?.tertiary,
    ].find((taskId): taskId is string => !!taskId && validTaskIds.has(taskId));
    setSplitTasks(null);
    setSplitDropTaskId(null);
    window.__FOLDAGENT__?.setMultiWindow('fullscreen');
    if (!keepTaskId) {
      window.__OS__?.goHome();
      return;
    }
    launchTaskById(keepTaskId);
    window.setTimeout(() => {
      window.__OS__?.launchTaskById(keepTaskId);
      window.setTimeout(() => {
        const hasVisibleActivity = Array.from(document.querySelectorAll<HTMLElement>('[data-app-id]')).some(element => {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) > 0 && rect.width > 1 && rect.height > 1;
        });
        if (hasVisibleActivity) return;
        const latest = window.__OS__?.state;
        const fallbackTask = latest?.tasks?.find(task => task.taskId === keepTaskId) ?? latest?.tasks?.[latest.tasks.length - 1];
        if (fallbackTask) window.__OS__?.launchTaskById(fallbackTask.taskId);
        else window.__OS__?.goHome();
      }, 80);
    }, 0);
  }, [launchTaskById, splitTasks, state.activeTaskId, state.tasks]);

  const startSplitWithTask = useCallback((taskId: string, side: 'primary' | 'secondary' = 'secondary') => {
    if (!isUnfolded || !state.activeTaskId) return;
    if (splitTasks) {
      const occupied = [splitTasks.primary, splitTasks.secondary, splitTasks.tertiary];
      if (occupied.includes(taskId) || splitTasks.tertiary) return;
      const next = { ...splitTasks, tertiary: taskId };
      setSplitTasks(next);
      setSecondarySplitRatio(0.5);
      setSplitDropTaskId(null);
      window.__FOLDAGENT__?.setMultiWindow('triple', next.primary, next.secondary, splitRatio, taskId, 0.5);
      return;
    }
    if (state.activeTaskId === taskId) return;
    const next = side === 'primary'
      ? { primary: taskId, secondary: state.activeTaskId }
      : { primary: state.activeTaskId, secondary: taskId };
    setSplitTasks(next);
    setSplitRatio(0.5);
    setSplitDropTaskId(null);
    window.__FOLDAGENT__?.setMultiWindow('split', next.primary, next.secondary, 0.5);
  }, [isUnfolded, splitRatio, splitTasks, state.activeTaskId]);

  const displayScale: number = SIMULATOR_CONFIG.display.scale ?? 1;
  const viewportWidth: number = foldableViewportWidth;

  return (
    <div className="w-full h-full overflow-hidden bg-black font-sans select-none">
      <SystemErrorBoundary
        componentName="SystemShell"
        fallback={
          <div className="w-full h-full flex items-center justify-center bg-black text-white">
            <div className="text-center">
              <div className="text-lg mb-2">系统出现问题</div>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-white/20 rounded-lg"
              >
                刷新
              </button>
            </div>
          </div>
        }
      >
        <div
          className="relative w-full h-full"
          ref={workspaceRef}
          style={displayScale !== 1 ? { zoom: displayScale } : undefined}
        >
        <DeviceEffects />
        <SystemErrorBoundary componentName="StatusBar">
          <StatusBar />
        </SystemErrorBoundary>
        <TopEdgeShadeGestureCatcher />

        {/* Screens Layer — 仅 Launcher */}
        <div className={splitCandidate || windowPreview ? 'os-window-selection-desktop' : 'h-full w-full'}
          data-window-picker={splitCandidate ? 'split' : undefined}
          data-window-desktop={splitCandidate || windowPreview ? 'true' : undefined}
          data-window-preview={windowPreview?.direction}
          inert={!!windowPreview && !splitCandidate || undefined}
        >
          {(state.isLauncherVisible || state.isRecentsVisible || !!floating || !!splitCandidate || !!windowPreview) && (
            <SystemErrorBoundary componentName="Launcher">
              <Launcher splitSelection={splitCandidate ? { onChoose: chooseSplitApp, onCancel: () => setSplitCandidate(null) } : undefined} />
            </SystemErrorBoundary>
          )}
        </div>

        {/* Activity containers — 支持同一 App 在不同 Task 中多实例 */}
        {allActivities.map(activity => {
          const splitPane = splitTasks?.primary === activity.taskId
            ? 'primary'
            : splitTasks?.secondary === activity.taskId
              ? 'secondary'
              : splitTasks?.tertiary === activity.taskId ? 'tertiary' : null;
          const isSplitTop = !!splitPane && activity.isTaskTop && !state.isLauncherVisible && !state.isRecentsVisible;
          const isPendingSplit = splitCandidate === activity.taskId && activity.isTaskTop;
          const preview = windowPreview?.taskId === activity.taskId && activity.activityId === activeTopActivityId ? windowPreview : null;
          const splitCard = isPendingSplit || preview?.direction === 'split'
            ? splitCardPresentation(preview?.dxRatio ?? 0, preview?.upRatio ?? 0, isPendingSplit) : null;
          const isFloating = floating?.task_id === activity.taskId && activity.isTaskTop && !state.isRecentsVisible;
          const isFloatingBackground = floatingBackground === activity.taskId && activity.isTaskTop && !!floating && !state.isLauncherVisible && !state.isRecentsVisible;
          const isActive = !state.isLauncherVisible && !state.isRecentsVisible && (
            isSplitTop || isFloatingBackground || (activity.activityId === activeTopActivityId && !isFloating)
          );
          const recentsSlot = state.isRecentsVisible && activity.isTaskTop
            ? recentsSlotByTaskId.get(activity.taskId)
            : undefined;
          const shouldHide = state.isRecentsVisible && !activity.isTaskTop;

          const { containerStyle, innerStyle } = computeActivityContainerStyle({
            isRecentsVisible: state.isRecentsVisible,
            isActive,
            recentsSlot,
            shouldHide,
          });

          const hasTertiary = !!splitTasks?.tertiary;
          const paneWidth = isFloating ? floating!.bounds.width : isPendingSplit || isStackedSplit ? 1 : splitPane === 'primary' ? splitRatio : splitPane ? 1 - splitRatio : 1;
          const paneHeight = isStackedSplit && splitPane ? (splitPane === 'primary' ? splitRatio : 1 - splitRatio)
            : splitPane === 'primary' || !hasTertiary ? 1
            : splitPane === 'secondary' ? secondarySplitRatio : 1 - secondarySplitRatio;
          const splitContainerStyle: React.CSSProperties = isFloating
            ? {
                position: 'absolute', display: floating!.minimized ? 'none' : 'block', visibility: 'visible', pointerEvents: 'auto',
                top: `min(${floating!.bounds.y * 100}%, max(0px, calc(100% - var(--os-floating-keyboard-height, 0px) - ${floating!.bounds.height * 100}%)))`,
                left: `${floating!.bounds.x * 100}%`, bottom: 'auto', right: 'auto',
                width: `${paneWidth * 100}%`,
                height: `min(${floating!.bounds.height * 100}%, max(0px, calc(100% - var(--os-floating-keyboard-height, 0px))))`,
                overflow: 'hidden', zIndex: 1100,
              }
            : isPendingSplit ? {
                position: 'absolute', display: 'block', visibility: 'visible', pointerEvents: 'none',
                top: 0, left: 0, right: 'auto', bottom: 'auto', width: '100%', height: '100%', overflow: 'hidden', zIndex: zIndexApp,
              }
            : isSplitTop && splitPane
            ? {
                position: 'absolute', display: 'block', visibility: 'visible', pointerEvents: 'auto',
                top: isStackedSplit ? (splitPane === 'secondary' ? `calc(${splitRatio * 100}% - ${splitRatio} * var(--os-split-keyboard-height, 0px))` : 0)
                  : splitPane === 'tertiary' ? `calc(${secondarySplitRatio * 100}% - ${secondarySplitRatio} * var(--os-split-keyboard-height, 0px))` : 0,
                bottom: 'auto',
                left: isStackedSplit || splitPane === 'primary' ? 0 : `${splitRatio * 100}%`,
                width: `${paneWidth * 100}%`,
                height: `calc(${paneHeight * 100}% - ${paneHeight} * var(--os-split-keyboard-height, 0px))`,
                overflow: 'hidden', zIndex: zIndexApp,
              }
            : {};

          return (
            <div
              key={activity.activityId}
              id={`activity-container-${activity.activityId}`}
              className="select-text bg-white"
              inert={isPendingSplit || undefined}
              data-skin-filter={skinImageFilter ? 'true' : undefined}
              data-app-id={activity.appId}
              data-foldagent-pane={isFloating ? 'floating' : isPendingSplit ? 'primary-pending' : splitPane ?? 'fullscreen'}
              data-window-size-class={isSplitTop || isFloating ? 'compact' : isUnfolded ? 'expanded' : 'compact'}
              onPointerDownCapture={() => {
                if ((isSplitTop || isFloating || isFloatingBackground) && state.activeTaskId !== activity.taskId) TaskManager.activateTask(activity.taskId);
              }}
              style={{
                ...containerStyle,
                ...splitContainerStyle,
                ...(splitCard ? {
                  transform: `translate(${splitCard.x * 100}%, ${splitCard.y * 100}%) scale(${splitCard.scale})`,
                  transformOrigin: 'top left', borderRadius: splitCard.radius, border: 0, outline: 0, boxShadow: 'none',
                  transition: isPendingSplit ? 'transform 180ms cubic-bezier(.2,.8,.2,1), border-radius 180ms ease-out' : 'none',
                } : preview ? {
                  transform: `translate(${preview.progress * 10}%, -${preview.progress * 10}%) scale(${1 - preview.progress * 0.2})`,
                  transformOrigin: 'center bottom', borderRadius: 18,
                } : {}),
                ...(themeVarsByApp[activity.appId] as any),
                ...(skinImageFilter ? ({ '--skin-image-filter': skinImageFilter } as any) : {}),
              }}
            >
              {isFloating && floating ? <FloatingWindowChrome
                label={getLocalizedAppName(activity.appId)} bounds={floating.bounds}
                onBounds={updateFloating} onMaximize={maximizeFloating} onClose={dismissFloating}
                onMinimize={() => {
                  updateFloating(floating.bounds, true);
                  if (floatingBackground && state.tasks.some(task => task.taskId === floatingBackground)) launchTaskById(floatingBackground);
                  else if (state.activeTaskId === floating.task_id) window.__OS__?.goHome();
                }}
              /> : null}
              <div className="origin-top-left" style={innerStyle}>
                <AdjustResizeContainer splitResize={isSplitTop} floatingResize={isFloating} isActive={activity.activityId === activeTopActivityId && !state.isLauncherVisible && !state.isRecentsVisible && !splitCandidate}>
                  <MemoizedActivityContent
                    activityId={activity.activityId}
                    appId={activity.appId}
                    taskId={activity.taskId}
                    viewportWidth={viewportWidth * paneWidth}
                  />
                </AdjustResizeContainer>
              </div>
            </div>
          );
        })}

        {floating?.minimized && !state.isRecentsVisible ? <button type="button" className="os-floating-minimized" aria-label={t('打开悬浮窗')}
          onClick={() => { updateFloating(floating.bounds); launchTaskById(floating.task_id); }}>
          {getLocalizedAppName(state.tasks.find(task => task.taskId === floating.task_id)?.rootAppId ?? '')}
        </button> : null}

        {/* Galaxy Z Fold6 / One UI taskbar and multi-window controls (inner display only). */}
        {showInAppTaskbar && isUnfolded && !state.isLauncherVisible && !state.isRecentsVisible ? (
          <div className="foldagent-taskbar" role="toolbar" aria-label="应用任务栏">
            <button type="button" className="foldagent-taskbar-drawer" aria-label="应用列表" title="应用列表" onClick={() => window.__OS__?.goHome()}>
              <span aria-hidden="true" />
            </button>
            <div className="foldagent-taskbar-apps">
              {taskbarEntries.map(({ manifest, kind }, index) => {
                const existingTask = tasksMRU.find(task => task.rootAppId === manifest.id);
                const occupiedTaskIds = splitTasks
                  ? [splitTasks.primary, splitTasks.secondary, splitTasks.tertiary]
                  : [state.activeTaskId];
                const canSplit = !!existingTask && !!state.activeTaskId && !occupiedTaskIds.includes(existingTask.taskId) && !splitTasks?.tertiary;
                return (
                  <React.Fragment key={manifest.id}>
                    {kind === 'recent' && index === edgePanelApps.length ? <span className="foldagent-taskbar-separator" aria-hidden="true" /> : null}
                    <div
                      className="foldagent-taskbar-item"
                      data-taskbar-kind={kind}
                      draggable={canSplit}
                      onDragStart={(event) => {
                        if (!canSplit || !existingTask) return;
                        event.dataTransfer.effectAllowed = 'move';
                        event.dataTransfer.setData('application/x-foldagent-task', existingTask.taskId);
                        setSplitDropTaskId(existingTask.taskId);
                      }}
                      onDragEnd={() => setSplitDropTaskId(null)}
                    >
                      <button type="button" className="foldagent-taskbar-open" aria-label={`打开 ${getLocalizedAppName(manifest.id)}`} onClick={() => launchApp(manifest.id)}>
                        <AppIcon manifest={manifest} size={29} />
                      </button>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        ) : null}

        {splitDropTaskId && isUnfolded ? (
          <div className="foldagent-split-drop-overlay" aria-label="选择分屏位置">
            {(['primary', 'secondary'] as const).map(side => (
              <div
                key={side}
                className={`foldagent-split-drop-zone foldagent-split-drop-${side}`}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const taskId = event.dataTransfer.getData('application/x-foldagent-task') || splitDropTaskId;
                  startSplitWithTask(taskId, side);
                }}
              >
                <span>{splitTasks ? '添加为第三窗口' : side === 'primary' ? '放到左侧' : '放到右侧'}</span>
              </div>
            ))}
          </div>
        ) : null}

        {splitTasks && !state.isLauncherVisible && !state.isRecentsVisible ? (
          <div
            className={`foldagent-split-divider ${isStackedSplit ? 'os-split-divider--stacked' : ''}`}
            style={isStackedSplit ? { left: 0, top: `calc(${splitRatio * 100}% - ${splitRatio} * var(--os-split-keyboard-height, 0px) - 7px)`, bottom: 'auto', width: '100%', height: 14 }
              : { left: `calc(${splitRatio * 100}% - 7px)`, bottom: 'var(--os-split-keyboard-height, 0px)' }}
            aria-orientation={isStackedSplit ? 'horizontal' : 'vertical'}
            role="separator" aria-label="调整分屏大小" aria-valuemin={33} aria-valuemax={67} aria-valuenow={Math.round(splitRatio * 100)}
            onPointerDown={(event) => {
              const root = document.getElementById('root');
              if (!root) return;
              const rect = root.getBoundingClientRect();
              if (!event.isPrimary || event.button !== 0) return;
              splitDragRef.current = { pointerId: event.pointerId, origin: isStackedSplit ? rect.top : rect.left, size: isStackedSplit ? rect.height - getKeyboardHeightSnapshot() : rect.width, stacked: isStackedSplit };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const drag = splitDragRef.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              const nextRatio = Math.max(0.33, Math.min(0.67, ((drag.stacked ? event.clientY : event.clientX) - drag.origin) / drag.size));
              setSplitRatio(nextRatio);
              window.__FOLDAGENT__?.setMultiWindow(splitTasks.tertiary ? 'triple' : 'split', splitTasks.primary, splitTasks.secondary, nextRatio, splitTasks.tertiary ?? null, secondarySplitRatio);
            }}
            onPointerUp={(event) => {
              const drag = splitDragRef.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              const releasedRatio = ((drag.stacked ? event.clientY : event.clientX) - drag.origin) / drag.size;
              splitDragRef.current = null;
              if (releasedRatio <= 0.18 || releasedRatio >= 0.82) {
                const remainingTaskId = releasedRatio <= 0.18 ? splitTasks.secondary : splitTasks.primary;
                exitMultiWindow(remainingTaskId);
              }
            }}
            onPointerCancel={() => { splitDragRef.current = null; }}
            onLostPointerCapture={() => { splitDragRef.current = null; }}
          ><span />{!splitTasks.tertiary && isUnfolded && <button type="button" className="os-split-rotate"
            aria-label={t('切换分屏方向')} title={t('切换分屏方向')}
            onPointerDown={event => event.stopPropagation()}
            onClick={event => {
              event.stopPropagation();
              window.__FOLDAGENT__?.setMultiWindow('split', splitTasks.primary, splitTasks.secondary,
                splitRatio, null, 0.5, isStackedSplit ? 'side_by_side' : 'stacked');
            }}>↻</button>}</div>
        ) : null}

        {splitTasks?.tertiary && isUnfolded && !state.isLauncherVisible && !state.isRecentsVisible ? (
          <div
            className="foldagent-split-divider-horizontal"
            style={{ left: `${splitRatio * 100}%`, top: `calc(${secondarySplitRatio * 100}% - ${secondarySplitRatio} * var(--os-split-keyboard-height, 0px) - 7px)` }}
            role="separator" aria-label="调整右侧上下窗口大小" aria-valuemin={35} aria-valuemax={65} aria-valuenow={Math.round(secondarySplitRatio * 100)}
            onPointerDown={(event) => {
              const root = document.getElementById('root');
              if (!root) return;
              const rect = root.getBoundingClientRect();
              horizontalSplitDragRef.current = { pointerId: event.pointerId, top: rect.top, height: rect.height - getKeyboardHeightSnapshot() };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              const drag = horizontalSplitDragRef.current;
              if (!drag || drag.pointerId !== event.pointerId) return;
              const nextRatio = Math.max(0.35, Math.min(0.65, (event.clientY - drag.top) / drag.height));
              setSecondarySplitRatio(nextRatio);
              window.__FOLDAGENT__?.setMultiWindow('triple', splitTasks.primary, splitTasks.secondary, splitRatio, splitTasks.tertiary, nextRatio);
            }}
            onPointerUp={(event) => { if (horizontalSplitDragRef.current?.pointerId === event.pointerId) horizontalSplitDragRef.current = null; }}
            onPointerCancel={() => { horizontalSplitDragRef.current = null; }}
          ><span /></div>
        ) : null}
        {isUnfolded && !state.isLauncherVisible && !state.isRecentsVisible && !splitCandidate ? (
          <>
            <button
              type="button"
              className={`foldagent-edge-handle ${edgePanelOpen ? 'is-open' : ''}`}
              aria-label={edgePanelOpen ? '收起 Edge Panel' : '打开 Edge Panel'}
              aria-expanded={edgePanelOpen}
              onClick={() => setEdgePanelOpen(open => !open)}
            />
            {edgePanelOpen ? (
              <aside className="foldagent-edge-panel" aria-label="Edge Panel 常用应用">
                <div className="foldagent-edge-panel-title">应用</div>
                <div className="foldagent-edge-panel-grid">
                  {edgePanelApps.map(manifest => {
                    const existingTask = tasksMRU.find(task => task.rootAppId === manifest.id);
                    const canDrag = !!existingTask && !!state.activeTaskId && existingTask.taskId !== state.activeTaskId && !splitTasks?.tertiary;
                    return (
                      <button
                        type="button"
                        key={manifest.id}
                        className="foldagent-edge-app"
                        draggable={canDrag}
                        aria-label={`打开 ${getLocalizedAppName(manifest.id)}`}
                        onDragStart={(event) => {
                          if (!canDrag || !existingTask) return;
                          event.dataTransfer.effectAllowed = 'move';
                          event.dataTransfer.setData('application/x-foldagent-task', existingTask.taskId);
                          setSplitDropTaskId(existingTask.taskId);
                        }}
                        onDragEnd={() => setSplitDropTaskId(null)}
                        onClick={() => {
                          launchApp(manifest.id);
                          setEdgePanelOpen(false);
                        }}
                      >
                        <AppIcon manifest={manifest} size={38} />
                        <span>{getLocalizedAppName(manifest.id)}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="foldagent-edge-panel-hint">已打开的应用可拖到屏幕左右区域，最多平铺三个窗口</div>
              </aside>
            ) : null}
          </>
        ) : null}
        {/* Recents 三层 */}
        <SystemErrorBoundary componentName="RecentsBlur">
          <RecentsBlur />
        </SystemErrorBoundary>
        <SystemErrorBoundary componentName="RecentsChrome">
          <RecentsChrome />
        </SystemErrorBoundary>
        <EdgeGestures />
        {!state.isLauncherVisible && !state.isRecentsVisible && !splitCandidate && <GestureBar onWindowGesture={beginWindowGesture} onPreview={setWindowPreview} />}
        {(state.isLauncherVisible || state.isRecentsVisible) && <SamsungNavigationButtons />}
        <SystemErrorBoundary componentName="HeadsUpNotification">
          <HeadsUpNotification />
        </SystemErrorBoundary>
        <SystemErrorBoundary componentName="SystemShade">
          <SystemShade />
        </SystemErrorBoundary>
        <IntentChooserSheet
          open={intentChooser.open}
          intent={intentChooser.intent}
          matches={intentChooser.matches}
          onChoose={chooseIntentActivity}
          onCancel={cancelIntentChooser}
        />
        <SystemErrorBoundary componentName="KeyboardOverlay">
          <KeyboardOverlay />
        </SystemErrorBoundary>
        <MediaPickerHost />
        <SteadyTextCaret />
        <TextSelectionHandles />
        <TextSelectionMenu />
        <SystemErrorBoundary componentName="PermissionDialogHost">
          <PermissionDialogHost />
        </SystemErrorBoundary>
        </div>
      </SystemErrorBoundary>
    </div>
  );
};




