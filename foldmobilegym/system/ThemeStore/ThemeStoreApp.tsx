import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useParams, UNSAFE_NavigationContext } from 'react-router-dom';
import { BarChart3, Crown, Grid2X2, Search, Sparkles, UserRound } from 'lucide-react';
import { IcNavBack, IcLoading } from './res/icons';
import { useTheme } from '../../os/ThemeContext';
import { useActivityId } from '../../os/ActivityContext';
import TaskManager from '../../os/TaskManager';
import { ThemeApplyGate } from './applyGate';
import type { ThemeMeta } from '../../os/ThemeService';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { SIMULATOR_CONFIG } from '@/os/data';
import { applyLauncherWallpaper } from '../../os/launcher/storage';
import type { LauncherWallpaper } from '../../os/launcher/types';
import { dimensToCssVars, themeToCssVars } from '../../os/utils/themeToCssVars';
import { applySkinToThemeColors } from '../../os/SkinService';
import { useDarkMode } from '../../os/hooks/useDarkMode';
import { useAppStrings } from '../../os/useAppStrings';
import { manifest } from './manifest';
import { colors, colorsDark } from './res/colors';
import { colorStates, colorStatesDark } from './res/colors.states';
import { dimens } from './res/dimens';
import { anim } from './res/anim';
import { strings } from './res/strings';
import { stringsEn } from './res/strings.en';
import { useThemeStoreGestures } from './hooks/useThemeStoreGestures';
import './reference.css';

const { statusBarHeight } = SIMULATOR_CONFIG.framework;

type StoreTab = 'themes' | 'fonts' | 'aod';

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function pill(label: string, tone: 'blue' | 'green' | 'gray' = 'gray') {
  const cls =
    tone === 'blue'
      ? 'bg-blue-50 text-blue-700'
      : tone === 'green'
        ? 'bg-green-50 text-green-700'
        : 'bg-gray-100 text-gray-600';
  return <span className={cn('text-[11px] px-2 py-0.5 rounded-full', cls)}>{label}</span>;
}

function setLauncherWallpaper(wallpaper: LauncherWallpaper) {
  try {
    applyLauncherWallpaper(wallpaper);
  } catch (e) {
    console.warn('[ThemeStore] Failed to set launcher wallpaper', e);
  }
}

const ThemeStoreNavigationHandler: React.FC = () => {
  const location = useLocation();
  const { back, go } = useThemeStoreGestures();

  const handleBackPress = useCallback((): boolean => {
    if (location.pathname === '/ranking') {
      go('home.open');
      return true;
    }
    if (location.pathname !== '/') {
      back();
      return true;
    }
    return false;
  }, [location.pathname, back, go]);

  useAppNavigationHandler('theme_store', { onBack: handleBackPress });

  return null;
};

function ThemeStoreBottomNav({ active }: { active: 'home' | 'ranking' }) {
  const s = useAppStrings(strings, stringsEn);
  const { bindTap } = useThemeStoreGestures();
  return (
    <nav className="theme-store-floating-nav" aria-label={s.bottom_navigation}>
      {active === 'home' ? (
        <span className="is-active"><Sparkles size={18} /><small>{s.nav_recommended}</small></span>
      ) : (
        <button {...bindTap('home.open')}><Sparkles size={18} /><small>{s.nav_recommended}</small></button>
      )}
      {active === 'ranking' ? (
        <span className="is-active"><Grid2X2 size={18} /><small>{s.nav_rank_category}</small></span>
      ) : (
        <button {...bindTap('ranking.open')}><Grid2X2 size={18} /><small>{s.nav_rank_category}</small></button>
      )}
      <span aria-disabled="true"><BarChart3 size={18} /><small>{s.nav_free}</small></span>
      <span aria-disabled="true"><Crown size={18} /><small>{s.nav_vip}</small></span>
      <span aria-disabled="true"><UserRound size={18} /><small>{s.nav_me}</small></span>
    </nav>
  );
}

