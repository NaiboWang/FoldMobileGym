import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from 'react';
import './browser-adaptive.css';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { MemoryRouter, Navigate, useLocation, UNSAFE_NavigationContext, Routes, Route } from 'react-router-dom';
import { IcLauncher, IcGlobe, IcBack, IcForward, IcRefresh, IcHome, IcSearch, IcShield, IcNavBack, IcNavForward, IcTabs, IcMoreHoriz, IcClose, IcAdd } from './res/icons';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import { useBrowserStore } from './state';
import type { Tab } from './state';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { useBrowserGestures } from './hooks/useBrowserGestures';
import { useAppStrings } from '../../os/useAppStrings';
import { strings } from './res/strings';
import { stringsEn } from './res/strings.en';
import { BookmarkButton } from './BookmarkButton';
import { useActivityId } from '../../os/ActivityContext';
import { getTracker } from '../../os/utils/memoryHistoryTracker';
import { readBrowserTabHistory } from './tabHistory';

// --- Home Component ---
const BrowserHome: React.FC<{ onNavigate: (url: string) => void; scrollTop?: number; onScroll?: (value: number) => void }> = ({ onNavigate, scrollTop = 0, onScroll }) => {
    const scroller = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => { if (scroller.current && Math.abs(scroller.current.scrollTop - scrollTop) > 1) scroller.current.scrollTop = scrollTop; }, [scrollTop]);
    const localPages = useBrowserStore(state => state.localPages);
    const [input, setInput] = useState('');
    const s = useAppStrings(strings, stringsEn);

    const recommendations = localPages ? Object.entries(localPages).map(([url, page]) => ({ name: page.title, url, icon: '', color: 'bg-white' })) : [
        { name: '科研楼停电通知', url: 'benchmark://local_power_notice', icon: '', color: 'bg-amber-100' },
        { name: '青禾打印店', url: 'benchmark://qinghe_print', icon: '', color: 'bg-emerald-100' },
        { name: '实验楼供水通知', url: 'benchmark://lab_water_notice', icon: '', color: 'bg-cyan-100' },
        { name: '校园网维护通知', url: 'benchmark://network_maintenance', icon: '', color: 'bg-indigo-100' },
        { name: '电梯检修通知', url: 'benchmark://elevator_inspection', icon: '', color: 'bg-orange-100' },
        { name: '墨云图文中心', url: 'benchmark://moyun_print', icon: '', color: 'bg-violet-100' },
        { name: '知行装订社', url: 'benchmark://zhixing_bindery', icon: '', color: 'bg-lime-100' },
        { name: '方格快印', url: 'benchmark://grid_quickprint', icon: '', color: 'bg-rose-100' },
        // Offline-safe built-in glyphs; shortcut names/URLs remain unchanged.
        { name: '维基百科', url: 'https://zh.m.wikipedia.org', icon: '', color: 'bg-white' },
        { name: 'GitHub', url: 'https://github.com', icon: '', color: 'bg-black' },
        { name: '百度', url: 'https://www.baidu.com', icon: '', color: 'bg-blue-500' },
        { name: 'Bilibili', url: 'https://m.bilibili.com', icon: '', color: 'bg-pink-400' },
        { name: '知乎', url: 'https://www.zhihu.com', icon: '', color: 'bg-blue-600' },
        { name: 'React', url: 'https://react.dev', icon: '', color: 'bg-sky-400' },
        { name: 'Google', url: 'https://www.google.com', icon: '', color: 'bg-white' },
        { name: 'Bing', url: 'https://www.bing.com', icon: '', color: 'bg-white' },
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        onNavigate(input.trim());
    };

    return (
        <div ref={scroller} onScroll={event => onScroll?.(event.currentTarget.scrollTop)} className="browser-home-reference flex-1 min-h-0 overflow-y-auto flex flex-col items-center px-8 bg-app-surface animate-in fade-in" data-scroll-container="main" data-scroll-direction="vertical" style={{ animationDuration: 'var(--app-duration-long)' }}>
            <div className="mb-12 flex flex-col items-center">
                <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg shadow-blue-200 mb-6 bg-white">
                    <IcLauncher size={76} />
                </div>
                <h1 className="text-2xl font-medium tracking-tight text-slate-800">{s.app_name}</h1>
            </div>

            <form onSubmit={handleSubmit} className="w-full max-w-md relative group mb-12">
                <div className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <IcSearch size={20} />
                </div>
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={s.search_or_enter_url}
                    className="w-full h-16 pl-14 pr-6 bg-slate-100/80 backdrop-blur-sm rounded-[24px] text-lg outline-none border-2 border-transparent focus:border-blue-500/20 focus:bg-white focus:shadow-xl transition-all"
                />
            </form>

            <div className="w-full max-w-md grid grid-cols-4 gap-y-8">
                {recommendations.map((item) => (
                    <button
                        key={item.name}
                        onClick={() => onNavigate(item.url)}
                        className="flex flex-col items-center gap-2 group active:scale-95 transition-transform"
                    >
                        <div className={`w-14 h-14 ${item.color} rounded-2xl flex items-center justify-center shadow-sm overflow-hidden border border-slate-100 group-hover:shadow-md transition-shadow`}>
                            {item.icon ? (
                            <img
                                src={item.icon}
                                alt=""
                                className="w-8 h-8 object-contain"
                                onError={(e) => {
                                    (e.currentTarget as HTMLImageElement).parentElement!.classList.add('bg-slate-50');
                                    (e.currentTarget as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiM5NGExYjIiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0ibHVjaWRlIGx1Y2lkZS1nbG9iZSI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48cGF0aCBkPSJNMTIgMmExNS4zIDE1LjMgMCAwIDEgMCAyMCIvPjxwYXRoIGQ9Ik0xMiAyYTE1LjMgMTUuMyAwIDAgMCAwIDIwIi8+PHBhdGggZD0iTTIgMTJoMjAiLz48L3N2Zz4=';
                                }}
                            />
                            ) : <IcGlobe size={28} className="text-slate-500" />}
                        </div>
                        <span className="text-[12px] font-medium text-slate-600 truncate w-full text-center px-1">{item.name}</span>
                    </button>
                ))}
            </div>
        </div>
    );
};

