import React, { useContext, useEffect, useRef, useState } from 'react';
import { UNSAFE_NavigationContext, useLocation } from 'react-router-dom';
import { useActivityId } from '@/os/ActivityContext';
import { cdn } from '@/os/utils/cdn';
import { useTaobaoStore } from '../state';
import { useTaobaoStrings } from '../hooks/useTaobaoStrings';
import { useTaobaoGestures } from '../hooks/useTaobaoGestures';
import { useTaobaoCartOwner } from '../hooks/useTaobaoCartOwner';
import { useCloseTaobaoCartSku } from '../navigation';
import { captureTaobaoCartSku, hasTaobaoCartSkuParent, initialTaobaoCartVariant, nextTaobaoCartSku, taobaoCartSkuSourceIsCurrent } from '../cartSkuModel';
import { resolveTaobaoCartUnitPrice } from '../cartModel';
import { formatTaobaoVariant, taobaoProductVariants } from '../skuModel';
import { TaobaoProductImage } from './TaobaoProductImage';

/** Edit one original cart row, never add a second row or invoke checkout. */
export function TaobaoCartSkuSheet({ productId, manage, returnFocus }: {
  productId: string; manage: boolean; returnFocus: HTMLElement | null;
}) {
  const s = useTaobaoStrings(), products = useTaobaoStore(state => state.products), cart = useTaobaoStore(state => state.cartItems);
  const source = useRef(captureTaobaoCartSku(products, cart, productId)).current;
  const focusSource = useRef(source), submitted = useRef(false), panel = useRef<HTMLElement>(null);
  const [variantId, setVariantId] = useState(() => source ? initialTaobaoCartVariant(source) : undefined);
  const [quantity, setQuantity] = useState(source?.row.quantity ?? 1);
  const draft = useRef({ variantId, quantity }), submitParams = useRef({ productId, quantity });
  const activityId = useActivityId(), location = useLocation(), { navigator } = useContext(UNSAFE_NavigationContext);
  const ownsSheet = useTaobaoCartOwner('sku'), close = useCloseTaobaoCartSku(), { bindTap, bindBack } = useTaobaoGestures();
  const current = !!source && taobaoCartSkuSourceIsCurrent(products, cart, source);
  const variants = source ? taobaoProductVariants(source.product) : [];
  const selected = variants.find(variant => variant.id === variantId);
  const next = source ? nextTaobaoCartSku(source, variantId, quantity) : null;
  const price = selected?.price ?? (source ? resolveTaobaoCartUnitPrice(source.product, source.row) : null);
  const summary = variants.length ? selected ? formatTaobaoVariant(selected) : s.cart_sku_choose : source?.row.sku || s.cart_sku_unknown;
  const canEdit = () => {
    const state = useTaobaoStore.getState();
    return ownsSheet() && !submitted.current && !!source && taobaoCartSkuSourceIsCurrent(state.products, state.cartItems, source);
  };
  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
    return () => { queueMicrotask(() => {
      const os = window.__OS__?.getState(), top = os?.tasks.find(task => task.taskId === os.activeTaskId)?.stack.at(-1);
      const entry = (navigator as { location?: typeof location }).location, state = useTaobaoStore.getState(), owned = focusSource.current;
      if (entry?.pathname === '/cart' && hasTaobaoCartSkuParent(location.search, entry)
        && top?.activityId === activityId && !os?.isLauncherVisible && !os?.isRecentsVisible
        && owned && taobaoCartSkuSourceIsCurrent(state.products, state.cartItems, owned)
        && returnFocus?.isConnected && !returnFocus.closest('[inert]')
        && returnFocus.dataset.cartSkuProductId === owned.product.id) returnFocus.focus({ preventScroll: true });
    }); };
  }, [activityId, location.search, navigator, returnFocus]);
  const choose = (id: string) => {
    if (canEdit() && variants.filter(variant => variant.id === id).length === 1) { draft.current.variantId = id; setVariantId(id); }
  };
  const step = (delta: number) => {
    const nextQuantity = draft.current.quantity + delta;
    if (canEdit() && Number.isSafeInteger(nextQuantity) && nextQuantity >= 1) {
      draft.current.quantity = nextQuantity; submitParams.current.quantity = nextQuantity; setQuantity(nextQuantity);
    }
  };
  const save = () => {
    if (!canEdit() || !source) return;
    submitted.current = true;
    const accepted = useTaobaoStore.getState().updateCartSku(source, draft.current);
    if (!accepted) { submitted.current = false; return; }
    const state = useTaobaoStore.getState(); focusSource.current = captureTaobaoCartSku(state.products, state.cartItems, source.product.id);
    close();
  };
  const backBinding = bindBack<HTMLButtonElement>();
  const closeButton = { ...backBinding, onClick: (event: React.MouseEvent<HTMLButtonElement>) => { if (ownsSheet()) backBinding.onClick?.(event); } };
  return <div className="tb-sku-layer" data-cart-sku-layer>
    <button className="tb-sku-backdrop" aria-label={s.detail_close_sku} {...closeButton} />
    <section ref={panel} className="tb-sku-sheet tb-cart-sku-sheet" role="dialog" aria-modal="true" aria-label={s.cart_edit_sku}
      data-cart-sku-product-id={productId} data-benchmark-sku-variant-id={selected?.id ?? ''}
      onKeyDown={event => {
        if (!ownsSheet()) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); if (ownsSheet()) close(); }
        if (event.key === 'Tab') {
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
          const index = buttons.indexOf(document.activeElement as HTMLButtonElement); event.preventDefault();
          buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length]?.focus();
        }
      }}>
      <span className="tb-sku-handle" aria-hidden="true" />
      <header>{source ? <><TaobaoProductImage className="tb-sku-picture" priority="high" src={`${cdn('taobao/images')}/${source.product.image}`} alt={source.product.title} />
        <div><div className="tb-sku-price"><i>¥</i><strong>{price}</strong></div><p>{summary}</p><small>{s.detail_stock_unavailable}</small></div></>
        : <div className="tb-cart-sku-missing-title">{s.cart_edit_sku}</div>}
        <button className="tb-sku-close" aria-label={s.detail_close_sku} {...closeButton}>×</button>
      </header>
      <div className="tb-sku-content" data-scroll-container="sku" data-scroll-direction="vertical">
        <p role="status" className="tb-cart-sku-status">{!source ? s.cart_sku_unavailable : !current ? s.cart_sku_changed : ''}</p>
        {source && <><section><h3>{s.detail_product_spec}</h3><div className="tb-sku-options">{variants.length ? variants.map(variant => <button key={variant.id}
          disabled={!current} className={variantId === variant.id ? 'selected' : ''} aria-pressed={variantId === variant.id}
          {...(manage ? bindTap({ kind: 'action', id: 'taobao.cart.manage.sku.select' }, { params: { productId, variantId: variant.id }, onTrigger: () => choose(variant.id) })
            : bindTap({ kind: 'action', id: 'taobao.cart.sku.select' }, { params: { productId, variantId: variant.id }, onTrigger: () => choose(variant.id) }))}>
          <b>{variant.size}</b><span>{variant.resolution} · {variant.weight}</span></button>) : <button disabled className="selected" aria-pressed="true">{summary}</button>}</div>
          {!variants.length && <p>{s.cart_sku_current_only}</p>}</section>
          <section className="tb-sku-quantity"><h3>{s.detail_quantity}</h3><div>
            <button disabled={!current || !Number.isSafeInteger(quantity) || quantity <= 1}
              {...(manage ? bindTap({ kind: 'action', id: 'taobao.cart.manage.sku.decrement' }, { params: { productId }, onTrigger: () => step(-1) })
                : bindTap({ kind: 'action', id: 'taobao.cart.sku.decrement' }, { params: { productId }, onTrigger: () => step(-1) }))}>−</button>
            <span data-cart-sku-quantity>{Number.isSafeInteger(quantity) ? quantity : '—'}</span>
            <button disabled={!current || !Number.isSafeInteger(quantity) || quantity >= Number.MAX_SAFE_INTEGER}
              {...(manage ? bindTap({ kind: 'action', id: 'taobao.cart.manage.sku.increment' }, { params: { productId }, onTrigger: () => step(1) })
                : bindTap({ kind: 'action', id: 'taobao.cart.sku.increment' }, { params: { productId }, onTrigger: () => step(1) }))}>＋</button>
          </div></section></>}
      </div>
      <footer><button disabled={!current || !next} data-cart-sku-submit
        {...(manage ? bindTap({ kind: 'action', id: 'taobao.cart.manage.sku.submit' }, { params: submitParams.current, onTrigger: save })
          : bindTap({ kind: 'action', id: 'taobao.cart.sku.submit' }, { params: submitParams.current, onTrigger: save }))}>{s.cart_sku_save}</button></footer>
    </section>
  </div>;
}
