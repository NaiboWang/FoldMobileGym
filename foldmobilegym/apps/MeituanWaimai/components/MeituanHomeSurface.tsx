import React, { useLayoutEffect, useRef } from 'react';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { MAIN_SERVICES } from '../mainServices';
import { ICON_REGISTRY, IcHome, IcVideo, IcAssistant, IcCart, IcUser, IcMessage, IcScan } from '../res/icons';
import { useMeituanGestures } from '../hooks/useMeituanGestures';

export type HomeSurfaceProps = {
  searchOpen: boolean; results: React.ReactNode; filters: React.ReactNode; onHomePointerDown?: React.PointerEventHandler<HTMLElement>;
  onSearch: () => void; onDelivery: () => void; onService: (id: string) => void; onHome: () => void;
  onCart: () => void; onProfile: () => void; onOrders: () => void; address: string;
  positions: Map<string, number>; positionKey: string;
};

/** Shared interactive master surface; UI-only positions belong to one Activity. */
export function MeituanHomeSurface({ searchOpen, results, filters, onSearch, onDelivery, onService,
  onHome, onCart, onProfile, onOrders, address, positions, positionKey, onHomePointerDown }: HomeSurfaceProps) {
  const t = useAppStrings(strings, stringsEn);
  const { bindTap } = useMeituanGestures();
  const scrollRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const restore = () => {
      if (element.clientHeight > 0 && element.checkVisibility()) element.scrollTop = positions.get(positionKey) ?? 0;
    };
    restore();
    const observer = new ResizeObserver(restore);
    observer.observe(element);
    return () => observer.disconnect();
  }, [positions, positionKey]);
  const rememberScroll = (event: React.UIEvent<HTMLElement>) => {
    const element = event.currentTarget;
    if (element.clientHeight > 0 && element.checkVisibility()) positions.set(positionKey, element.scrollTop);
  };
  return <section className="mt-super-home-pane">
      <header className="mt-super-header">
        <div className="mt-super-address"><b>{t.appName}</b><span>{address}</span>
          <button aria-label={t.main_messages} {...bindTap('meituan.service.open', { params: { id: 'messages' }, onTrigger: () => onService('messages') })}><IcMessage size={21}/></button>
          <button aria-label={t.main_scan} {...bindTap('meituan.service.open', { params: { id: 'scan' }, onTrigger: () => onService('scan') })}><IcScan size={21}/></button>
        </div>
        <button className="mt-super-search-launch" {...bindTap('meituan.search.open', { onTrigger: onSearch })}><span>{t.main_home_search}</span><b>{t.main_search_action}</b></button>
      </header>
      <main ref={scrollRef} onScroll={rememberScroll} onPointerDown={onHomePointerDown} className="mt-super-home-scroll" data-scroll-container="home" data-scroll-direction="vertical">
        <section data-keep-keyboard={searchOpen ? "true" : undefined} className="mt-super-services" aria-label={t.main_services}>
          {MAIN_SERVICES.map(service => {
            const Icon = ICON_REGISTRY[service.icon];
            return service.id === 'delivery'
              ? <button key={service.id} data-meituan-service={service.id} {...bindTap('meituan.waimai.open', { onTrigger: onDelivery })}><span className={'mt-service-icon ' + service.tone}><Icon size={28}/></span><span>{t[service.label]}</span></button>
              : <button key={service.id} data-meituan-service={service.id} {...bindTap('meituan.service.open', { params: { id: service.id }, onTrigger: () => onService(service.id) })}><span className={'mt-service-icon ' + service.tone}><Icon size={28}/></span><span>{t[service.label]}</span></button>;
          })}
        </section>
        <section data-keep-keyboard={searchOpen ? "true" : undefined} className="mt-super-promos" aria-label={t.main_recommendations}>
          <button className="mt-super-promo mt-super-promo-food" {...bindTap('meituan.waimai.open', { onTrigger: onDelivery })}><small>{t.main_promo_body}</small><strong>{t.main_promo_food}</strong><span>{t.main_promo_title}</span><IcDeliveryArt/></button>
          <button className="mt-super-promo mt-super-promo-market" {...bindTap('meituan.service.open', { params: { id: 'flash' }, onTrigger: () => onService('flash') })}><small>{t.simulation}</small><strong>{t.main_promo_market}</strong><IcCart size={42}/></button>
          <button className="mt-super-order-shortcut" {...bindTap('meituan.orders.open', { onTrigger: onOrders })}>{t.main_promo_orders}</button>
        </section>
        <section data-keep-keyboard={searchOpen ? "true" : undefined} className="mt-super-recommendations"><h2>{t.main_recommendations}</h2>{filters}{results}</section>
      </main>
      <nav className="mt-super-tabbar" data-hide-on-keyboard>
        <button className="active" aria-current="page" {...bindTap('meituan.home.open', { onTrigger: onHome })}><IcHome size={23}/><span>{t.home}</span></button>
        <button {...bindTap('meituan.service.open', { params: { id: 'video' }, onTrigger: () => onService('video') })}><IcVideo size={23}/><span>{t.main_video}</span></button>
        <button {...bindTap('meituan.service.open', { params: { id: 'assistant' }, onTrigger: () => onService('assistant') })}><IcAssistant size={25}/><span>{t.main_assistant}</span></button>
        <button {...bindTap('meituan.cart.open', { onTrigger: onCart })}><IcCart size={23}/><span>{t.cart}</span></button>
        <button {...bindTap('meituan.profile.open', { onTrigger: onProfile })}><IcUser size={23}/><span>{t.mine}</span></button>
      </nav>
    </section>;
}

function IcDeliveryArt() { return <span className="mt-super-promo-art" aria-hidden="true">🍱</span>; }