// --- WebView Component ---
const BrowserView: React.FC<{ url: string; address: string; onAddress: (value: string) => void; onNavigate: (value: string) => void; scrollTop: number; onScroll: (value: number) => void }> = ({ url, address, onAddress, onNavigate, scrollTop, onScroll }) => {
    const scroller = useRef<HTMLElement>(null), s = useAppStrings(strings, stringsEn);
    useLayoutEffect(() => { if (scroller.current && Math.abs(scroller.current.scrollTop - scrollTop) > 1) scroller.current.scrollTop = scrollTop; }, [scrollTop]);
    const localPage = useBrowserStore(state => state.localPages?.[url]);
    const [isLoading, setIsLoading] = useState(true);
    const controlledPages: Record<string, { title: string; badge: string; body: React.ReactNode }> = {
        'benchmark://local_power_notice': { title: '科研楼停电通知', badge: '校内通知 · 固定快照', body: <>因配电设备检修，科研楼B区将于<strong>9月26日 13:00–16:00</strong>停电。检修期间请从<strong>北门</strong>备用入口通行。</> },
        'benchmark://qinghe_print': { title: '青禾打印店', badge: '本地服务 · 固定快照', body: <>地址：<strong>学府路12号</strong><br />工作日：<strong>08:30–20:00</strong><br />周末：<strong>10:00–18:00</strong><br /><span className="text-slate-500">本页面不提供下单、登录或位置权限。</span></> },
        'benchmark://lab_water_notice': { title: '实验楼供水通知', badge: '校内通知 · 固定快照', body: <>实验楼C区将于<strong>10月6日 09:00–11:30</strong>暂停供水。期间请从<strong>西侧连廊</strong>备用入口通行。</> },
        'benchmark://network_maintenance': { title: '校园网维护通知', badge: '校内通知 · 固定快照', body: <>数据楼A区将于<strong>10月9日 00:30–03:00</strong>进行网络维护。期间请使用<strong>访客无线网</strong>作为备用接入。</> },
        'benchmark://elevator_inspection': { title: '电梯检修通知', badge: '校内通知 · 固定快照', body: <>创新楼B区电梯将于<strong>10月12日 08:00–12:00</strong>检修。期间请从<strong>东侧楼梯</strong>通行。</> },
        'benchmark://moyun_print': { title: '墨云图文中心', badge: '本地服务 · 固定快照', body: <>地址：<strong>科创路18号</strong><br />工作日：<strong>09:00–21:00</strong><br />周末：<strong>10:00–17:30</strong><br /><span className="text-slate-500">本页面不提供下单、登录或位置权限。</span></> },
        'benchmark://zhixing_bindery': { title: '知行装订社', badge: '本地服务 · 固定快照', body: <>地址：<strong>学研路33号</strong><br />工作日：<strong>08:00–19:30</strong><br />周末：<strong>09:30–16:00</strong><br /><span className="text-slate-500">本页面不提供下单、登录或位置权限。</span></> },
        'benchmark://grid_quickprint': { title: '方格快印', badge: '本地服务 · 固定快照', body: <>地址：<strong>创新路7号</strong><br />工作日：<strong>08:45–20:30</strong><br />周末：<strong>11:00–18:30</strong><br /><span className="text-slate-500">本页面不提供下单、登录或位置权限。</span></> },
    };
    const controlledPage = localPage ? { ...localPage, body: localPage.paragraphs.map((text, index) => <p key={index}>{text}</p>) } : controlledPages[url] || null;

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-app-surface overflow-hidden relative">
            <div className="browser-legacy-address pt-8 bg-white/80 backdrop-blur-md border-b border-slate-100 shrink-0">
                <div className="h-12 flex items-center px-4">
                    <form className="browser-cover-address-form flex-1 bg-slate-100 px-3 py-1.5 rounded-lg flex items-center gap-2 overflow-hidden"
                        onSubmit={event => { event.preventDefault(); if (event.currentTarget.checkVisibility()) onNavigate(address); }}>
                        <IcShield size={12} className="text-green-500 shrink-0" />
                        <input data-browser-address="cover" aria-label={s.search_or_enter_url} value={address} onChange={event => onAddress(event.target.value)} className="min-w-0 flex-1 bg-transparent outline-none text-sm" />
                        <button type="submit" aria-label={s.navigate_address}><IcForward size={18} /></button>
                    </form>
                </div>
            </div>

            <div className="flex-1 relative overflow-hidden">
                {controlledPage ? (
                    <main ref={scroller} onScroll={event => onScroll(event.currentTarget.scrollTop)} data-benchmark-page={url.slice('benchmark://'.length)} data-scroll-container="main" data-scroll-direction="vertical" className="browser-local-document h-full overflow-auto bg-slate-50">
                        <article className="browser-local-article mx-auto max-w-2xl rounded-3xl bg-white shadow-sm border border-slate-100">
                            <div className="text-xs font-semibold text-blue-600 mb-3">{controlledPage.badge}</div>
                            <h1 className="text-2xl font-bold text-slate-900 mb-6">{controlledPage.title}</h1>
                            <div className="browser-local-body text-base leading-8 text-slate-700">{controlledPage.body}</div>
                        </article>
                    </main>
                ) : url ? (
                    <iframe
                        src={url}
                        className="w-full h-full border-none"
                        onLoad={() => setIsLoading(false)}
                        title="browser-active-content"
                        sandbox="allow-same-origin allow-scripts allow-forms"
                        allow="autoplay; encrypted-media"
                    />
                ) : null}
                {isLoading && !controlledPage && (
                    <div className="absolute inset-0 bg-app-surface flex items-center justify-center">
                        <div className="w-8 h-8 border-3 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
                    </div>
                )}
            </div>
        </div>
    );
};