function ThemeStoreHomePage() {
  const s = useAppStrings(strings, stringsEn);
  const { themeService, version } = useTheme();
  const { bindTap } = useThemeStoreGestures();
  const [tab, setTab] = useState<StoreTab>('themes');
  const [items, setItems] = useState<ThemeMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalogStatus, setCatalogStatus] = useState(themeService.getCatalogStatus());

  // Each refresh owns its result only until a newer refresh, category change, or unmount.
  const requestGeneration = useRef(0);
  const loadItems = useCallback((forceReload: boolean) => {
    const generation = ++requestGeneration.current;
    const isCurrent = () => requestGeneration.current === generation;
    setLoading(true);
    setError(null);
    const request =
      tab === 'themes'
        ? themeService.getInstalledThemes(forceReload)
        : tab === 'fonts'
          ? themeService.getFonts(forceReload)
          : themeService.getAod(forceReload);

    request
      .then((nextItems) => { if (isCurrent()) { setItems(nextItems); setCatalogStatus(themeService.getCatalogStatus()); } })
      .catch((e) => { if (isCurrent()) setError(e instanceof Error ? e.message : String(e)); })
      .finally(() => { if (isCurrent()) setLoading(false); });
  }, [tab, themeService]);

  useEffect(() => {
    loadItems(true);
    return () => { requestGeneration.current++; };
  }, [loadItems, version]);

  const selectTab = (nextTab: StoreTab) => {
    if (nextTab === tab) return;
    // Invalidate immediately, rather than waiting for the effect cleanup.
    requestGeneration.current++;
    setLoading(true);
    setTab(nextTab);
  };

  const currentThemeId = themeService.getCurrentThemeId();
  const itemKind = tab === 'themes' ? 'theme' : tab === 'fonts' ? 'font' : 'aod';
  const openItem = (themeMeta: ThemeMeta) => bindTap('item.open', { params: { kind: itemKind, id: themeMeta.id } });
  const renderCatalogCard = (themeMeta: ThemeMeta, className = '') => {
    const previewUrl = themeService.getThemePreviewUrls(themeMeta.id)[0] || '';
    const active = tab === 'themes' && currentThemeId === themeMeta.id;
    return (
      <button
        key={themeMeta.id}
        className={cn('theme-store-catalog-card text-left', className)}
        data-theme-store-item={themeMeta.id}
        {...openItem(themeMeta)}
      >
        <span className="theme-store-catalog-preview">
          {previewUrl ? <img src={previewUrl} alt={themeMeta.title} /> : null}
          {active ? <span className="theme-store-enabled-badge">{s.enabled}</span> : null}
        </span>
        <span className="theme-store-catalog-title">{themeMeta.title}</span>
        <span className="theme-store-catalog-author">{themeMeta.author || s.unknown_author}</span>
      </button>
    );
  };

  return (
    <div className="theme-store-reference-home h-full w-full bg-app-bg flex flex-col overflow-hidden" data-status-bar-foreground="light" data-navigation-bar-foreground="dark">
      <div className="theme-store-reference-head">
        <div style={{ height: statusBarHeight }} />
        <div className="theme-store-reference-toolbar">
          <div className="theme-store-category-rail" aria-label={s.categories}>
            <button className={cn('theme-store-category', tab === 'themes' && 'is-active')} onClick={() => selectTab('themes')}>{s.tab_themes}</button>
            <span className="theme-store-category" aria-disabled="true">{s.tab_wallpapers}</span>
            <span className="theme-store-category" aria-disabled="true">{s.tab_ringtones}</span>
            <span className="theme-store-category" aria-disabled="true">{s.tab_icons}</span>
            <span className="theme-store-category" aria-disabled="true">{s.tab_widgets}</span>
            <button className={cn('theme-store-category', tab === 'aod' && 'is-active')} onClick={() => selectTab('aod')}>{s.tab_aod}</button>
            <button className={cn('theme-store-category', tab === 'fonts' && 'is-active')} onClick={() => selectTab('fonts')}>{s.tab_fonts}</button>
          </div>
          <div className="theme-store-search-pill" aria-label={s.search} aria-disabled="true">
            <Search size={15} strokeWidth={2} />
            <span>{s.search}</span>
          </div>
          <button
            className="theme-store-refresh"
            onClick={() => loadItems(true)}
            aria-label={s.refresh}
          >
            <Sparkles size={18} />
          </button>
        </div>
      </div>

      <div className="theme-store-reference-scroll flex-1 overflow-y-auto no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical">
        {!loading && (catalogStatus === 'stale' || catalogStatus === 'unavailable') ? (
          <div className="px-4 py-2 text-sm text-amber-800 bg-amber-50" role="status" data-theme-catalog-status>
            {catalogStatus === 'stale' ? s.catalog_stale : s.catalog_unavailable}
          </div>
        ) : null}
        {loading ? (
          <div className="theme-store-reference-loading h-full flex items-center justify-center gap-2 text-gray-400">
            <IcLoading className="w-5 h-5 animate-spin" />
            <span className="text-sm">{s.loading}</span>
          </div>
        ) : error ? (
          <div className="p-4 text-sm text-red-600">{s.load_failed}{error}</div>
        ) : catalogStatus === 'unavailable' ? null : items.length === 0 ? (
          <div className="p-4 text-sm text-app-text-muted">
            <div>{s.no_resources_found}</div>
            <div className="mt-2 text-[12px] font-mono text-black/60">
              python3 scripts/dev/prepare-themes.py -&gt; public/themes
            </div>
          </div>
        ) : tab === 'themes' ? (
          <div className="theme-store-reference-content">
            <div className="theme-store-hero-strip" data-theme-store-hero>
              {items.slice(0, 3).map((themeMeta) => {
                const previewUrl = themeService.getThemePreviewUrls(themeMeta.id)[0] || '';
                return (
                  <button key={themeMeta.id} className="theme-store-hero-card" {...openItem(themeMeta)}>
                    {previewUrl ? <img src={previewUrl} alt={themeMeta.title} /> : null}
                    <span className="theme-store-hero-shade" />
                    <span className="theme-store-hero-copy">
                      <strong>{themeMeta.title}</strong>
                      <small>{themeMeta.author || s.official}</small>
                    </span>
                  </button>
                );
              })}
            </div>

            <section className="theme-store-section" data-theme-store-official>
              <div className="theme-store-section-heading">
                <h2>{s.official_selection}</h2>
                <span>{s.more} ›</span>
              </div>
              <div className="theme-store-official-grid">
                {items.slice(0, 4).map((themeMeta) => renderCatalogCard(themeMeta, 'is-official'))}
              </div>
            </section>

            {items.length > 4 ? (
              <section className="theme-store-section theme-store-more-section">
                <div className="theme-store-section-heading"><h2>{s.more_themes}</h2></div>
                <div className="theme-store-more-grid">{items.slice(4).map((themeMeta) => renderCatalogCard(themeMeta))}</div>
              </section>
            ) : null}
          </div>
        ) : (
          <div className="theme-store-generic-grid">{items.map((themeMeta) => renderCatalogCard(themeMeta))}</div>
        )}
      </div>

      <ThemeStoreBottomNav active="home" />
    </div>
  );
}

