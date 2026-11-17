import React from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { SettingsMainPage } from './SettingsMainPage';
import { SettingsSearchPage } from './SettingsSearchPage';
import { PreferenceScreenPage } from './PreferenceScreen';
import { useSettingsStrings } from '../res/useSettingsStrings';
import { getSettingsInputMethodSheet } from '../settingsLanguageInput';
import '../reference.css';

/** Persistent directory and existing route outlet; posture changes are CSS only. */
export function ReferenceSettingsLayout() {
  const location = useLocation();
  const { s } = useSettingsStrings();
  const inSearchFlow = location.pathname === '/search' || location.pathname.startsWith('/search/');
  const searchHasDetail = location.pathname.startsWith('/search/');
  const inputMethodSheetOpen = getSettingsInputMethodSheet(location.pathname, location.search) !== null;
  const classes = [
    'settings-reference-layout',
    location.pathname === '/' ? 'settings-reference-home' : '',
    inSearchFlow ? 'settings-reference-search' : '',
    inSearchFlow && !searchHasDetail ? 'settings-reference-search-home' : '',
    searchHasDetail ? 'settings-reference-search-detail' : '',
  ].filter(Boolean).join(' ');

  return <div className={classes}>
    <aside className="settings-reference-master" aria-label={inSearchFlow ? s.search_settings : s.settings} inert={inputMethodSheetOpen || undefined}>
      {inSearchFlow ? <SettingsSearchPage selectedPageId={searchHasDetail ? location.pathname.slice('/search/'.length) : undefined} /> : <SettingsMainPage scrollContainer="master" />}
    </aside>
    <main className="settings-reference-detail">
      <Routes>
        <Route path="/" element={<div className="settings-reference-empty pt-10"><p>{s.select_setting}</p></div>} />
        <Route path="/search" element={<div className="settings-reference-empty pt-10"><p>{s.select_setting}</p></div>} />
        <Route path="/search/:pageId" element={<PreferenceScreenPage />} />
        <Route path="/page/:pageId" element={<PreferenceScreenPage />} />
      </Routes>
    </main>
  </div>;
}