const tabDisplayTitle = (tab: Tab, newTab: string) => tab.url ? (tab.title || tab.url) : newTab;

// --- Tabs Overlay ---
const TabsOverlay: React.FC<{
    tabs: Tab[],
    activeTabId: string,
    onCloseTab: (id: string, e: React.MouseEvent) => void,
    onSelectTab: (id: string) => void,
    onNewTab: () => void
}> = ({ tabs, activeTabId, onCloseTab, onSelectTab, onNewTab }) => {
    const s = useAppStrings(strings, stringsEn);
    const { bindBack } = useBrowserGestures();
    return (
        <div className="absolute inset-0 z-[1000] bg-slate-900/95 backdrop-blur-xl flex flex-col animate-in slide-in-from-bottom" style={{ animationDuration: 'var(--app-duration-medium)' }}>
            <div className="h-16 flex items-center justify-between px-6 shrink-0">
                <h2 className="text-white text-xl font-semibold">{s.tabs}</h2>
                <button type="button" aria-label={s.close_tabs} {...bindBack()} className="text-white/60 hover:text-white"><IcClose size={dimens.tabs_overlay_close_icon} /></button>
            </div>

            <div data-scroll-container="overview" data-scroll-direction="vertical" className="flex-1 overflow-y-auto no-scrollbar px-6 py-4 grid grid-cols-2 gap-4">
                {tabs.map((tab) => (
                    <div
                        key={tab.id}
                        onClick={() => onSelectTab(tab.id)}
                        className={`aspect-[3/4] rounded-2xl p-4 flex flex-col relative overflow-hidden transition-all ${tab.id === activeTabId ? 'ring-4 ring-blue-500 scale-100' : 'bg-white/10 scale-95'}`}
                    >
                        <div className="flex-1 bg-white/5 rounded-lg flex items-center justify-center mb-2">
                            <IcGlobe size={32} className="text-white/20" />
                        </div>
                        <div className="text-xs text-white font-medium truncate mb-1">{tabDisplayTitle(tab, s.new_tab)}</div>
                        <div className="text-[10px] text-white/40 truncate">{tab.url}</div>
                        <button
                            aria-label={s.close_tab.replace('{{title}}', tabDisplayTitle(tab, s.new_tab))} data-browser-overview-close={tab.id}
                            onClick={(e) => onCloseTab(tab.id, e)}
                            className="absolute top-2 right-2 w-7 h-7 bg-black/40 rounded-full flex items-center justify-center text-white"
                        >
                            <IcClose size={14} />
                        </button>
                    </div>
                ))}
                <button
                    onClick={onNewTab} data-browser-new-tab="overview"
                    className="aspect-[3/4] rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center justify-center gap-2 text-white/40 active:bg-white/5 transition-colors"
                >
                    <IcAdd size={32} />
                    <span className="text-xs">{s.new_tab}</span>
                </button>
            </div>
        </div>
    );
};

