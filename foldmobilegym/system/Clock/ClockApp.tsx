import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import './reference.css';
import { MemoryRouter, Navigate, Route, Routes, UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import { applySkinToThemeColors } from '../../os/SkinService';
import { getDate } from '../../os/TimeService';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { useAppStrings } from '../../os/useAppStrings';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { useClockGestures } from './hooks/useClockGestures';
import { manifest } from './manifest';
import { colorStates, colorStatesDark } from './res/colors.states';
import { colors, colorsDark } from './res/colors';
import { dimens } from './res/dimens';
import { IcDelete } from './res/icons';
import { stringsEn } from './res/strings.en';
import { strings } from './res/strings';
import { selectSelectedCities, useClockStore } from './state';
import type { Alarm, WorldCity } from './types';
import { anim } from './res/anim';
import { TabBar, type TabKey } from './components/TabBar';
import { AlarmEditModal } from './pages/AlarmEditModal';
import { AlarmEditorSheet } from './pages/AlarmEditorSheet';
import { AlarmPage } from './pages/AlarmPage';
import { CitySelectorPage } from './pages/CitySelectorPage';
import { RepeatSelectorSheet } from './pages/RepeatSelectorSheet';
import { RingtoneSelectorSheet } from './pages/RingtoneSelectorSheet';
import { StopwatchPage } from './pages/StopwatchPage';
import { TimerPage } from './pages/TimerPage';
import { WorldClockPage } from './pages/WorldClockPage';
import { CLOCK_CONFIG } from './data';
import { createAlarmId } from './utils';
import { getAlarmOverlay } from './alarmOverlay';
import { isCitySelectorOpen } from './citySelector';
import { AlarmRingingPage } from './pages/AlarmRingingPage';
import { isAlarmRingingRoute } from './alarmRingingRoute';
import { alarmRuntime } from './alarmRuntime';
import { getClockSelectionMode } from './selectionMode';
import { useAlarmInteractionOwner } from './hooks/useAlarmInteractionOwner';
import { normalizeClockEntryRoute } from './entryRoute';
import { canOpenClockMenu, isClockMenuOpen } from './globalNavigation';
import { ClockGlobalMenu } from './components/ClockGlobalMenu';
import { ClockSettingsPage } from './pages/ClockSettingsPage';
import { getTracker } from '../../os/utils/memoryHistoryTracker';

const ClockShell: React.FC = () => {
  const s = useAppStrings(strings, stringsEn);
  const { go, back } = useClockGestures();
  const location = useLocation();
  const clockPathname = normalizeClockEntryRoute(location.pathname);
  const { navigator } = React.useContext(UNSAFE_NavigationContext);

  const alarms = useClockStore(st => st.alarms);
  const selectedCityIds = useClockStore(st => st.selectedCityIds);
  const selectedCities = useClockStore(selectSelectedCities);
  const toggleAlarm = useClockStore(st => st.toggleAlarm);
  const createAlarm = useClockStore(st => st.createAlarm);
  const updateAlarm = useClockStore(st => st.updateAlarm);
  const storeDeleteAlarms = useClockStore(st => st.deleteAlarms);
  const addCity = useClockStore(st => st.addCity);
  const removeCities = useClockStore(st => st.removeCities);

  const overlay = getAlarmOverlay(clockPathname, location.search);
  const ringing = isAlarmRingingRoute(clockPathname);
  const menuOpen = isClockMenuOpen(clockPathname, location.search);
  const settingsOpen = clockPathname === '/settings';
  const backgroundRef = useRef<HTMLDivElement>(null);
  const settingsAlarmScroll = useRef<number | null>(null);
  const rememberAlarmScroll = () => {
    settingsAlarmScroll.current = backgroundRef.current?.querySelector<HTMLElement>('[data-scroll-container="main"]')?.scrollTop ?? null;
  };
  useLayoutEffect(() => {
    if (settingsOpen || settingsAlarmScroll.current === null) return;
    const scroller = backgroundRef.current?.querySelector<HTMLElement>('[data-scroll-container="main"]');
    if (clockPathname === '/alarm' && scroller) scroller.scrollTop = settingsAlarmScroll.current;
    settingsAlarmScroll.current = null;
  }, [settingsOpen, clockPathname]);
  const showAlarmEditor = overlay.isEditor;
  const alarmEditorIsEditMode = overlay.isEdit;
  const showAlarmEditModal = overlay.panel === 'quick';
  const showRepeat = overlay.isRepeat;
  const showRingtone = overlay.isRingtone;
  const newAlarmCommitted = useRef(false);
  const pendingOverlayEntry = useRef<string | null>(null);
  useEffect(() => { pendingOverlayEntry.current = null; }, [location.key]);
  const beginOverlayNavigation = () => {
    if (!ownsSelection()) return false;
    if (pendingOverlayEntry.current === location.key) return false;
    pendingOverlayEntry.current = location.key;
    return true;
  };
  const closedAlarmEntry = useRef<string | null>(null);
  const closeAlarmOverlay = () => {
    if (closedAlarmEntry.current === location.key) return;
    closedAlarmEntry.current = location.key;
    back();
  };
  const showCitySelector = isCitySelectorOpen(clockPathname, location.search);
  const selection = getClockSelectionMode(clockPathname, location.search);
  const ownsSelection = useAlarmInteractionOwner(`selection:${selection ?? 'base'}`);
  const closedSelectionEntry = useRef<string | null>(null);
  const closedCityEntry = useRef<string | null>(null);
  const closeCitySelector = () => {
    if (closedCityEntry.current === location.key) return;
    closedCityEntry.current = location.key;
    back();
  };
  const [showCityExistsToast, setShowCityExistsToast] = useState(false);
  const selectionMode = selection === 'alarms';
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const worldClockSelectionMode = selection === 'cities';
  const [worldClockSelectedIds, setWorldClockSelectedIds] = useState<string[]>([]);
  const [editingAlarm, setEditingAlarm] = useState<Alarm>(() => ({
    id: createAlarmId(useClockStore.getState().alarms),
    hour: 7,
    minute: 0,
    enabled: true,
    repeat: 'once',
    vibrate: true,
    autoDelete: false,
  }));

  const selectedIdSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const worldClockSelectedIdSet = useMemo(() => new Set(worldClockSelectedIds), [worldClockSelectedIds]);

  useEffect(() => {
    if (!showCityExistsToast) return;
    const t = setTimeout(() => setShowCityExistsToast(false), 2000);
    return () => clearTimeout(t);
  }, [showCityExistsToast]);

  const closeSelection = useCallback(() => {
    if (!selection || !ownsSelection() || closedSelectionEntry.current === location.key) return;
    closedSelectionEntry.current = location.key;
    setSelectedIds([]);
    setWorldClockSelectedIds([]);
    back();
  }, [selection, ownsSelection, location.key, back]);

  useEffect(() => {
    if ((selectionMode && alarms.length === 0) || (worldClockSelectionMode && selectedCities.length === 0)) closeSelection();
  }, [alarms.length, selectedCities.length, selectionMode, worldClockSelectionMode, closeSelection]);
  useEffect(() => {
    if (!selectionMode) setSelectedIds([]);
    if (!worldClockSelectionMode) setWorldClockSelectedIds([]);
  }, [selectionMode, worldClockSelectionMode]);

  const handleBack = useCallback((): boolean => {
    if (ringing || overlay.panel || showCitySelector || menuOpen || settingsOpen) {
      back();
      return true;
    }
    if (selection) {
      closeSelection();
      return true;
    }
    const memoryNavigator = navigator as any;
    const index = typeof memoryNavigator.index === 'number' ? memoryNavigator.index : getTracker(navigator)?.index ?? 0;
    if (index > 0) {
      back();
      return true;
    }
    return false;
  }, [
    back,
    navigator,
    overlay.panel,
    ringing,
    showCitySelector,
    menuOpen,
    settingsOpen,
    selection,
    closeSelection,
  ]);

  useAppNavigationHandler('clock', {
    onBack: handleBack,
    onNavigate: (path, navigate) => navigate(normalizeClockEntryRoute(path)),
  });

  const handleOpenAddAlarm = () => {
    if (!beginOverlayNavigation()) return;
    newAlarmCommitted.current = false;
    setEditingAlarm({
      id: createAlarmId(useClockStore.getState().alarms),
      hour: getDate().getHours(),
      minute: getDate().getMinutes(),
      enabled: true,
      repeat: 'once',
      vibrate: true,
      autoDelete: false,
    });
    go('alarm.add.open');
  };

  const handleOpenMenu = () => {
    if (canOpenClockMenu(clockPathname, location.search) && beginOverlayNavigation()) go('alarm.menu.open');
  };

  const handleOpenEditAlarm = (alarm: Alarm) => {
    if (!beginOverlayNavigation()) return;
    setEditingAlarm(alarm);
    go('alarm.item.edit.open', { alarmId: alarm.id });
  };

  const handleSaveAlarm = (alarm: Alarm) => {
    if (closedAlarmEntry.current === location.key) return;
    if (showAlarmEditModal || alarmEditorIsEditMode) {
      if (!updateAlarm(alarm)) return;
    } else {
      // React may not unmount before a second click in the same event task.
      if (newAlarmCommitted.current) return;
      createAlarm(alarm);
      newAlarmCommitted.current = true;
    }
    if (alarm.enabled) void alarmRuntime.primeSound();
    closeAlarmOverlay();
  };

  const handleToggleAlarm = (id: string) => {
    const source=useClockStore.getState().alarms.find(alarm=>alarm.id===id);
    if (!source) return;
    toggleAlarm(id);
    if (!source.enabled) void alarmRuntime.primeSound();
  };

  const handleSelectionStart = (id: string) => {
    if (!ownsSelection() || clockPathname !== '/alarm' || overlay.panel
      || !useClockStore.getState().alarms.some(alarm => alarm.id === id)) return;
    if (!selectionMode) {
      if (!beginOverlayNavigation()) return;
      go('alarm.item.selection.enter');
    }
    setSelectedIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleSelectionToggle = (id: string) => {
    if (!selectionMode || !ownsSelection()) return;
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]));
  };

  const handleToggleSelectAll = () => {
    if (!selectionMode || !ownsSelection()) return;
    if (selectedIdSet.size === alarms.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(alarms.map(a => a.id));
    }
  };

  const handleDeleteSelected = () => {
    if (!selectionMode || !ownsSelection()) return;
    if (selectedIds.length === 0) return;
    storeDeleteAlarms(selectedIdSet);
    closeSelection();
    setSelectedIds([]);
  };

  const handleWorldClockSelectionStart = (id: string) => {
    if (!ownsSelection() || clockPathname !== '/world' || showCitySelector
      || !useClockStore.getState().selectedCityIds.includes(id)) return;
    if (!worldClockSelectionMode) {
      if (!beginOverlayNavigation()) return;
      go('world.city.selection.enter');
    }
    setWorldClockSelectedIds(prev => (prev.includes(id) ? prev : [...prev, id]));
  };

  const handleWorldClockSelectionToggle = (id: string) => {
    if (!worldClockSelectionMode || !ownsSelection()) return;
    setWorldClockSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const handleWorldClockToggleSelectAll = () => {
    if (!worldClockSelectionMode || !ownsSelection()) return;
    if (worldClockSelectedIdSet.size === selectedCities.length) {
      setWorldClockSelectedIds([]);
    } else {
      setWorldClockSelectedIds(selectedCities.map(c => c.id));
    }
  };

  const handleWorldClockDeleteSelected = () => {
    if (!worldClockSelectionMode || !ownsSelection()) return;
    if (worldClockSelectedIds.length === 0) return;
    removeCities(worldClockSelectedIdSet);
    closeSelection();
    setWorldClockSelectedIds([]);
  };

  const handleSelectCity = (city: WorldCity) => {
    if (closedCityEntry.current === location.key) return;
    // Read current records, not the pre-click render snapshot, when deciding duplicate status.
    if (useClockStore.getState().selectedCityIds.includes(city.id)) setShowCityExistsToast(true);
    else addCity(city.id);
    window.__OS__?.keyboard.hide();
    closeCitySelector();
  };

  const draftAlarm = overlay.panel && overlay.panel !== 'add' && editingAlarm.id !== overlay.alarmId
    ? alarms.find(alarm => alarm.id === overlay.alarmId) ?? { ...editingAlarm, id: overlay.alarmId }
    : editingAlarm;
  const activeTab = clockPathname.replace('/', '') as TabKey;

  return (
    <div className="h-full w-full relative">
      <Routes>
        <Route path="/" element={<Navigate key={location.key} to={normalizeClockEntryRoute(location.pathname + location.search)} replace />} />
        <Route path="/alarm/ringing/:ringId" element={<div className="absolute inset-0 z-50"><AlarmRingingPage/></div>} />
        <Route path="/settings" element={<div className="absolute inset-0 z-50"><ClockSettingsPage /></div>} />
        <Route path="/*" element={null} />
      </Routes>
      <div ref={backgroundRef} className="absolute inset-0" data-clock-background style={{ display: settingsOpen ? 'none' : undefined }} inert={ringing || !!overlay.panel || showCitySelector || menuOpen || settingsOpen} aria-hidden={ringing || overlay.panel || showCitySelector || menuOpen || settingsOpen ? true : undefined}>
        <div className="absolute inset-0" style={{ display: activeTab === 'alarm' ? undefined : 'none' }}>
          <AlarmPage
            alarms={alarms}
            selectionMode={selectionMode}
            selectedIds={selectedIdSet}
            onToggle={handleToggleAlarm}
            onOpenAdd={handleOpenAddAlarm}
            onOpenMenu={handleOpenMenu}
            menuOpen={menuOpen}
            onEdit={handleOpenEditAlarm}
            onSelectToggle={handleSelectionToggle}
            onSelectionStart={handleSelectionStart}
            onToggleSelectAll={handleToggleSelectAll}
            onDeleteSelected={handleDeleteSelected}
          />
        </div>
        <div className="absolute inset-0" style={{ display: activeTab === 'world' ? undefined : 'none' }}>
          <WorldClockPage
            selectedCities={selectedCities}
            onOpenAdd={() => { if (beginOverlayNavigation()) go('world.city.selector.open'); }}
            selectionMode={worldClockSelectionMode}
            selectedIds={worldClockSelectedIdSet}
            onSelectToggle={handleWorldClockSelectionToggle}
            onSelectionStart={handleWorldClockSelectionStart}
            onToggleSelectAll={handleWorldClockToggleSelectAll}
          />
        </div>
        <div className="absolute inset-0" style={{ display: activeTab === 'stopwatch' ? undefined : 'none' }}>
          <StopwatchPage />
        </div>
        <div className="absolute inset-0" style={{ display: activeTab === 'timer' ? undefined : 'none' }}>
          <TimerPage />
        </div>
        {activeTab === 'alarm' && selectionMode ? (
          <div className="absolute bottom-0 left-0 right-0 bg-app-surface border-t border-gray-100 pb-6 pt-2 z-30 flex items-center justify-center">
            <button
              onClick={handleDeleteSelected}
              className="flex flex-col items-center justify-center gap-1 text-gray-700"
            >
              <IcDelete size={22} strokeWidth={dimens.icStrokeWidth} />
              <span className="text-[10px]">{s.toolbar_delete}</span>
            </button>
          </div>
        ) : activeTab === 'world' && worldClockSelectionMode ? (
          <div className="absolute bottom-0 left-0 right-0 bg-app-surface border-t border-gray-100 pb-6 pt-2 z-30 flex items-center justify-center">
            <button
              onClick={handleWorldClockDeleteSelected}
              className="flex flex-col items-center justify-center gap-1 text-gray-700"
            >
              <IcDelete size={22} strokeWidth={dimens.icStrokeWidth} />
              <span className="text-[10px]">{s.toolbar_delete}</span>
            </button>
          </div>
        ) : !ringing ? (
          <TabBar
            activeTab={activeTab || 'alarm'}
            onChange={(tab) => {
              if (tab === activeTab) return;
              if (tab === 'alarm') go('tab.alarm');
              else if (tab === 'world') go('tab.world');
              else if (tab === 'stopwatch') go('tab.stopwatch');
              else if (tab === 'timer') go('tab.timer');
            }}
          />
        ) : null}

      </div>

      {menuOpen && <ClockGlobalMenu onSettingsOpen={rememberAlarmScroll} />}

      {showAlarmEditModal ? (
        <AlarmEditModal
          key={draftAlarm.id}
          alarm={draftAlarm}
          available={alarms.some(alarm => alarm.id === draftAlarm.id)}
          onClose={closeAlarmOverlay}
          onSave={handleSaveAlarm}
          onMoreSettings={(hour, minute) => {
            if (!beginOverlayNavigation()) return;
            setEditingAlarm({ ...draftAlarm, hour, minute });
            go('alarm.editor.more.open');
          }}
        />
      ) : null}

      {showAlarmEditor ? (
        <div className="absolute inset-0 z-40" inert={showRepeat || showRingtone} aria-hidden={showRepeat || showRingtone ? true : undefined}>
          <AlarmEditorSheet
            key={draftAlarm.id}
            alarm={draftAlarm}
            isEdit={alarmEditorIsEditMode}
            available={!alarmEditorIsEditMode || alarms.some(alarm => alarm.id === draftAlarm.id)}
            onClose={closeAlarmOverlay}
            onSave={handleSaveAlarm}
            onOpenRepeat={() => { if (beginOverlayNavigation()) go('alarm.repeat.open'); }}
            onOpenRingtone={() => { if (beginOverlayNavigation()) go('alarm.ringtone.open'); }}
          />
        </div>
      ) : null}

      {showRepeat ? (
        <RepeatSelectorSheet
          isEdit={alarmEditorIsEditMode}
          value={draftAlarm.repeat}
          onSelect={repeat => setEditingAlarm({ ...draftAlarm, repeat })}
          onClose={closeAlarmOverlay}
        />
      ) : null}

      {showRingtone ? (
        <RingtoneSelectorSheet
          isEdit={alarmEditorIsEditMode}
          value={draftAlarm.tone}
          onSelect={tone => setEditingAlarm({ ...draftAlarm, tone })}
          onClose={closeAlarmOverlay}
        />
      ) : null}

      {showCitySelector ? (
        <CitySelectorPage
          cities={CLOCK_CONFIG.cities}
          selectedCityIds={selectedCityIds}
          onSelect={handleSelectCity}
          onClose={closeCitySelector}
        />
      ) : null}

      {showCityExistsToast && activeTab === 'world' ? (
        <div role="status" className="absolute inset-0 z-50 pointer-events-none flex items-end justify-center pb-32">
          <span className="text-[15px] text-gray-700 bg-gray-200 rounded-lg px-4 py-2.5 shadow-lg">
            {s.timezone_exists_toast}
          </span>
        </div>
      ) : null}
    </div>
  );
};


const ClockApp: React.FC = () => {
  const { isDark } = useDarkMode();
  const themeColors = isDark
    ? { ...manifest.theme.colors, ...(manifest.theme.colorsDark ?? {}) }
    : manifest.theme.colors;
  const appColors = isDark ? { ...colors, ...colorsDark } : colors;
  const appColorStates = isDark ? { ...colorStates, ...colorStatesDark } : colorStates;
  const cssVars = {
    ...themeToCssVars(applySkinToThemeColors(themeColors)),
    ...dimensToCssVars(appColors, { prefix: '--app-c-' }),
    ...dimensToCssVars(appColorStates, { prefix: '--app-cs-' }),
    ...dimensToCssVars(dimens),
    ...dimensToCssVars(anim, { prefix: '--app-' }),
  };
  return (
    <div className="clock-app-root h-full w-full" style={cssVars as React.CSSProperties}>
      <MemoryRouter initialEntries={['/alarm']}>
        <ClockShell />
      </MemoryRouter>
    </div>
  );
};

export default ClockApp;