function ThemeStoreRankingPage() {
  const s = useAppStrings(strings, stringsEn);
  const { themeService, version } = useTheme();
  const { bindTap } = useThemeStoreGestures();
  const [items, setItems] = useState<ThemeMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [catalogStatus, setCatalogStatus] = useState(themeService.getCatalogStatus());
  const requestGeneration = useRef(0);
  const loadItems = useCallback(() => {
    const generation = ++requestGeneration.current;
    const isCurrent = () => generation === requestGeneration.current;
    setLoading(true);
    setError(null);
    themeService.getInstalledThemes(true)
      .then(nextItems => { if (isCurrent()) { setItems(nextItems); setCatalogStatus(themeService.getCatalogStatus()); } })
      .catch(reason => { if (isCurrent()) setError(reason instanceof Error ? reason.message : String(reason)); })
      .finally(() => { if (isCurrent()) setLoading(false); });
  }, [themeService]);

  useEffect(() => {
    loadItems();
    return () => { requestGeneration.current++; };
  }, [loadItems, version]);

  return (
    <div className="theme-store-ranking-page h-full w-full overflow-hidden" data-status-bar-foreground="dark" data-navigation-bar-foreground="dark">
      <header className="theme-store-ranking-head">
        <div style={{ height: statusBarHeight }} />
        <div className="theme-store-ranking-title-row">
          <div>
            <h1>{s.ranking_title}</h1>
            <p>{s.ranking_subtitle}</p>
          </div>
          <Search size={19} aria-label={s.search} />
        </div>
        <div className="theme-store-ranking-categories">
          <span className="is-active">{s.tab_themes}</span>
          <span>{s.tab_fonts}</span><span>{s.tab_wallpapers}</span><span>{s.tab_ringtones}</span>
          <span>{s.tab_aod}</span><span>{s.tab_widgets}</span><span>{s.tab_icons}</span>
        </div>
      </header>

      <div className="theme-store-ranking-body">
        <aside className="theme-store-ranking-rail" aria-label={s.ranking_types}>
          <span className="is-active">{s.rank_hot}</span>
          <span>{s.rank_free}</span><span>{s.rank_new}</span><span>{s.rank_favorite}</span><span>{s.rank_apps}</span>
        </aside>
        <main className="theme-store-ranking-scroll" data-scroll-container="main" data-scroll-direction="vertical">
          {!loading && (catalogStatus === 'stale' || catalogStatus === 'unavailable') ? (
            <div className="px-4 py-2 text-sm text-amber-800 bg-amber-50">
              <div role="status" data-theme-catalog-status>{catalogStatus === 'stale' ? s.catalog_stale : s.catalog_unavailable}</div>
              <button className="mt-2 underline" {...bindTap({ kind: 'action', id: 'themeStore.ranking.retry' }, { onTrigger: loadItems })}>{s.refresh}</button>
            </div>
          ) : null}
          {loading ? (
            <div className="theme-store-reference-loading"><IcLoading className="w-5 h-5 animate-spin" /><span>{s.loading}</span></div>
          ) : error ? (
            <div className="theme-store-ranking-error">{s.load_failed}{error}</div>
          ) : catalogStatus === 'unavailable' ? null : (
            <div className="theme-store-ranking-grid" data-theme-store-ranking-grid>
              {items.map((themeMeta, index) => {
                const previewUrl = themeService.getThemePreviewUrls(themeMeta.id)[0] || '';
                return (
                  <button
                    key={themeMeta.id}
                    className="theme-store-ranking-card"
                    data-theme-rank={index + 1}
                    {...bindTap('item.open', { params: { kind: 'theme', id: themeMeta.id } })}
                  >
                    <span className="theme-store-ranking-preview">
                      {previewUrl ? <img src={previewUrl} alt={themeMeta.title} /> : null}
                      <b>{index + 1}</b>
                      <em>{s.free}</em>
                    </span>
                    <strong>{themeMeta.title}</strong>
                    <small>{themeMeta.author || s.unknown_author}</small>
                  </button>
                );
              })}
            </div>
          )}
        </main>
      </div>
      <ThemeStoreBottomNav active="ranking" />
    </div>
  );
}

