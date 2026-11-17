import {useMeituanInteractionOwner} from './hooks/useMeituanInteractionOwner';
import {readReviewMediaRequest,resolveReviewMedia,reviewMediaSourceKey} from './reviewMedia';
import {meituanReviewSource} from './reviewModel';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { ArrowLeft, ChevronRight, Clock3, MapPin, Minus, Plus, Search, ShoppingBag, ShoppingCart, Star, Store, UserRound } from 'lucide-react';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { useAppStrings } from '../../os/useAppStrings';
import bowlPhoto from './res/chicken-bowl.png';
import { strings as s } from './res/strings';
import { stringsEn } from './res/strings.en';
import { useMeituanStore } from './state';
import { resolveMeituanShops } from './data';
import { summarizeMeituanCart } from './cartSummary';
import { readShopRouteId, readShopRouteSection } from './routeIdentity';
import { readMeituanOrigin } from './searchOrigin';
import { useMeituanGestures } from './hooks/useMeituanGestures';
import { useMeituanNavigation } from './navigation';
import './meituan.css';
import './meituan-pages.css';
import './meituan-shop.css';
import './meituan-usability.css';
import './meituan-main.css';
import { MeituanHome } from './pages/MeituanHome';
import { MeituanShopWorkspace } from './pages/MeituanShopWorkspace';
import './meituan-workspace.css';
import './meituan-merchant-reference.css';
import { MeituanMerchantHeader } from './components/MeituanMerchantHeader';
import { MeituanMerchantMenu } from './components/MeituanMerchantMenu';
import { mainServiceLabel } from './mainServices';
import { MeituanMerchantReviews } from './components/MeituanMerchantReviews';
import './meituan-reviews.css';

function decodeServiceId(pathname: string) {
  try { return decodeURIComponent(pathname.slice('/service/'.length)); } catch { return ''; }
}

