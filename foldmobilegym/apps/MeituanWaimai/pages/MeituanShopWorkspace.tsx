import React from 'react';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { useMeituanGestures } from '../hooks/useMeituanGestures';
import type { Shop } from '../types';
import bowlPhoto from '../res/chicken-bowl.png';

/** A native in-App context/detail pair, not an OS split-screen task. */
export function MeituanShopWorkspace({ enabled, homePanel, shops, query, selectedId, onShop, children }: {
  homePanel?: React.ReactNode;
  enabled: boolean; shops: Shop[]; query: string; selectedId: string;
  onShop: (id: string) => void; children: React.ReactNode;
}) {
  const t = useAppStrings(strings, stringsEn);
  const { bindTap, bindBack } = useMeituanGestures();
  return <div className="mt-shop-workspace" data-meituan-workspace={enabled}>
    {enabled && <aside className="mt-shop-context" data-meituan-shop-context={homePanel ? 'home' : 'search'} aria-label={homePanel ? t.home : t.main_search_results}>
      {homePanel ?? <>
      <header className="mt-context-header"><button aria-label={t.back} {...bindBack()}>‹</button><b>{t.main_search_results}</b></header>
      <p className="mt-context-query" data-meituan-context-query>{query || t.main_home_search}</p>
      <main className="mt-main" data-scroll-container="context" data-scroll-direction="vertical">
        <div className="mt-shop-list">{shops.map(item => <button className="mt-shop-card" key={item.id}
          aria-current={item.id === selectedId ? 'page' : undefined}
          {...bindTap('meituan.context.shop.open', { params: { id: item.id }, onTrigger: () => onShop(item.id) })}>
          <div className="mt-shop-art">{item.id === 'rice' ? <img src={bowlPhoto} alt=""/> : <span>{item.id === 'salad' ? '🥗' : item.id === 'market' ? '🛒' : '🧋'}</span>}</div>
          <div className="mt-shop-info"><strong>{item.name}</strong><div className="mt-shop-rating">★ {item.rating}<span>{item.sales}</span></div><small>{item.time}</small><i>{item.category}</i></div>
        </button>)}{shops.length === 0 && <p className="mt-empty">{t.noResults}</p>}</div>
      </main>
      </>}
    </aside>}
    <section className="mt-shop-detail">{children}</section>
  </div>;
}
