import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { useAppStrings } from '../../../os/useAppStrings';
import { strings } from '../res/strings';
import { stringsEn } from '../res/strings.en';
import { IcAdd, IcRemove } from '../res/icons';
import { useMeituanGestures } from '../hooks/useMeituanGestures';
import { meituanLocalImage, meituanMenuGroups } from '../menuModel';
import type { Shop } from '../types';
import bowlPhoto from '../res/chicken-bowl.png';
import { MeituanPhoto } from './MeituanPhoto';

export function MeituanMerchantMenu({ shop, search, quantities, blocked, onCategory, onReset, onChange }: {
  shop: Shop; search: string; quantities: Record<string, number>; blocked: boolean;
  onCategory: (id: string) => void; onReset: () => void; onChange: (id: string, amount: number) => void;
}) {
  const t = useAppStrings(strings, stringsEn), { bindTap } = useMeituanGestures();
  const groups = useMemo(() => meituanMenuGroups(shop), [shop]);
  const params = new URLSearchParams(search), category = params.get('menuCategory');
  const active = params.getAll('menuCategory').length > 1 ? undefined
    : category === null ? groups?.[0] : groups?.find(g => g.id === category);
  const rootRef = useRef<HTMLDivElement>(null), sections = useRef(new Map<string, HTMLElement>());
  const publishedFromScroll = useRef<string | null>(null), categoryCallback = useRef(onCategory);
  const renderedShop = useRef<string | null>(null);
  useLayoutEffect(() => { categoryCallback.current = onCategory; });
  const alignGroup = useCallback((id: string) => {
    const root = rootRef.current?.closest<HTMLElement>('[data-scroll-container="menu"]');
    const section = sections.current.get(id);
    if (!root || !section || !root.checkVisibility()) return;
    const rect = root.getBoundingClientRect(), scale = root.clientHeight / rect.height;
    const tabs = root.querySelector<HTMLElement>('.mt-menu-tabs');
    root.scrollTop += (section.getBoundingClientRect().top - rect.top) * scale - (tabs?.offsetHeight ?? 0) - 8;
  }, []);
  useLayoutEffect(() => {
    const root = rootRef.current?.closest<HTMLElement>('[data-scroll-container="menu"]');
    if (!root || !groups || !active) return;
    if (renderedShop.current !== shop.id) {
      renderedShop.current = shop.id;
      publishedFromScroll.current = null;
      if (category === null) root.scrollTop = 0;
    }
    if (publishedFromScroll.current === active.id) publishedFromScroll.current = null;
    else if (category !== null) alignGroup(active.id);
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!root.isConnected || !root.checkVisibility() || root.clientHeight <= 0) return;
        const top = root.getBoundingClientRect().top;
        const tabs = root.querySelector<HTMLElement>('.mt-menu-tabs');
        const scale = root.getBoundingClientRect().height / root.clientHeight;
        const cutoff = top + ((tabs?.offsetHeight ?? 0) + 16) * scale;
        let next = groups[0]?.id;
        for (const group of groups) if ((sections.current.get(group.id)?.getBoundingClientRect().top ?? Infinity) <= cutoff) next = group.id;
        if (next && next !== active.id) {
          publishedFromScroll.current = next;
          categoryCallback.current(next);
        }
      });
    };
    root.addEventListener('scroll', onScroll, { passive: true });
    return () => { root.removeEventListener('scroll', onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [shop.id, groups, active, category, alignGroup]);
  if (!groups || !active) return <section className="mt-menu-unavailable" data-meituan-menu-unavailable role="status">
    <h2>{t.menuUnavailable}</h2><p>{t.menuUnavailableHint}</p>
    {groups && <button {...bindTap('meituan.menu.category.reset', { params: { id: shop.id }, onTrigger: onReset })}>{t.menuReset}</button>}
  </section>;
  const label = (g: typeof active) => g.name ?? (g.unclassified ? t.menuOther : t.menuAll);
  return <div ref={rootRef} className="mt-menu-layout">
    <nav className="mt-menu-categories" data-meituan-menu-categories aria-label={t.menuCategories}
      data-scroll-container="categories" data-scroll-direction="vertical">
      {groups.map(group => <button key={group.id} aria-current={active.id === group.id ? 'true' : undefined}
        {...bindTap('meituan.menu.category.open', { params: { id: shop.id, menuCategory: group.id }, onTrigger: () => {
          publishedFromScroll.current = null;
          if (active.id === group.id) alignGroup(group.id);
          onCategory(group.id);
        } })}>{label(group)}</button>)}
    </nav>
    <div className="mt-menu-groups">{groups.map(group => <section className="mt-menu-group" key={group.id}
      data-meituan-menu-group={group.id} ref={node => { if (node) sections.current.set(group.id, node); else sections.current.delete(group.id); }}>
      <h2>{label(group)}</h2>{group.dishes.length === 0 && <p className="mt-empty">{t.menuEmpty}</p>}
      {group.dishes.map(dish => {
        const image = dish.image ? meituanLocalImage(dish.image, window.location.origin)
          : shop.id === 'rice' && dish.id === 'chicken' ? bowlPhoto : undefined;
        const quantity = quantities[dish.id] || 0;
        return <div className="mt-dish" key={dish.id} data-benchmark-shop-id={shop.id} data-benchmark-dish-id={dish.id}>
          <div className="mt-dish-art"><MeituanPhoto key={image ?? 'missing'} src={image} label={image ? dish.name : t.imageUnavailable} fallback={<span>{dish.emoji}</span>}/></div>
          <div className="mt-dish-info"><strong data-benchmark-menu-name>{dish.name}</strong><small>{dish.note}</small>
            <div className="mt-dish-line"><b data-benchmark-menu-price>¥{dish.price.toFixed(2)}</b><div className="mt-dish-controls">
              {quantity > 0 && <><button disabled={blocked} aria-label={t.remove + ' ' + dish.name}
                {...bindTap({ kind: 'action', id: 'meituan.menu.item.remove.submit' }, { params: { itemId: dish.id }, onTrigger: () => onChange(dish.id, -1) })}><IcRemove size={16}/></button>
                <span className="mt-cart-quantity" aria-live="polite">{quantity}</span></>}
              <button disabled={blocked} aria-label={t.add + ' ' + dish.name}
                {...bindTap({ kind: 'action', id: 'meituan.cart.item.add' }, { params: { itemId: dish.id }, onTrigger: () => onChange(dish.id, 1) })}><IcAdd size={18}/></button>
            </div></div>
          </div>
        </div>;
      })}
    </section>)}</div>
  </div>;
}
