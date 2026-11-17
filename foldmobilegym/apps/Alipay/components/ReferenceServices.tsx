import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAlipayStore } from '../state';
import { ALIPAY_CONFIG } from '../data';
import { useAlipayStrings } from '../hooks/useAlipayStrings';
import { useLocale } from '../locale';
import { localizeServiceName } from '../utils/localizeCatalog';
import { IconRenderer } from './IconRenderer';
import { REFERENCE_PUBLIC_SERVICES, REFERENCE_LIFE_SERVICES } from '../constants';
import { IcSearch } from '../res/icons';

/** Existing simulator catalog only: no copied private favorites or fake launches. */
export function ReferenceServices({ transferProps, recentProps, favoritesProps, bindCategory, searchProps }: { transferProps: React.ButtonHTMLAttributes<HTMLButtonElement>; recentProps: React.ButtonHTMLAttributes<HTMLButtonElement>; favoritesProps: React.ButtonHTMLAttributes<HTMLButtonElement>; searchProps?: React.ButtonHTMLAttributes<HTMLButtonElement>; bindCategory: (categoryId: string, onTrigger: () => void) => React.ButtonHTMLAttributes<HTMLButtonElement> }) {
  const services = useAlipayStore(s => s.mainServices);
  const common = useAlipayStore(s => s.commonServices);
  const finance = useAlipayStore(s => s.financeServices);
  const civic = useAlipayStore(s => s.myCivicServices);
  const recent = useAlipayStore(s => s.recentServiceIds) ?? ALIPAY_CONFIG.recentServiceIds;
  const favorites = useAlipayStore(s => s.favoriteServiceIds) ?? ALIPAY_CONFIG.favoriteServiceIds;
  const s = useAlipayStrings();
  const isEnglish = useLocale() === 'en';
  const [search] = useSearchParams();
  const isFavorites = search.get('serviceCollection') === 'favorites';
  const sections = React.useRef<Record<string, HTMLElement | null>>({});
  const categoryNav = React.useRef<HTMLElement | null>(null);
  const requestedCategory = React.useRef<string | null>(null);
  const [visibleCategory, setVisibleCategory] = React.useState('life');
  // This is derived scroll feedback, not a separate tab or a hidden navigation state.
  React.useEffect(() => {
    const nav = categoryNav.current;
    const pane = nav?.closest<HTMLElement>('[data-scroll-container]');
    if (!nav || !pane) return;
    const scrollRoot = pane.parentElement ?? pane;
    let pendingFrame = 0;
    const update = () => {
      pendingFrame = 0;
      let scroller = pane;
      while (!/auto|scroll/.test(getComputedStyle(scroller).overflowY) && scroller.parentElement) {
        scroller = scroller.parentElement;
      }
      const viewport = scroller.getBoundingClientRect();
      const top = Math.max(viewport.top, nav.getBoundingClientRect().bottom);
      let selected = 'life';
      let largestVisibleHeight = 0;
      for (const [id, section] of Object.entries(sections.current)) {
        if (!section) continue;
        const rect = section.getBoundingClientRect();
        const visibleHeight = Math.max(0, Math.min(rect.bottom, viewport.bottom) - Math.max(rect.top, top));
        if (visibleHeight > largestVisibleHeight) {
          selected = id;
          largestVisibleHeight = visibleHeight;
        }
      }
      // At the end of a short directory several complete sections can be visible.
      // Keep the user's requested section selected until they start manual scrolling.
      if (requestedCategory.current) selected = requestedCategory.current;
      if (largestVisibleHeight > 0) setVisibleCategory(selected);
    };
    const schedule = () => {
      if (!pendingFrame) pendingFrame = requestAnimationFrame(update);
    };
    const resize = new ResizeObserver(schedule);
    const resumeScrollFeedback = () => { requestedCategory.current = null; schedule(); };
    const onKeyDown = (event: KeyboardEvent) => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) resumeScrollFeedback();
    };
    resize.observe(pane);
    resize.observe(nav);
    // Capture also sees the enclosing single-page scroller when the device is folded.
    scrollRoot.addEventListener('scroll', schedule, { passive: true, capture: true });
    scrollRoot.addEventListener('wheel', resumeScrollFeedback, { passive: true });
    scrollRoot.addEventListener('pointerdown', resumeScrollFeedback);
    scrollRoot.addEventListener('keydown', onKeyDown);
    update();
    return () => {
      scrollRoot.removeEventListener('scroll', schedule, true);
      scrollRoot.removeEventListener('wheel', resumeScrollFeedback);
      scrollRoot.removeEventListener('pointerdown', resumeScrollFeedback);
      scrollRoot.removeEventListener('keydown', onKeyDown);
      resize.disconnect();
      if (pendingFrame) cancelAnimationFrame(pendingFrame);
    };
  }, []);
  const catalog = [...services.filter(item => item.id !== 'more'), ...common, ...finance, ...civic];
  const collection = (isFavorites ? favorites : recent).flatMap(id => {
    const service = catalog.find(item => item.id === id); return service ? [service] : [];
  });
  const categories = [
    { id: 'life', label: s.reference_category_life, items: REFERENCE_LIFE_SERVICES },
    { id: 'shopping', label: s.reference_category_shopping, items: [...services.filter(item => item.id === 'movie'), ...common] },
    { id: 'finance', label: s.reference_category_finance, items: finance },
    { id: 'public', label: s.reference_category_public, items: REFERENCE_PUBLIC_SERVICES },
  ];
  const renderService = (service: typeof catalog[number]) => {
    const body = <><div className="alipay-reference-service-icon" style={{'--service-color': service.color} as React.CSSProperties}><IconRenderer name={service.icon} size={30} color={service.color} /></div><span>{localizeServiceName(service.id, service.name, isEnglish)}</span></>;
    return service.id === 'transfer'
      ? <button key={service.id} className="alipay-reference-service" data-reference-service-id={service.id} {...transferProps}>{body}</button>
      : <div key={service.id} className="alipay-reference-service" data-reference-service-id={service.id}>{body}</div>;
  };
  return <>
    <header className="alipay-reference-services-heading"><h2>{s.more_services}</h2>{searchProps && <button type="button" className="alipay-reference-services-search-entry" aria-label={s.search} {...searchProps}><IcSearch size={22} /></button>}</header>
    <div className="alipay-reference-service-card alipay-reference-collection">
      <div className="alipay-reference-collection-tabs">
        <button {...recentProps} aria-pressed={!isFavorites}>{s.reference_recent_services}</button>
        <button {...favoritesProps} aria-pressed={isFavorites}>{s.reference_favorite_services}</button>
      </div>
      <div className="alipay-reference-service-grid">{collection.map(renderService)}</div>
      {!collection.length && <p>{s.reference_empty_collection}</p>}
    </div>
    <nav ref={categoryNav} className="alipay-reference-category-nav" aria-label={s.reference_available_services}>
      {categories.map(category => <button key={category.id} aria-current={visibleCategory === category.id ? 'location' : undefined} {...bindCategory(category.id, () => {
        requestedCategory.current = category.id;
        setVisibleCategory(category.id);
        sections.current[category.id]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      })}>{category.label}</button>)}
    </nav>
    {categories.map(category => <section key={category.id} ref={node=>{sections.current[category.id]=node;}} className="alipay-reference-service-card" data-service-category={category.id}>
      <h3>{category.label}</h3><div className="alipay-reference-service-grid">{category.items.map(renderService)}</div>
    </section>)}
    <p className="alipay-reference-service-note">{s.reference_service_scope}</p>
  </>;
}