// --- Main App Logic ---
const BrowserContent: React.FC = () => {
    const { go, back, bindBack, bindTap } = useBrowserGestures();
    const s = useAppStrings(strings, stringsEn);
    const location = useLocation();
    const { navigator } = React.useContext(UNSAFE_NavigationContext);

    // Store state
    const tabs = useBrowserStore(s => s.tabs);
    const activeTabId = useBrowserStore(s => s.activeTabId);
    const activeTab = useMemo(() => tabs.find(t => t.id === activeTabId) || tabs[0], [tabs, activeTabId]);

    // Store actions (stable refs)
    const navigateTab = useBrowserStore(s => s.navigateTab);
    const storeAddTab = useBrowserStore(s => s.addTab);
    const storeCloseTab = useBrowserStore(s => s.closeTab);
    const storeGoHome = useBrowserStore(s => s.goHome);
    const setActiveTabId = useBrowserStore(s => s.setActiveTabId);
    const trackVisitedUrl = useBrowserStore(s => s.trackVisitedUrl);
    const moveTab = useBrowserStore(s => s.moveTab), rememberScroll = useBrowserStore(s => s.rememberScroll), reloadTab = useBrowserStore(s => s.reloadTab);
    const history = readBrowserTabHistory(activeTab), historyEntry = history.entries[history.index];
    const [reloadVersion, setReloadVersion] = useState(0);
    const contentRoot = useRef<HTMLDivElement>(null);

    const isTabsOverlayOpen = new URLSearchParams(location.search).get('panel') === 'tabs';
    const activityId = useActivityId(), liveEntry = useRef(location.key);
    liveEntry.current = location.key;
    const tabStrip = useRef<HTMLDivElement>(null), pendingTabFocus = useRef<string | null>(null);
    const ownsBrowser = () => {
        const os = window.__OS__?.getState(), top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
        const live = useBrowserStore.getState();
        return Boolean(activityId && top?.activityId === activityId && !os?.isLauncherVisible && !os?.isRecentsVisible
            && liveEntry.current === location.key && live.tabs === tabs && live.activeTabId === activeTabId);
    };
    const ownsPage = () => ownsBrowser() && !isTabsOverlayOpen;
    const ownsTabs = (surface: 'strip' | 'overview') => ownsBrowser()
        && (surface === 'overview' ? isTabsOverlayOpen : !isTabsOverlayOpen && Boolean(tabStrip.current?.checkVisibility()));
    const currentScroll = () => contentRoot.current?.querySelector<HTMLElement>('main[data-benchmark-page], .browser-home-reference')?.scrollTop ?? 0;
    const saveScroll = (value: number) => { if (ownsPage()) rememberScroll(activeTabId, activeTab, value); };
    useLayoutEffect(() => {
        const id = pendingTabFocus.current;
        if (!id) return;
        pendingTabFocus.current = null;
        const os = window.__OS__?.getState(), top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
        const strip = tabStrip.current;
        if (top?.activityId !== activityId || os?.isLauncherVisible || os?.isRecentsVisible || isTabsOverlayOpen || !strip?.checkVisibility()) return;
        const button = [...strip.querySelectorAll<HTMLButtonElement>('[data-browser-tab-id]')].find(node => node.dataset.browserTabId === id);
        if (!button) return;
        button.focus({ preventScroll: true });
        const frame = strip.getBoundingClientRect(), bounds = button.getBoundingClientRect();
        const scale = frame.width > 0 ? strip.clientWidth / frame.width : 1;
        if (bounds.left < frame.left) strip.scrollLeft -= (frame.left - bounds.left) * scale;
        else if (bounds.right > frame.right) strip.scrollLeft += (bounds.right - frame.right) * scale;
    }, [tabs, activeTabId, activityId, isTabsOverlayOpen]);
    const [addressDraft, setAddressDraft] = useState(activeTab.url);
    useEffect(() => setAddressDraft(activeTab.url), [activeTabId, activeTab.url]);

    // Track visited URLs
    useEffect(() => {
        if (activeTab.url) {
            trackVisitedUrl(activeTab.url);
        }
    }, [activeTab.url, trackVisitedUrl]);

    const handleNavigate = (input: string) => {
        let target = input.trim();
        if (!target.startsWith('http') && !target.startsWith('benchmark://')) {
            if (target.includes('.') && !target.includes(' ')) {
                target = 'https://' + target;
            } else {
                target = `https://www.google.com/search?q=${encodeURIComponent(target)}`;
            }
        }
        const same = target === activeTab.url;
        if (!navigateTab(activeTabId, target, activeTab, currentScroll())) return;
        if (same) setReloadVersion(version => version + 1);
        const focused = document.activeElement as HTMLElement | null;
        if (focused && contentRoot.current?.contains(focused)) focused.blur();
        window.__OS__?.keyboard.hide();
        go('view.open');
    };

    const handleNewTab = (surface: 'strip' | 'overview') => {
        if (!ownsTabs(surface)) return;
        const id = storeAddTab(activeTab, currentScroll());
        if (!id) return;
        if (surface === 'strip') pendingTabFocus.current = id;
        go('home.open');
    };

    const selectTab = (tab: Tab, surface: 'strip' | 'overview') => {
        if (!ownsTabs(surface) || useBrowserStore.getState().tabs.find(item => item.id === tab.id) !== tab) return;
        setActiveTabId(tab.id, activeTab, currentScroll());
        if (tab.url) go('view.open', {}, { mode: 'replace' });
        else go('home.open');
    };

    const closeTab = (id: string, surface: 'strip' | 'overview') => {
        if (!ownsTabs(surface)) return;
        const expected = tabs.find(tab => tab.id === id);
        if (!expected) return;
        const result = storeCloseTab(id, expected);
        if (!result.closed) return;
        if (surface === 'strip') pendingTabFocus.current = result.newActiveTabId;
        // An inactive close must not replace the reader's history key/scroller.
        if (id === activeTabId || tabs.length === 1) {
            if (surface === 'strip') {
                if (result.newActiveTabHasUrl) go('tab.close.view', { tabId: id });
                else go('tab.close.home', { tabId: id });
            } else if (result.newActiveTabHasUrl) go('view.open');
            else go('home.open');
        }
    };

    const handleCloseTab = (id: string, event: React.MouseEvent) => {
        event.stopPropagation(); closeTab(id, 'overview');
    };

    const handleBackPress = (): boolean => {
        if (!ownsBrowser()) return false;
        if (isTabsOverlayOpen) {
            const tracker = getTracker(navigator), previous = tracker?.stack[tracker.index - 1];
            if (previous?.pathname === location.pathname && !previous.search) back();
            else if (activeTab.url) go('view.open', {}, { mode: 'replace' });
            else go('home.open');
            return true;
        }
        const next = moveTab(activeTabId, -1, activeTab, currentScroll());
        if (!next) return false;
        if (next.url) go('view.open', {}, { mode: 'replace' });
        else go('home.open');
        return true;
    };
    useAppNavigationHandler('browser', { onBack: handleBackPress });
    const canGoBack = history.index > 0;
    const canGoForward = history.index + 1 < history.entries.length;
    const handleForward = () => {
        if (!ownsPage()) return;
        const next = moveTab(activeTabId, 1, activeTab, currentScroll());
        if (!next) return;
        if (next.url) go('history.forward.view', { tabId: activeTabId });
        else go('history.forward.home', { tabId: activeTabId });
    };
    const handleHome = () => {
        if (!ownsPage() || !storeGoHome(activeTabId, activeTab, currentScroll())) return;
        go('home.open');
    };
    const handleReload = () => {
        if (!ownsPage()) return;
        if (reloadTab(activeTabId, activeTab, currentScroll())) setReloadVersion(version => version + 1);
    };
    const viewKey = `${activeTabId}:${history.index}:${activeTab.url}:${reloadVersion}`;

    return (
        <div ref={contentRoot} className="browser-content-reference h-full min-h-0 w-full flex flex-col bg-app-surface overflow-hidden select-none">
            <div ref={tabStrip} className="browser-reference-tabs" aria-label={s.tabs} data-scroll-container="tabs" data-scroll-direction="horizontal">
                {tabs.map(tab => {
                    const replacement = tab.id === activeTabId ? tabs.find(item => item.id !== tab.id) : activeTab;
                    const closeOptions = { params: { tabId: tab.id }, stopPropagation: true, onTrigger: () => closeTab(tab.id, 'strip') };
                    return <div key={tab.id} className="browser-reference-tab" data-active={tab.id === activeTabId ? 'true' : 'false'}>
                        <button type="button" className="browser-reference-tab-select" data-browser-tab-id={tab.id}
                            aria-current={tab.id === activeTabId ? 'page' : undefined}
                            {...(tab.url ? bindTap<HTMLButtonElement>('view.open', { params: { tabId: tab.id }, onTrigger: () => selectTab(tab, 'strip') })
                                : bindTap<HTMLButtonElement>('home.open', { params: { tabId: tab.id }, onTrigger: () => selectTab(tab, 'strip') }))}>
                            <IcGlobe size={14} /><span>{tabDisplayTitle(tab, s.new_tab)}</span>
                        </button>
                        <button type="button" className="browser-reference-tab-close" aria-label={s.close_tab.replace('{{title}}', tabDisplayTitle(tab, s.new_tab))}
                            {...(replacement?.url ? bindTap<HTMLButtonElement>('tab.close.view', closeOptions) : bindTap<HTMLButtonElement>('tab.close.home', closeOptions))}>
                            <IcClose size={14} />
                        </button>
                    </div>;
                })}
                <button type="button" aria-label={s.new_tab} {...bindTap<HTMLButtonElement>('home.open', { onTrigger: () => handleNewTab('strip') })}><IcAdd size={20} /></button>
            </div>

            {/* Content */}
            <div className="flex-1 min-h-0 relative flex flex-col overflow-hidden">
                <Routes>
                    <Route path="/" element={<BrowserHome key={viewKey} onNavigate={handleNavigate} scrollTop={historyEntry.scrollTop ?? 0} onScroll={saveScroll} />} />
                    <Route path="/view" element={activeTab.url ? <BrowserView key={viewKey} url={activeTab.url} address={addressDraft} onAddress={setAddressDraft} onNavigate={handleNavigate} scrollTop={historyEntry.scrollTop ?? 0} onScroll={saveScroll} /> : <Navigate to="/" replace />} />
                </Routes>
            </div>

            {/* Bottom Bar */}
            <div className="browser-reference-toolbar h-(--app-bottom-bar-height) shrink-0 bg-app-surface border-t border-slate-100 px-6 flex items-center justify-between pb-safe">
                <button
                    aria-label={s.home_page} {...bindTap<HTMLButtonElement>('home.open', { onTrigger: handleHome })}
                    className={`w-14 h-14 flex items-center justify-center rounded-[20px] transition-all ${location.pathname === '/' ? 'bg-[#1a73e8] text-white shadow-lg' : 'text-slate-500 active:bg-slate-50'}`}
                >
                    <IcHome size={dimens.bottom_home_icon_size} />
                </button>
                <button
                    {...bindBack()} aria-label={s.go_back} data-browser-history="back"
                    disabled={!canGoBack || isTabsOverlayOpen}
                    className="w-12 h-12 flex items-center justify-center text-slate-400 disabled:opacity-10 active:bg-slate-50 rounded-full"
                >
                    <IcNavBack size={dimens.bottom_nav_icon_size} />
                </button>

                <button
                    data-browser-history="forward" aria-label={s.go_forward}
                    {...(history.entries[history.index + 1]?.url
                        ? bindTap<HTMLButtonElement>('history.forward.view', { params: { tabId: activeTabId }, onTrigger: handleForward })
                        : bindTap<HTMLButtonElement>('history.forward.home', { params: { tabId: activeTabId }, onTrigger: handleForward }))}
                    disabled={!canGoForward || isTabsOverlayOpen}
                    className="w-12 h-12 flex items-center justify-center text-slate-400 disabled:opacity-10 active:bg-slate-50 rounded-full"
                >
                    <IcNavForward size={dimens.bottom_nav_icon_size} />
                </button>



                <button type="button" aria-label={s.reload_page} disabled={isTabsOverlayOpen}
                    {...(location.pathname === '/view'
                        ? bindTap({ kind: 'action', id: 'browser.page.reload' }, { params: { tabId: activeTabId, url: activeTab.url }, onTrigger: handleReload })
                        : bindTap({ kind: 'action', id: 'browser.home.reload' }, { params: { tabId: activeTabId, url: activeTab.url }, onTrigger: handleReload }))}
                    className="w-12 h-12 flex items-center justify-center text-slate-500 rounded-full">
                    <IcRefresh size={dimens.bottom_nav_icon_size} />
                </button>

                <form className="browser-reference-address" onSubmit={event => { event.preventDefault(); if (event.currentTarget.checkVisibility() && addressDraft.trim()) handleNavigate(addressDraft); }}>
                    <IcSearch size={17} /><input data-browser-address="wide" aria-label={s.search_or_enter_url} placeholder={s.search_or_enter_url} value={addressDraft} onChange={event => setAddressDraft(event.target.value)} />
                    <button type="submit" aria-label={s.navigate_address}><IcForward size={18} /></button>
                </form>

                <button
                    {...(location.pathname === '/view' ? bindTap<HTMLButtonElement>('tabs.open.view') : bindTap<HTMLButtonElement>('tabs.open.home'))}
                    className="w-12 h-12 flex items-center justify-center text-slate-500 relative active:bg-slate-50 rounded-full"
                >
                    <IcTabs size={dimens.tabs_icon_size} />
                    <span className="absolute top-2 right-2 bg-slate-800 text-white text-[9px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{tabs.length}</span>
                </button>

                <BookmarkButton />
            </div>

            {/* Tabs Overlay */}
            {isTabsOverlayOpen && (
                <TabsOverlay
                    tabs={tabs}
                    activeTabId={activeTabId}
                    onCloseTab={handleCloseTab}
                    onSelectTab={id => { const target = tabs.find(tab => tab.id === id); if (target) selectTab(target, 'overview'); }}
                    onNewTab={() => handleNewTab('overview')}
                />
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
        .pb-safe { padding-bottom: env(safe-area-inset-bottom); }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        iframe { scrollbar-width: none; }
        iframe::-webkit-scrollbar { display: none; }
      `}} />
        </div>
    );
};

export const BrowserApp: React.FC = () => {
    const { isDark } = useDarkMode();
    const [initialEntry] = useState(() => {
        const { tabs, activeTabId } = useBrowserStore.getState();
        const activeTab = tabs.find(tab => tab.id === activeTabId) ?? tabs[0];
        return activeTab?.url ? '/view' : '/';
    });
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
        <div className="browser-app-reference h-full w-full pt-10" data-status-bar-foreground={isDark ? 'light' : 'dark'} data-navigation-bar-foreground={isDark ? 'light' : 'dark'} style={cssVars as React.CSSProperties}>
        <MemoryRouter initialEntries={[initialEntry]}>
            <BrowserContent />
        </MemoryRouter>
        </div>
    );
};

export default BrowserApp;
