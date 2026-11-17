import React, { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { AppIcon } from '../../../os/components/AppIcon';
import type { AppManifest } from '../../../os/types/manifest';
import { getLocalizedAppName } from '../../../os/data/appRegistry';
import { useAppStrings } from '../../../os/useAppStrings';
import { useAppStoreGestures } from '../hooks/useAppStoreGestures';
import { getCatalog, searchCatalog } from '../catalog';
import { FEATURED_IDS } from '../constants';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { IcBack, IcSearch, IcLauncher } from '../res/icons';
import { StorePage } from '../scrollMemory';

function AppRows({ apps }: { apps: AppManifest[] }) {
  const location = useLocation();
  const { bindTap } = useAppStoreGestures();
  const t = useAppStrings(strings, stringsEn);
  return <div className="appstore-grid">{apps.map(app =>
    <button className="appstore-row" key={app.id} {...bindTap('appstore.item.detail', { params: { appId: app.id } })} aria-current={location.pathname === `/app/${app.id}` ? 'page' : undefined} aria-label={`${getLocalizedAppName(app.id)} · ${t.details}`}>
      <AppIcon manifest={app} size={54} radius={13} />
      <span className="appstore-row-text"><strong>{getLocalizedAppName(app.id)}</strong><small>{app.type === 'system' ? t.system : t.daily}</small></span>
      <span className="appstore-pill">{t.installed}</span>
    </button>)}</div>;
}

export function FeaturedPage() {
  const t = useAppStrings(strings, stringsEn);
  const catalog = getCatalog();
  const featured = FEATURED_IDS.flatMap(id => catalog.filter(app => app.id === id));
  return <StorePage>
    <header><small className="appstore-eyebrow">App Store</small><h1>{t.today}</h1></header>
    <div className="appstore-hero">
      <span>{t.featured}</span><h2>{t.headline}</h2><p>{t.subtitle}</p>
      <div className="appstore-hero-icons" aria-hidden="true">{featured.slice(0, 4).map(app => <AppIcon key={app.id} manifest={app} size={60} radius={15} />)}</div>
    </div>
    <h2 className="appstore-section-title">{t.featured}</h2><AppRows apps={featured} />
    <p className="appstore-notice">{t.notice}</p>
  </StorePage>;
}

export function AppsPage({ scrollName = 'main' }: { scrollName?: 'main' | 'catalog' }) {
  const t = useAppStrings(strings, stringsEn);
  const catalog = getCatalog();
  return <StorePage scrollName={scrollName}>
    <header><small className="appstore-eyebrow">App Store</small><h1>{t.apps}</h1><p>{t.available} · {catalog.length}</p></header>
    <h2 className="appstore-section-title">{t.daily}</h2><AppRows apps={catalog.filter(app => app.type !== 'system')} />
    <h2 className="appstore-section-title">{t.system}</h2><AppRows apps={catalog.filter(app => app.type === 'system')} />
    <p className="appstore-notice">{t.notice}</p>
  </StorePage>;
}

export function SearchPage() {
  const t = useAppStrings(strings, stringsEn);
  const { bindTap, go } = useAppStoreGestures();
  const location = useLocation();
  const routeQuery = new URLSearchParams(location.search).get('q') || '';
  const [query, setQuery] = useState(routeQuery);
  const results = searchCatalog(getCatalog(), routeQuery);
  return <StorePage>
    <header><h1>{t.search}</h1></header>
    <form className="appstore-search" onSubmit={event => { event.preventDefault(); go('appstore.search.results', { q: query.trim() }); }}>
      <IcSearch size={20} />
      <input type="search" value={query} aria-label={t.searchPlaceholder} placeholder={t.searchPlaceholder}
        data-action="appstore.search.query.input" data-action-type="input" data-action-params={JSON.stringify({ value: query })}
        onChange={event => setQuery(event.target.value)} />
      <button type="button" {...bindTap('appstore.search.results', { params: { q: query.trim() } })}>{t.search}</button>
    </form>
    {routeQuery.trim() ? <>
      <h2 className="appstore-section-title">{t.search} · {results.length}</h2>
      {results.length ? <AppRows apps={results} /> : <div className="appstore-empty"><IcSearch size={40} /><h2>{t.empty}</h2><p>{t.emptyHint}</p></div>}
    </> : <><p className="appstore-search-hint">{t.searchHint}</p><AppRows apps={getCatalog().filter(app => FEATURED_IDS.includes(app.id))} /></>}
  </StorePage>;
}

export function DetailPage() {
  const { appId } = useParams();
  const t = useAppStrings(strings, stringsEn);
  const { bindTap, bindBack } = useAppStoreGestures();
  const app = getCatalog().find(item => item.id === appId);
  return <StorePage key={appId}>
    <button className="appstore-back" {...bindBack()}><IcBack size={20} />{t.back}</button>
    {app ? <>
      <div className="appstore-detail-header"><AppIcon manifest={app} size={96} radius={22} />
        <div><h1>{getLocalizedAppName(app.id)}</h1><p>{app.type === 'system' ? t.system : t.daily}</p>
          <button className="appstore-open" {...bindTap({ kind: 'action', id: 'appstore.detail.item.open' }, {
            params: { appId: app.id }, onTrigger: () => { window.__OS__?.openApp(app.id); },
          })}>{t.open}</button></div>
      </div>
      <div className="appstore-metadata"><div><small>{t.version}</small><strong>{app.version}</strong></div><div><small>{t.installed}</small><strong>{t.available}</strong></div></div>
      <h2 className="appstore-section-title">{t.about}</h2><p>{app.type === 'system' ? t.systemDescription : t.dailyDescription}</p>
      <div className="appstore-compatible"><IcLauncher size={30} color="#087dff" /><div><strong>{t.compatibility}</strong><p>{t.compatible}</p></div></div>
      <p className="appstore-notice">{t.notice}</p>
    </> : <div className="appstore-empty"><h2>{t.unavailable}</h2></div>}
  </StorePage>;
}