function AppContent() {
  const location = useLocation();
  const owns = useMeituanInteractionOwner();
  const t = useAppStrings(s, stringsEn);
  const { bindTap, bindBack } = useMeituanGestures();
  const originContext = location.pathname.startsWith('/shop/') ? readMeituanOrigin(location.search) : null;
  const searchOrigin = originContext?.path ?? null;
  const homeParams = new URLSearchParams(searchOrigin ? searchOrigin.slice(2) : location.search);
  const routeQuery = homeParams.get('q') || '';
  const deliveryChannel = homeParams.get('channel') === 'waimai';
  const searchOpen = homeParams.get('search') === 'open' || (Boolean(routeQuery) && !deliveryChannel);
  const searchContext = searchOrigin !== null;
  const [query, setQuery] = useState(routeQuery);
  const homePositions = useRef(new Map<string, number>());
  const searchInputRef = useRef<HTMLInputElement>(null);
  const keepSearchPointerStable = (event: React.PointerEvent<HTMLElement>) => {
    // Do not blur the input between mouse-down and mouse-up: adjustResize
    // would move the result under the pointer before its click is dispatched.
    // The route change removes the input; the OS then dismisses its keyboard.
    if (event.pointerType === 'mouse' && event.button === 0
      && (event.target as HTMLElement).closest('button')
      && document.activeElement === searchInputRef.current) event.preventDefault();
  };
  const submittedQueryRef = useRef(routeQuery);
  useEffect(() => {
    if ((location.pathname === '/' || searchContext) && routeQuery !== submittedQueryRef.current) {
      submittedQueryRef.current = routeQuery;
      setQuery(routeQuery);
    }
  }, [location.pathname, routeQuery, searchContext]);
  const categoryParam = homeParams.get('category');
  const category = categoryParam === 'food' || categoryParam === 'drinks' || categoryParam === 'market' ? categoryParam : 'all';
  const shopOverlays = useMeituanStore((state) => state.shops);
  const shops = useMemo(() => resolveMeituanShops(shopOverlays), [shopOverlays]);
  const retainedHomeFilter = useRef<{ query: string; category: typeof category }>({ query: '', category: 'all' });
  useEffect(() => {
    if (location.pathname === '/' && !searchOpen && !deliveryChannel) retainedHomeFilter.current = { query, category };
  }, [location.pathname, searchOpen, deliveryChannel, query, category]);
  const orderIds = useMeituanStore((state) => state.user.orderIds);
  const orders = useMeituanStore((state) => state.orders);
  const savedCart = useMeituanStore((state) => state.cart);
  const { go: rawGo, back, replaceSearch } = useMeituanNavigation(query, category, savedCart.shopId);
  useEffect(() => {
    if (location.pathname !== '/' || query === routeQuery) return;
    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(location.search);
      if (query) params.set('q', query);
      else params.delete('q');
      const search = params.toString();
      submittedQueryRef.current = query;
      replaceSearch(search ? `/?${search}` : '/');
    }, 250);
    return () => window.clearTimeout(timeout);
  }, [location.pathname, location.search, replaceSearch, query, routeQuery]);
  const createOrder = useMeituanStore((state) => state.createOrder);
  const selectShopStore = useMeituanStore((state) => state.selectShop);
  const changeCartItem = useMeituanStore((state) => state.changeCartItem);
  const clearCartStore = useMeituanStore((state) => state.clearCart);
  const orderHistory = orderIds.map((id) => orders[id]).filter(Boolean);
  const isShopPage = location.pathname.startsWith('/shop/');
  const selectedShopId = isShopPage ? readShopRouteId(location.pathname) ?? '' : savedCart.shopId;
  const shop = shops.find((item) => item.id === selectedShopId);
  const requiresCartSwitch = Boolean(shop && savedCart.shopId !== shop.id && Object.keys(savedCart.quantities).length > 0);
  const previousShop = shops.find((item) => item.id === savedCart.shopId);
  const cart = savedCart.shopId === selectedShopId ? savedCart.quantities : {};
  const shopSection = readShopRouteSection(location.pathname) ?? 'menu';
  const reviewMediaRequest = readReviewMediaRequest(location.search);
  const mediaOpen = Boolean(shop) && shopSection === 'reviews' && reviewMediaRequest.kind !== 'closed';
  const sourceVersion = reviewMediaSourceKey(shop);
  const go = (...args: Parameters<typeof rawGo>) => {
    if (!owns()) return;
    const [id, reviewId, index] = args;
    const mediaCommand = id.startsWith('meituan.reviews.media.');
    if (mediaOpen && (!mediaCommand || id === 'meituan.reviews.media.open')) return;
    if (mediaCommand && id !== 'meituan.reviews.media.close') {
      const liveShop = resolveMeituanShops(useMeituanStore.getState().shops).find(item => item.id === selectedShopId);
      if (!liveShop || sourceVersion !== reviewMediaSourceKey(liveShop)) return;
      const request = id === 'meituan.reviews.media.open'
        ? {kind:'open' as const,reviewId:reviewId ?? '',index:index ?? -1} : reviewMediaRequest;
      if (request.kind === 'open' && (!Number.isSafeInteger(request.index) || request.index < 0)) return;
      const view = resolveReviewMedia(request, meituanReviewSource(liveShop));
      if (view.kind !== 'open') return;
      if (id === 'meituan.reviews.media.previous' && view.index <= 0) return;
      if (id === 'meituan.reviews.media.next' && view.index >= view.images.length - 1) return;
    }
    rawGo(...args);
  };
  const selectShop = (id:string) => {if (owns() && !mediaOpen) selectShopStore(id);};
  const clearCart = () => {if (owns() && !mediaOpen) clearCartStore();};
  const filtered = useMemo(() => shops.filter((item) => (category === 'all' || item.categoryId === category) && (!query || `${item.name} ${item.dishes.map((dish) => dish.name).join(' ')}`.includes(query))), [shops, query, category]);
  const cartItems = shop?.dishes.filter((dish) => cart[dish.id]) ?? [];
  const cartSummary = summarizeMeituanCart({ shopId: selectedShopId, quantities: cart }, shops);
  const count = cartSummary.valid ? cartSummary.quantity : 0;
  const total = (cartSummary.subtotalCents ?? 0) / 100;
  const totalLabel = cartSummary.valid ? `¥${total.toFixed(2)}` : '—';
  const goHome = () => go('meituan.home.open');
  const change = (id: string, amount: number) => { if (shop && owns() && !mediaOpen) changeCartItem(shop.id, id, amount); };
  const openShop = (id: string) => go('meituan.shop.open', id);
  const checkout = () => {
    if (!shop || count === 0 || !owns() || mediaOpen) return;
    const orderId = createOrder(shop.id, shop.name, cartItems.map((dish) => ({
      dishId: dish.id, name: dish.name, quantity: cart[dish.id] || 0, unitPrice: dish.price,
    })));
    if (orderId) go('meituan.checkout.open');
  };
  useAppNavigationHandler('meituan_waimai', { onBack: back });

  const tabbar = (active: 'home' | 'orders' | 'me') => <nav className="mt-tabbar" data-hide-on-keyboard>
    <button className={active === 'home' ? 'active' : ''} data-trigger="meituan.home.open" data-trigger-type="tap" onClick={goHome}><Store size={21}/>{t.home}</button>
    <button className={active === 'orders' ? 'active' : ''} data-trigger="meituan.orders.open" data-trigger-type="tap" onClick={() => go('meituan.orders.open')}><ShoppingBag size={21}/>{t.orders}</button>
    <button className={active === 'me' ? 'active' : ''} data-trigger="meituan.profile.open" data-trigger-type="tap" onClick={() => go('meituan.profile.open')}><UserRound size={21}/>{t.mine}</button>
  </nav>;
  const header = (title: string) => <header className="mt-header">
    <button aria-label={t.back} {...bindBack()}><ArrowLeft size={22}/></button>
    <b>{title}</b><span>{t.simulation}</span>
  </header>;

  const homeSearch = <div className="mt-home-head"><div className="mt-location"><MapPin size={19}/><div><small>{t.location}</small><b>{t.address}</b></div><ChevronRight size={17}/></div><div className="mt-search"><Search size={20}/><input ref={searchInputRef} aria-label={t.search} data-action="meituan.search.input" data-action-type="input" placeholder={t.search} value={query} onChange={(event) => setQuery(event.target.value)}/></div></div>;
  const homeFilters = <div className="mt-cats"><button className={category === 'all' ? 'selected' : ''} data-trigger="meituan.home.category.all" data-trigger-type="tap" onClick={() => go('meituan.home.category.all')}><span>🍱</span>{t.home}</button><button className={category === 'food' ? 'selected' : ''} data-trigger="meituan.home.category.food" data-trigger-type="tap" onClick={() => go('meituan.home.category.food')}><span>🍜</span>{t.food}</button><button className={category === 'drinks' ? 'selected' : ''} data-trigger="meituan.home.category.drinks" data-trigger-type="tap" onClick={() => go('meituan.home.category.drinks')}><span>🧋</span>{t.drinks}</button><button className={category === 'market' ? 'selected' : ''} data-trigger="meituan.home.category.market" data-trigger-type="tap" onClick={() => go('meituan.home.category.market')}><span>🛒</span>{t.market}</button></div>;
  const renderShopResults = (items: typeof shops) => <div className="mt-shop-list">{items.map((item) => <button className="mt-shop-card" key={item.id} {...(searchContext ? bindTap('meituan.context.shop.open', { params: { id: item.id }, onTrigger: () => go('meituan.context.shop.open', item.id) }) : bindTap('meituan.shop.open', { params: { id: item.id }, onTrigger: () => openShop(item.id) }))}><div className="mt-shop-art">{item.id === 'rice' ? <img src={bowlPhoto} alt=""/> : <span>{item.id === 'salad' ? '🥗' : item.id === 'market' ? '🛒' : '🧋'}</span>}</div><div className="mt-shop-info"><strong>{item.name}</strong><div className="mt-shop-rating"><Star size={13} fill="currentColor"/> {item.rating} <span>{item.sales}</span></div><small><Clock3 size={13}/> {item.time} · {t.freeDelivery}</small><i>{item.category}</i></div><ChevronRight size={18}/></button>)}{items.length === 0 && <p className="mt-empty">{t.noResults}</p>}</div>;
  const homeResults = renderShopResults(filtered);
  const retained = retainedHomeFilter.current;
  const retainedResults = renderShopResults(shops.filter(item => (retained.category === 'all' || item.categoryId === retained.category) && (!retained.query || `${item.name} ${item.dishes.map(dish => dish.name).join(' ')}`.includes(retained.query))));

  const renderHome = (showSearch: boolean) => <MeituanHome searchOpen={showSearch} searchHeader={homeSearch} results={homeResults} homeResults={showSearch ? retainedResults : homeResults} filters={homeFilters} onResultsPointerDown={keepSearchPointerStable}
        onSearch={() => go('meituan.search.open')} onDelivery={() => go('meituan.waimai.open')}
        onService={id => go('meituan.service.open', id)} onCart={() => go('meituan.cart.open')}
        onProfile={() => go('meituan.profile.open')} onOrders={() => go('meituan.orders.open')} address={t.address} onHome={goHome} positions={homePositions.current}
        positionKey={originContext?.kind === 'home' ? originContext.path : (!searchOpen && location.pathname === '/' ? location.pathname + location.search : '/')}/>;
  return <div className="mt-root pt-10" data-status-bar-foreground="dark" data-reference-pattern="Meituan-main-offline-prototype">
    <MeituanShopWorkspace enabled={searchContext} homePanel={originContext?.kind === 'home' ? renderHome(false) : undefined} shops={filtered} query={query} selectedId={selectedShopId}
      onShop={id => go('meituan.context.shop.open', id)}>
    <div className="mt-shell">
      {location.pathname === '/' && (deliveryChannel ? <>
        {header(t.main_delivery_title)}
        {homeSearch}
        <main className="mt-main" data-scroll-container="shops" data-scroll-direction="vertical" data-keep-keyboard="true" onPointerDown={keepSearchPointerStable}>
          <div className="mt-hero"><div><small>{t.promo}</small><h1>{t.promoTitleLineOne}<br/>{t.promoTitleLineTwo}</h1><p>{t.promoDetail}</p></div><span>🥡</span></div>{homeFilters}<h2>{t.nearby}</h2>{homeResults}
        </main>{tabbar('home')}
      </> : renderHome(searchOpen)) }
      {location.pathname.startsWith('/service/') && <>
        {header(t[mainServiceLabel(decodeServiceId(location.pathname))])}
        <main className="mt-main mt-main-service-scope" data-scroll-container="service" data-scroll-direction="vertical">
          <h1>{t[mainServiceLabel(decodeServiceId(location.pathname))]}</h1><p role="status">{t.main_service_scope}</p>
          <button {...bindTap('meituan.home.open', { onTrigger: goHome })}>{t.main_home_return}</button>
        </main>
      </>}
      {(isShopPage || location.pathname === '/cart') && !shop && <>
        {header(t.shopUnavailable)}
        <main className="mt-main mt-unavailable mt-empty-cart">
          <Store size={48}/><p>{t.shopUnavailableHint}</p>
          <button data-trigger="meituan.home.open" data-trigger-type="tap" onClick={goHome}>{t.keepShopping}</button>
        </main>
      </>}
      {isShopPage && shop && <>
        {header(shop.name)}
        <main className="mt-main mt-merchant-main" data-scroll-container="menu" data-scroll-direction="vertical">
          <MeituanMerchantHeader shop={shop}/>
          <div className="mt-menu-tabs" role="tablist" aria-label={t.shop}>
            <button className={shopSection === 'menu' ? 'active' : ''} role="tab" aria-selected={shopSection === 'menu'} data-trigger="meituan.shop.menu" data-trigger-type="tap" data-trigger-params={JSON.stringify({ id: shop.id })} onClick={() => go('meituan.shop.menu', shop.id)}>{t.menu}</button>
            <button className={shopSection === 'reviews' ? 'active' : ''} role="tab" aria-selected={shopSection === 'reviews'} data-trigger="meituan.shop.reviews" data-trigger-type="tap" data-trigger-params={JSON.stringify({ id: shop.id })} onClick={() => go('meituan.shop.reviews', shop.id)}>{t.reviews}</button>
            <button className={shopSection === 'info' ? 'active' : ''} role="tab" aria-selected={shopSection === 'info'} data-trigger="meituan.shop.info" data-trigger-type="tap" data-trigger-params={JSON.stringify({ id: shop.id })} onClick={() => go('meituan.shop.info', shop.id)}>{t.merchant}</button>
          </div>
          {shopSection === 'menu' && <>
            {requiresCartSwitch && <section className="mt-switch-cart" role="status">
              <b>{t.otherShopCart}: {previousShop?.name ?? t.shopUnavailable}</b>
              <p>{t.switchCartHint}</p>
              <div>
                <button data-trigger="meituan.cart.open" data-trigger-type="tap" onClick={() => go('meituan.cart.open')}>{t.viewOriginalCart}</button>
                <button {...bindTap({ kind: 'action', id: 'meituan.cart.switch.submit' }, {
                  params: { shopId: shop.id }, onTrigger: () => selectShop(shop.id),
                })}>{t.clearAndSwitch}</button>
              </div>
            </section>}
            <MeituanMerchantMenu shop={shop} search={location.search} quantities={cart} blocked={requiresCartSwitch}
              onCategory={id => go('meituan.menu.category.open', id)} onReset={() => go('meituan.menu.category.reset')} onChange={change}/>
          </>}
          {shopSection === 'reviews' && <MeituanMerchantReviews shop={shop} search={location.search} mediaRequest={reviewMediaRequest}
            onMediaOpen={(reviewId, index) => go('meituan.reviews.media.open', reviewId, index)}
            onMediaClose={() => go('meituan.reviews.media.close')}
            onMediaStep={direction => go(direction === 'previous' ? 'meituan.reviews.media.previous' : 'meituan.reviews.media.next')}
            onFilter={filter => {
            if (filter === 'all') go('meituan.reviews.filter.all');
            if (filter === 'latest') go('meituan.reviews.filter.latest');
            if (filter === 'positive') go('meituan.reviews.filter.positive');
            if (filter === 'negative') go('meituan.reviews.filter.negative');
            if (filter === 'media') go('meituan.reviews.filter.media');
          }}/>}
          {shopSection === 'info' && <section className="mt-shop-panel"><h2>{t.merchantTitle}</h2><p>{t.merchantDisclaimer}</p><div className="mt-merchant-row"><MapPin size={18}/><span>{t.merchantAddress}</span></div><div className="mt-merchant-row"><Clock3 size={18}/><span>{shop.time}</span></div></section>}
        </main>
        <div className="mt-cartbar"><div className="mt-cart-icon"><ShoppingCart size={23}/>{count > 0 && <em>{count}</em>}</div><div><b>{totalLabel}</b><small>{t.itemSubtotal} · {count} {count === 1 ? t.item : t.items}</small></div><button data-trigger="meituan.cart.open" data-trigger-type="tap" onClick={() => go('meituan.cart.open')}>{t.cart}</button></div>
      </>}
      {location.pathname === '/cart' && shop && <>
        {header(t.cart)}
        <main className="mt-main mt-cart-main" data-scroll-container="cart" data-scroll-direction="vertical">
          <div className="mt-cart-title"><b>{shop.name}</b><button data-action="meituan.cart.clear" data-action-type="tap" onClick={clearCart}>{t.clear}</button></div>
          {!cartSummary.valid ? <div className="mt-empty-cart mt-invalid-cart"><ShoppingCart size={48}/><p>{t.cartUnavailableHint}</p></div> : count === 0 ? <div className="mt-empty-cart"><ShoppingCart size={48}/><p>{t.emptyCart}</p><button onClick={() => go('meituan.shop.open', shop.id)}>{t.keepShopping}</button></div> : cartItems.map((dish) => <div className="mt-cart-row" key={dish.id}><span>{dish.emoji}</span><div><b>{dish.name}</b><small>{t.unitPrice} ¥{dish.price.toFixed(2)} · {t.itemSubtotal} ¥{(Math.round(dish.price * 100) * cart[dish.id] / 100).toFixed(2)}</small></div><div className="mt-quantity"><button aria-label={`${t.remove} ${dish.name}`} data-action="meituan.cart.item.remove" data-action-type="tap" data-action-params={JSON.stringify({ itemId: dish.id })} onClick={() => change(dish.id, -1)}><Minus size={16}/></button><b aria-live="polite">{cart[dish.id]}</b><button aria-label={`${t.add} ${dish.name}`} data-action="meituan.cart.item.add" data-action-type="tap" data-action-params={JSON.stringify({ itemId: dish.id })} onClick={() => change(dish.id, 1)}><Plus size={16}/></button></div></div>)}
        </main>
        <div className="mt-checkout"><div><small>{t.itemSubtotal}</small><b>{totalLabel}</b></div><button disabled={!count} data-trigger="meituan.checkout.open" data-trigger-type="tap" onClick={checkout}>{t.checkout}</button></div>
      </>}
      {location.pathname === '/orders' && <>
        {header(t.orderHistory)}
        <main className="mt-main mt-orders-main" data-scroll-container="orders" data-scroll-direction="vertical">
          {orderHistory.length === 0 ? <div className="mt-empty-cart"><ShoppingBag size={48}/><h2>{t.emptyOrders}</h2><p>{t.orderHistoryHint}</p><button onClick={goHome}>{t.keepShopping}</button></div> : orderHistory.map((order) => <article className="mt-order-card" key={order.id}><div><b>{order.shopName}</b><small>#{order.id.replace('demo_order_', '')} · {t.simulation}</small></div><div><span>{order.items.reduce((sum, item) => sum + item.quantity, 0)} {order.items.reduce((sum, item) => sum + item.quantity, 0) === 1 ? t.orderItem : t.orderItems}</span><strong>¥{order.total.toFixed(2)}</strong></div><p>{t.orderNote}</p></article>)}
        </main>
        {tabbar('orders')}
      </>}
      {location.pathname === '/me' && <>
        {header(t.profileTitle)}
        <main className="mt-main mt-profile-main">
          <section className="mt-profile-card"><div className="mt-profile-avatar"><UserRound size={32}/></div><div><h1>{t.demoAccount}</h1><p>{t.demoAccountHint}</p></div></section>
          <section className="mt-profile-stats"><b>{orderHistory.length}</b><span>{t.ordersCreated}</span></section>
          <p className="mt-profile-notice">{t.offlineNotice}</p>
        </main>
        {tabbar('me')}
      </>}
      {location.pathname === '/order' && <>{header(t.orders)}<main className="mt-order"><div className="mt-order-mark">✓</div><h1>{t.orderReady}</h1><p>{t.orderNote}</p><small>#{orderIds[0]?.replace('demo_order_', '') ?? '---'}</small><button data-trigger="meituan.home.open" data-trigger-type="tap" onClick={goHome}>{t.keepShopping}</button></main></>}
    </div>
    </MeituanShopWorkspace>
  </div>;
}

const MeituanWaimaiApp: React.FC = () => <MemoryRouter><AppContent/></MemoryRouter>;
export default MeituanWaimaiApp;
