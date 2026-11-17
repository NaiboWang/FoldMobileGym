import React, { useMemo, useRef, useState } from 'react';
import { IcNavBack, IcSearch, IcClose } from '../res/icons';
import { SETTINGS_PAGE_OVERRIDES } from '../data/settingsOverrides';
import { PreferenceItem } from './PreferenceItem';
import type { SettingsPage } from '../types';
import { useSettingsStrings } from '../res/useSettingsStrings';
import { useSettingsStore, selectPagesData, selectPagesLoading, selectPagesError } from '../state';
import { useSettingsGestures } from '../hooks/useSettingsGestures';
import { InputMethodSearchResults } from './InputMethodSearchResults';
import { isInputMethodSearchQuery } from '../settingsLanguageInput';
type SearchResult = {
  pageId: string;
  title: string;
  preview?: string;
  score: number;
};

function includesInsensitive(haystack: string, needle: string) {
  if (!haystack || !needle) return false;
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export const SettingsSearchPage: React.FC<{ selectedPageId?: string }> = ({ selectedPageId }) => {
  const { bindTap, bindBack, go } = useSettingsGestures();
  const { s, t } = useSettingsStrings();
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const data = useSettingsStore(selectPagesData);
  const loading = useSettingsStore(selectPagesLoading);
  const error = useSettingsStore(selectPagesError);
  const mainSections = data?.mainSections ?? null;
  const pages = data?.pages ?? null;

  const allPages: Record<string, SettingsPage> = useMemo(() => {
    // Prefer hand-written overrides when present.
    return { ...(pages || {}), ...SETTINGS_PAGE_OVERRIDES };
  }, [pages]);

  const mainTargetPageTitleMap: Record<string, string> = useMemo(() => {
    const map: Record<string, string> = {};
    if (!mainSections) return map;
    for (const section of mainSections) {
      for (const item of section.items) {
        if (item.targetPage && item.title && !map[item.targetPage]) {
          map[item.targetPage] = item.title;
        }
      }
    }
    return map;
  }, [mainSections]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim();
    if (!q) return [];

    const out: SearchResult[] = [];

    for (const [pageId, page] of Object.entries(allPages)) {
      const title = pageId === 'language_and_input'
        ? s.language_input_title
        : pageId === 'modes_display_settings'
          ? s.mode_display_effects
          : (mainTargetPageTitleMap[pageId] || page.title || pageId);
      let score = 0;
      let preview = '';

      if (includesInsensitive(title, q) || includesInsensitive(pageId, q)) {
        score = mainTargetPageTitleMap[pageId] ? 110 : 100;
      } else {
        // Try match within items
        for (const cat of page.categories || []) {
          for (const item of cat.items || []) {
            if (item.title && includesInsensitive(item.title, q)) {
              score = 60;
              preview = item.title;
              break;
            }
            if (item.summary && includesInsensitive(item.summary, q)) {
              score = 40;
              preview = item.summary;
              break;
            }
          }
          if (score) break;
        }
      }

      if (score) {
        out.push({
          pageId,
          title,
          preview: pageId === 'modes_display_settings' ? s.mode_display_effects_summary : (preview || undefined),
          score,
        });
      }
    }

    out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'zh-Hans-CN'));
    return out.slice(0, 60);
  }, [allPages, query, mainTargetPageTitleMap, s]);

  const hasQuery = query.trim().length > 0;
  const hasData = !!pages;
  const showInputMethodResults = isInputMethodSearchQuery(query);
  const openSearchResult = (pageId: string) => {
    inputRef.current?.blur();
    window.__OS__?.keyboard.hide();
    go('settings.search.result.open', { pageId });
  };

  return (
    <div className="h-full bg-app-bg flex flex-col">
      <div className="sticky top-0 z-20 bg-app-bg shrink-0">
        <div className="h-10" />
        <div className="flex items-center h-11 px-2 gap-2">
          <button
            {...bindBack<HTMLButtonElement>()}
            className="w-10 h-10 flex items-center justify-center rounded-full active:bg-black/5"
            aria-label={s.back}
            type="button"
          >
            <IcNavBack size={24} className="text-app-text" />
          </button>

          <div className="flex-1 min-w-0 bg-app-surface rounded-full flex items-center px-4 py-2.5 gap-2">
            <IcSearch size={16} className="text-gray-400 flex-shrink-0" />
            <input
              ref={inputRef}
              data-settings-search-query
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={s.search_settings}
              aria-label={s.search_settings}
              className="flex-1 min-w-0 bg-transparent outline-none text-[14px] text-app-text placeholder:text-gray-400"
              autoFocus
            />
            {hasQuery && (
              <button
                type="button"
                className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center active:bg-gray-200"
                aria-label={s.clear}
                onClick={() => setQuery('')}
              >
                <IcClose size={14} className="text-app-text-muted" />
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar pb-8">
        {!hasQuery ? (
          <div className="px-6 py-10 text-[13px] text-gray-400">{s.enter_keywords_to_search}</div>
        ) : !hasData ? (
          <div className="px-6 py-10 text-[13px] text-gray-400">
            {error ? s.settings_data_load_failed : (loading ? s.loading_settings_data : s.settings_data_not_ready)}
          </div>
        ) : showInputMethodResults ? (
          <InputMethodSearchResults query={query} selectedPageId={selectedPageId} onOpenPage={openSearchResult} />
        ) : results.length === 0 ? (
          <div className="px-6 py-10 text-[13px] text-gray-400">{s.no_matching_settings_found}</div>
        ) : (
          <div className="px-4 mt-2">
            <div className="bg-app-surface rounded-2xl overflow-hidden">
              {results.map((r, idx) => (
                <PreferenceItem
                  key={r.pageId}
                  title={t(r.title)}
                  summary={r.preview ? t(r.preview) : undefined}
                  showDivider={idx < results.length - 1}
                  showChevron={true}
                  itemProps={{
                    ...bindTap<HTMLDivElement>('settings.search.result.open', {
                      params: { pageId: r.pageId },
                      onTrigger: () => openSearchResult(r.pageId),
                    }),
                    'data-settings-search-result': r.pageId,
                    'aria-current': selectedPageId === r.pageId ? 'page' : undefined,
                  } as React.HTMLAttributes<HTMLDivElement>}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
