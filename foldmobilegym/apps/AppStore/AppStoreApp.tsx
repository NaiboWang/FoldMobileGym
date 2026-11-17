import React from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { useAppStrings } from '../../os/useAppStrings';
import { useAppNavigate } from './navigation';
import { useAppStoreGestures } from './hooks/useAppStoreGestures';
import { strings } from './res/strings';
import { stringsEn } from './res/strings.en';
import { IcToday, IcApps, IcSearch } from './res/icons';
import { FeaturedPage, AppsPage, SearchPage, DetailPage } from './pages/StorePages';
import './appstore.css';
import { StoreScrollMemory } from './scrollMemory';

function AppStoreContent() {
  const location = useLocation();
  const { back } = useAppNavigate();
  const { bindTap, go } = useAppStoreGestures();
  const t = useAppStrings(strings, stringsEn);
  const detail = location.pathname.startsWith('/app/');
  useAppNavigationHandler('appstore', { onBack: () => {
    if (location.pathname === '/' && !location.search) return false;
    back(); return true;
  } });
  return <div className="appstore-shell pt-10" data-status-bar-foreground="dark" data-navigation-bar-foreground="dark">
    <div className="appstore-body appstore-reference-layout">
      {detail && <aside className="appstore-reference-master" aria-label={t.apps}><AppsPage scrollName="catalog" /></aside>}
      <div className="appstore-reference-detail"><Routes>
      <Route path="/" element={<FeaturedPage />} />
      <Route path="/apps" element={<AppsPage />} />
      <Route path="/search" element={<SearchPage key={location.search} />} />
      <Route path="/app/:appId" element={<DetailPage />} />
    </Routes></div></div>
    {!detail && <nav className="appstore-tabs" data-hide-on-keyboard aria-label="App Store">
      <button {...bindTap('appstore.tab.featured', { onTrigger: () => { if (location.pathname !== '/') go('appstore.tab.featured'); } })} aria-current={location.pathname === '/' ? 'page' : undefined}><IcToday size={23} />{t.today}</button>
      <button {...bindTap('appstore.tab.apps', { onTrigger: () => { if (location.pathname !== '/apps') go('appstore.tab.apps'); } })} aria-current={location.pathname === '/apps' ? 'page' : undefined}><IcApps size={23} />{t.apps}</button>
      <button {...bindTap('appstore.tab.search', { onTrigger: () => { if (location.pathname !== '/search') go('appstore.tab.search'); } })} aria-current={location.pathname === '/search' ? 'page' : undefined}><IcSearch size={23} />{t.search}</button>
    </nav>}
  </div>;
}
export default function AppStoreApp() {
  return <MemoryRouter><StoreScrollMemory><AppStoreContent /></StoreScrollMemory></MemoryRouter>;
}