function StoreItemDetailPage() {
  const s = useAppStrings(strings, stringsEn);
  const { themeService, version } = useTheme();
  const { bindBack, bindTap } = useThemeStoreGestures();
  const location = useLocation();
  const activityId = useActivityId();
  const { navigator } = React.useContext(UNSAFE_NavigationContext);
  const params = useParams<{ kind: 'theme' | 'font' | 'aod'; id: string }>();
  const kind = params.kind || 'theme';
  const id = params.id || '';
  const [themeMeta, setThemeMeta] = useState<ThemeMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const applyGate = useRef(new ThemeApplyGate());
  const liveSource = useRef({ key: location.key, id, kind, themeMeta });
  liveSource.current = { key: location.key, id, kind, themeMeta };
  React.useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const sameSource = () => {
    const history = (navigator as { location?: { key?: string } }).location;
    return mounted.current && liveSource.current.key === location.key
      && (!history?.key || history.key === location.key) && liveSource.current.id === id
      && liveSource.current.kind === kind && liveSource.current.themeMeta === themeMeta;
  };
  const canStartApply = () => {
    const os = TaskManager.getState();
    return sameSource() && kind === 'theme' && themeMeta?.id === id && !loading
      && !os.isLauncherVisible && !os.isRecentsVisible
      && os.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1)?.activityId === activityId;
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const request =
      kind === 'theme'
        ? themeService.getInstalledThemes(false)
        : kind === 'font'
          ? themeService.getFonts(false)
          : themeService.getAod(false);

    request
      .then((nextItems) => {
        if (!cancelled) setThemeMeta(nextItems.find((item) => item.id === id) || null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, kind, themeService, version]);

  const currentThemeId = themeService.getCurrentThemeId();
  const active = kind === 'theme' ? currentThemeId === id : false;

  const previewPaths = useMemo(() => {
    if (!themeMeta) return [];
    return themeService.getThemePreviewUrls(themeMeta.id);
  }, [themeMeta, themeService]);

  const supportsIcons = (themeMeta?.iconPackageNames?.length || 0) > 0;
  const supportsWallpaper = !!themeMeta?.extracted?.wallpaper?.default;
  const supportsStatusbar = (themeMeta?.statusbarIcons?.length || 0) > 0;
  const supportsShade = !!themeMeta?.extracted?.shade;

  const apply = async (applyKind: 'theme' | 'icons' | 'wallpaper') => {
    if (!themeMeta) return;
    await applyGate.current.run(
      () => canStartApply() && (applyKind !== 'icons' || supportsIcons) && (applyKind !== 'wallpaper' || supportsWallpaper),
      async () => {
        setApplying(applyKind);
        setError(null);
        try {
          if (applyKind === 'theme') {
            await themeService.applyTheme(themeMeta.id);
            const wallpaperUrl = themeService.getThemeWallpaperUrl(themeMeta.id);
            if (wallpaperUrl) setLauncherWallpaper({ kind: 'image', imageUrl: wallpaperUrl });
          }
          if (applyKind === 'icons') await themeService.applyComponent(themeMeta.id, 'icons');
          if (applyKind === 'wallpaper') {
            const wallpaperUrl = themeService.getThemeWallpaperUrl(themeMeta.id);
            if (!wallpaperUrl) throw new Error(s.no_available_wallpaper);
            setLauncherWallpaper({ kind: 'image', imageUrl: wallpaperUrl });
          }
        } catch (e) {
          if (sameSource()) setError(e instanceof Error ? e.message : String(e));
        } finally {
          if (mounted.current) setApplying(null);
        }
      },
    );
  };

  return (
    <div className="h-full w-full bg-app-bg flex flex-col overflow-hidden" data-status-bar-foreground="dark" data-navigation-bar-foreground="dark">
      <div className="bg-app-surface border-b border-black/5">
        <div style={{ height: statusBarHeight }} />
        <div className="h-(--app-top-bar-height) px-2 flex items-center gap-2">
          <button className="w-10 h-10 rounded-full flex items-center justify-center" {...bindBack()}>
            <IcNavBack className="w-5 h-5 text-black" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-black truncate">{themeMeta?.title || s.theme_detail}</div>
            <div className="text-xs text-app-text-muted truncate">{themeMeta?.author || ''}</div>
          </div>
          {active ? pill(s.enabled, 'green') : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar" data-scroll-container="main" data-scroll-direction="vertical">
        {loading ? (
          <div className="h-full flex items-center justify-center gap-2 text-gray-400">
            <IcLoading className="w-5 h-5 animate-spin" />
            <span className="text-sm">{s.loading}</span>
          </div>
        ) : !themeMeta ? (
          <div className="p-4 text-sm text-app-text-muted">{s.resource_not_found}{id}</div>
        ) : (
          <div className="p-3 space-y-3">
            <div className="bg-app-surface rounded-2xl overflow-hidden border border-black/5">
              <div className="grid grid-cols-2 gap-2 p-2">
                {previewPaths.slice(0, 4).map((previewPath) => (
                  <div key={previewPath} className="h-(--app-detail-preview-image-h) rounded-xl overflow-hidden bg-black/5">
                    <img src={previewPath} alt={themeMeta.title} className="h-full w-full object-cover" />
                  </div>
                ))}
              </div>
            </div>

            {kind === 'theme' ? (
              <>
                <div className="bg-app-surface rounded-2xl border border-black/5 p-3">
                  <div className="text-sm font-semibold text-black">{s.apply}</div>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="flex-1 h-10 rounded-xl bg-blue-600 text-white text-sm font-semibold disabled:opacity-60"
                      disabled={!!applying}
                      {...bindTap({ kind: 'action', id: 'themeStore.item.theme.submit' }, { params: { themeId: id }, onTrigger: () => { void apply('theme'); } })}
                    >
                      {applying === 'theme' ? s.applying : s.apply_full_theme}
                    </button>
                  </div>
                  <div className="mt-3 text-xs text-app-text-muted flex flex-wrap gap-1">
                    {supportsIcons ? pill(s.pill_icons, 'blue') : pill(s.pill_icons, 'gray')}
                    {supportsWallpaper ? pill(s.pill_wallpaper, 'blue') : pill(s.pill_wallpaper, 'gray')}
                    {supportsStatusbar ? pill(s.pill_statusbar, 'blue') : pill(s.pill_statusbar, 'gray')}
                    {supportsShade ? pill(s.pill_control_center, 'blue') : pill(s.pill_control_center, 'gray')}
                  </div>
                </div>

                <div className="bg-app-surface rounded-2xl border border-black/5 p-3">
                  <div className="text-sm font-semibold text-black">{s.mix_and_match}</div>
                  <div className="mt-2 flex gap-2">
                    <button
                      className="flex-1 h-10 rounded-xl bg-black text-white text-sm font-semibold disabled:opacity-60"
                      disabled={!!applying || !supportsIcons}
                      {...bindTap({ kind: 'action', id: 'themeStore.item.icons.submit' }, { params: { themeId: id }, onTrigger: () => { void apply('icons'); } })}
                    >
                      {applying === 'icons' ? s.applying : s.apply_icons_only}
                    </button>
                    <button
                      className="flex-1 h-10 rounded-xl bg-black text-white text-sm font-semibold disabled:opacity-60"
                      disabled={!!applying || !supportsWallpaper}
                      {...bindTap({ kind: 'action', id: 'themeStore.item.wallpaper.submit' }, { params: { themeId: id }, onTrigger: () => { void apply('wallpaper'); } })}
                    >
                      {applying === 'wallpaper' ? s.applying : s.apply_wallpaper_only}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-app-surface rounded-2xl border border-black/5 p-3 text-sm text-app-text-muted">
                {kind === 'font' ? s.sim_font_not_supported : s.sim_aod_not_supported}
              </div>
            )}

            {error ? <div className="text-sm text-red-600 px-1">{s.operation_failed}{error}</div> : null}
          </div>
        )}
      </div>
    </div>
  );
}

const ThemeStoreApp: React.FC = () => {
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
    <div className="h-full w-full" style={cssVars as React.CSSProperties}>
      <MemoryRouter>
        <ThemeStoreNavigationHandler />
        <Routes>
          <Route path="/" element={<ThemeStoreHomePage />} />
          <Route path="/ranking" element={<ThemeStoreRankingPage />} />
          <Route path="/item/:kind/:id" element={<StoreItemDetailPage />} />
        </Routes>
      </MemoryRouter>
    </div>
  );
};

export default ThemeStoreApp;
