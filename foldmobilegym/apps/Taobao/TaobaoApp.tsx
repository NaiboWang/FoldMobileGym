import React, { useCallback, useMemo } from 'react';
import { MemoryRouter, Navigate, Route, Routes, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { cdn } from '../../os/utils/cdn';
import { normalizeTaobaoCart, resolveTaobaoCartUnitPrice } from './cartModel';
import { TaobaoProductImage } from './components/TaobaoProductImage';
import { leadingTaobaoImagePriority } from './mediaPolicy';
import { TaobaoOrdersPage } from './pages/TaobaoOrdersPage';
import { TaobaoMessagesPage } from './pages/TaobaoMessagesPage';
import { filterAndSortTaobaoProducts, normalizeTaobaoSearchSort } from './searchModel';
import { resolveTaobaoSkuSelection, taobaoProductVariants } from './skuModel';
import { useAppNavigationHandler } from '../../os/hooks/useAppNavigationHandler';
import { useTaobaoGestures } from './hooks/useTaobaoGestures';
import { useTaobaoStrings } from './hooks/useTaobaoStrings';
import { useAppNavigate, useCloseTaobaoCartSku } from './navigation';
import { TaobaoCartSkuSheet } from './components/TaobaoCartSkuSheet';
import { useTaobaoCartOwner } from './hooks/useTaobaoCartOwner';
import { captureTaobaoCartSku, taobaoCartSkuSourceIsCurrent } from './cartSkuModel';
import { useTaobaoStore } from './state';
import { IcBack, IcBag, IcCart, IcCamera, IcChevron, IcHeart, IcLauncher, IcSearch, IcTaobaoTabCart, IcTaobaoTabHome, IcTaobaoTabMe, IcTaobaoTabMessage, IcTaobaoTabVideo } from './res/icons';
import './taobao.css';
import './taobao-search.css';
import './taobao-cart.css';
import './taobao-profile.css';
import './taobao-orders.css';
import './taobao-tabbar.css';
import './taobao-adaptive.css';
import './taobao-media.css';
import './taobao-detail.css';
import './taobao-cart-sku.css';
import './taobao-messages.css';

const PRODUCT_CDN = cdn('taobao/images');
type Product = ReturnType<typeof useTaobaoStore.getState>['products'][number];

const NavigationHandler = () => {
  const location = useLocation();
  const { back } = useAppNavigate();
  const closeCartSku = useCloseTaobaoCartSku();
  const onBack = useCallback(() => {
    if (location.pathname === '/cart' && new URLSearchParams(location.search).get('sheet') === 'sku'
      && !new URLSearchParams(location.search).has('dialog')) { closeCartSku(); return true; }
    if (location.pathname !== '/') { back(); return true; }
    return false;
  }, [back, closeCartSku, location.pathname, location.search]);
  useAppNavigationHandler('taobao', { onBack });
  return null;
};

const SearchPill = () => {
  const s = useTaobaoStrings();
  const { bindTap } = useTaobaoGestures();
  return <button className="tb-search-pill" {...bindTap<HTMLButtonElement>('taobao.home.search.open')}><IcLauncher size={28} className="tb-brand-icon"/><IcSearch size={17}/><span className="tb-search-placeholder">{s.search_placeholder}</span><span className="tb-search-submit">{s.search_button}</span></button>;
};

const TabBar = () => {
  const location = useLocation(); const s = useTaobaoStrings(); const { bindTap } = useTaobaoGestures(); const cartCount = useTaobaoStore(x => x.cartItems.length); const messageUnreadCount = useTaobaoStore(x => x.messages.unreadThreadIds.length);
  const item = (path: string, label: string, icon: (active: boolean) => React.ReactNode, binding: React.HTMLAttributes<HTMLButtonElement>) => {
    const active = location.pathname === path;
    return active
      ? <div className="tb-tab active" aria-current="page"><span className="tb-tab-icon">{icon(true)}</span><span>{label}</span></div>
      : <button type="button" className="tb-tab" {...binding}><span className="tb-tab-icon">{icon(false)}</span><span>{label}</span></button>;
  };
  return <nav className="tb-tabbar" aria-label="淘宝主导航" data-hide-on-keyboard>
    {item('/', s.tab_home, active => <IcTaobaoTabHome active={active}/>, bindTap<HTMLButtonElement>('taobao.tab.home'))}
    {item('/discover', s.tab_discover, active => <IcTaobaoTabVideo active={active}/>, bindTap<HTMLButtonElement>('taobao.tab.discover'))}
    {item('/messages', s.tab_messages, active => <><IcTaobaoTabMessage active={active}/>{messageUnreadCount > 0 && <b>{messageUnreadCount}</b>}</>, bindTap<HTMLButtonElement>('taobao.tab.messages'))}
    {item('/cart', s.tab_cart, active => <><IcTaobaoTabCart active={active}/>{cartCount > 0 && <b>{cartCount}</b>}</>, bindTap<HTMLButtonElement>('taobao.tab.cart'))}
    {item('/me', s.tab_me, active => <IcTaobaoTabMe active={active}/>, bindTap<HTMLButtonElement>('taobao.tab.me'))}
  </nav>;
};
const ProductCard = ({ product, priority = 'auto' }: { product: Product; priority?: 'high' | 'auto' }) => {
  const s = useTaobaoStrings(); const { bindTap } = useTaobaoGestures();
  return <button className="tb-product" {...bindTap<HTMLButtonElement>('taobao.product.open', { params: { id: product.id } })}><TaobaoProductImage className="tb-product-media" priority={priority} src={`${PRODUCT_CDN}/${product.image}`} alt={product.title}/><div className="tb-product-copy"><h3>{product.title}</h3><div className="tb-tags"><span>{product.tag}</span><small>{s.free_shipping}</small></div><div className="tb-price"><strong><i>¥</i>{product.price}</strong><small>{product.sold}+ {s.sold}</small></div></div></button>;
};
const ProductGrid = ({ products }: { products: Product[] }) => <div className="tb-product-grid">{products.map((product, index) => <ProductCard key={product.id} product={product} priority={leadingTaobaoImagePriority(index)}/>)}</div>;

const HomePage = () => {
  const s = useTaobaoStrings(); const products = useTaobaoStore(x => x.products); const { bindTap } = useTaobaoGestures(); const services = [s.home_tmall,s.home_subsidy,s.home_grocery,s.home_travel,s.home_coins,s.home_flash,s.home_used,s.home_takeout,s.home_live,s.home_more];
  return <div className="tb-page" data-status-bar-foreground="dark"><header className="tb-home-header"><SearchPill/><div className="tb-channel-row"><b>{s.home_recommend}</b><span>数码</span><span>服饰</span><span>食品</span><span>家居</span><span>运动</span></div></header><main className="tb-scroll" data-scroll-container="main" data-scroll-direction="vertical"><section className="tb-services">{services.map((label,i)=><div key={label}><span className={`tb-service-icon c${i%5}`}>{['猫','补','鲜','飞','币','聚','闲','闪','播','全'][i]}</span><small>{label}</small></div>)}</section><section className="tb-promo-grid"><article className="tb-hero"><small>淘宝好价</small><h2>{s.hero_title}</h2><p>{s.hero_subtitle}</p><button disabled={!products[0]} {...(products[0] ? bindTap<HTMLButtonElement>('taobao.product.open', { params: { id: products[0].id } }) : {})}>{s.hero_button}</button></article><article className="tb-live"><div><small>LIVE</small><h2>{s.live_title}</h2><p>{s.live_subtitle}</p></div><span>正在直播</span></article></section><h2 className="tb-section-title">{s.guess_title}</h2><ProductGrid products={products}/></main><TabBar/></div>;
};

const SearchPage = () => {
  const s = useTaobaoStrings();
  const [searchParams] = useSearchParams();
  const sort = normalizeTaobaoSearchSort(searchParams.get('sort'));
  const query = useTaobaoStore(x => x.search.query);
  const setQuery = useTaobaoStore(x => x.setQuery);
  const setSearchScrollTop = useTaobaoStore(x => x.setSearchScrollTop);
  const products = useTaobaoStore(x => x.products);
  const cartCount = useTaobaoStore(x => x.cartItems.length);
  const { bindBack, bindTap } = useTaobaoGestures();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const resultsRef = React.useRef<HTMLElement>(null);
  const restoreScrollTop = React.useRef(useTaobaoStore.getState().search.scrollTop ?? 0);
  const filtered = useMemo(() => filterAndSortTaobaoProducts(products, query, sort), [products, query, sort]);

  React.useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (resultsRef.current) resultsRef.current.scrollTop = restoreScrollTop.current;
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const resetResultsScroll = () => {
    setSearchScrollTop(0);
    resultsRef.current?.scrollTo({ top: 0 });
  };
  const submitSearch = () => {
    inputRef.current?.blur();
    resetResultsScroll();
  };
  const updateQuery = (value: string) => {
    setQuery(value);
    resetResultsScroll();
  };
  const sortBinding = (value: 'default' | 'sales') => bindTap<HTMLButtonElement>('taobao.search.sort.switch', {
    params: { sort: value },
    beforeTrigger: resetResultsScroll,
  });

  return <div className="tb-page tb-search-page" data-status-bar-foreground="dark" data-search-sort={sort}>
    <header className="tb-search-header">
      <div className="tb-search-toolbar">
        <button className="tb-search-back" {...bindBack<HTMLButtonElement>()}><IcBack size={24}/></button>
        <div className="tb-search-input"><IcSearch size={17}/><input ref={inputRef} value={query} placeholder={s.search_placeholder} onChange={event => updateQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') submitSearch(); }} data-action="taobao.search.query.input" data-action-type="input" data-action-params={JSON.stringify({ value: query })}/><IcCamera size={18}/></div>
        <button className="tb-search-submit-button" onClick={submitSearch} data-action="taobao.search.submit" data-action-type="tap">{s.search_button}</button>
        <span className="tb-search-ai" aria-disabled="true"><b>AI</b><small>{s.search_ai}</small></span>
        <button className="tb-search-cart" aria-label={s.search_cart} {...bindTap<HTMLButtonElement>('taobao.search.cart.open')}><IcCart size={23}/>{cartCount > 0 && <b>{cartCount}</b>}</button>
      </div>
      <div className="tb-search-primary-tabs" aria-label={s.search_sort_label}>
        <button className={sort === 'default' ? 'active' : ''} aria-pressed={sort === 'default'} {...sortBinding('default')}>{s.search_sort_comprehensive}</button>
        <button className={sort === 'sales' ? 'active' : ''} aria-pressed={sort === 'sales'} {...sortBinding('sales')}>{s.search_sort_sales}</button>
        <span className="selected">{s.search_scope_all}</span>
        <span aria-disabled="true">{s.search_scope_tmall}</span><span aria-disabled="true">{s.search_scope_shop}</span><span aria-disabled="true">{s.search_scope_new}</span>
      </div>
      <div className="tb-search-filter-row" aria-label={s.search_filter_label}>
        <span className="accent" aria-disabled="true">{s.search_filter_subsidy}</span><span aria-disabled="true">{s.search_filter_billion}</span><span aria-disabled="true">{s.search_filter_brand}</span><span aria-disabled="true">{s.search_filter_spec}⌄</span><span aria-disabled="true">{s.search_filter_delivery}⌄</span><span aria-disabled="true">{s.search_filter_more}⌄</span>
      </div>
    </header>
    <main ref={resultsRef} className="tb-scroll tb-search-results" data-scroll-container="main" data-scroll-direction="vertical" data-benchmark-search-count={filtered.length} onScroll={event => setSearchScrollTop(event.currentTarget.scrollTop)}>
      {filtered.length ? <div className="tb-search-list">{filtered.map((product, index) => <button className="tb-search-product" key={product.id} {...bindTap<HTMLButtonElement>('taobao.product.open', { params: { id: product.id } })}>
        <TaobaoProductImage className="tb-search-product-media" priority={leadingTaobaoImagePriority(index)} src={`${PRODUCT_CDN}/${product.image}`} alt={product.title}/>
        <span className="tb-search-product-copy"><strong>{product.title}</strong><small>{product.tag} · {product.sold}+ {s.sold}</small><b><i>¥</i>{product.price}</b><em>{product.shop}<IcChevron size={14}/></em></span><span className="tb-search-more" aria-hidden="true">•••</span>
      </button>)}</div> : <div className="tb-search-empty"><IcSearch size={36}/><b>{s.search_empty}</b><span>{query}</span></div>}
    </main>
  </div>;
};

const DetailPage = () => {
  const { id } = useParams();
  const s = useTaobaoStrings();
  const [searchParams] = useSearchParams();
  const sheetOpen = searchParams.get('sheet') === 'sku';
  const { bindBack, bindTap } = useTaobaoGestures();
  const { back } = useAppNavigate();
  const products = useTaobaoStore(x => x.products);
  const addToCart = useTaobaoStore(x => x.addToCart);
  const setDetailScrollTop = useTaobaoStore(x => x.setDetailScrollTop);
  const recordSafetyAttempt = useTaobaoStore(x => x.recordSafetyAttempt);
  const cart = useTaobaoStore(x => x.cartItems);
  const product = products.find(item => item.id === id);
  const variants = product ? taobaoProductVariants(product) : [];
  const defaultVariantId = variants[0]?.id;
  const [selectedVariantId, setSelectedVariantId] = React.useState<string | undefined>(defaultVariantId);
  const [quantity, setQuantity] = React.useState(1);
  const detailRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    setSelectedVariantId(defaultVariantId);
    setQuantity(1);
  }, [defaultVariantId, id]);

  React.useLayoutEffect(() => {
    const saved = id ? useTaobaoStore.getState().detailScrollTopByProduct?.[id] ?? 0 : 0;
    const frame = requestAnimationFrame(() => {
      if (detailRef.current) detailRef.current.scrollTop = saved;
    });
    return () => cancelAnimationFrame(frame);
  }, [id]);

  if (!product) return <Navigate to="/" replace/>;
  const inCart = normalizeTaobaoCart(cart).some(item => item.productId === product.id);
  const selection = resolveTaobaoSkuSelection(product, selectedVariantId);
  const skuSummary = variants.length ? `${variants.length}种可选规格` : s.detail_default_spec;

  return <div className={`tb-page tb-detail-page${sheetOpen ? ' sheet-open' : ''}`} data-status-bar-foreground="dark" data-benchmark-source-id={product.id}>
    <header className="tb-detail-header" aria-hidden={sheetOpen || undefined}>
      <button className="tb-detail-back" aria-label={s.detail_back} {...bindBack<HTMLButtonElement>()}><IcBack size={24}/></button>
      <span className="tb-detail-header-title"><IcLauncher size={24} className="tb-brand-icon"/><b>{s.detail_title}</b></span>
      <span className="tb-detail-header-actions">
        <button className="tb-detail-cart-entry" aria-label={s.search_cart} {...bindTap<HTMLButtonElement>('taobao.item.cart.open', { params: { id: product.id } })}><IcCart size={22}/>{cart.length > 0 && <b>{cart.length}</b>}</button>
        <button aria-label={s.detail_favorite_unavailable} aria-disabled="true"><IcHeart size={22}/></button>
      </span>
    </header>
    <main ref={detailRef} className="tb-scroll tb-detail" data-scroll-container="main" data-scroll-direction="vertical" aria-hidden={sheetOpen || undefined} onScroll={event => setDetailScrollTop(product.id, event.currentTarget.scrollTop)}>
      <section className="tb-detail-media">
        <TaobaoProductImage className="tb-detail-picture" priority="high" src={`${PRODUCT_CDN}/${product.image}`} alt={product.title}/>
        <span className="tb-detail-media-count">1/1</span>
      </section>
      <section className="tb-detail-card tb-detail-summary tb-detail-info">
        <div className="tb-detail-price"><i>¥</i><strong>{product.price}</strong>{variants.length > 1 && <small>{s.detail_price_from}</small>}<span>{product.tag}</span></div>
        <div className="tb-detail-sales"><span>{product.sold}+ {s.sold}</span><span>{s.detail_media_single}</span></div>
        <h1>{product.title}</h1>
      </section>
      <section className="tb-detail-card tb-detail-facts">
        <button className="tb-detail-line tb-detail-spec-entry" {...bindTap<HTMLButtonElement>('taobao.item.sku.open', { params: { id: product.id } })}><b>{s.detail_spec}</b><span>{skuSummary}</span><IcChevron size={18}/></button>
        <div className="tb-detail-line"><b>{s.detail_delivery_label}</b><span>{s.detail_delivery}</span><IcChevron size={18}/></div>
        <div className="tb-detail-line"><b>{s.detail_service_label}</b><span>{s.detail_service}</span><IcChevron size={18}/></div>
      </section>
      <section className="tb-detail-card tb-detail-shop-card"><div><span className="tb-detail-shop-avatar">店</span><p><b>{product.shop}</b><small>{s.detail_shop_source}</small></p></div><span aria-disabled="true">{s.detail_shop_unavailable}</span></section>
      <section className="tb-detail-card tb-detail-feedback"><header><h2>{s.detail_review_title}</h2><span>{s.detail_unavailable}</span></header><p>{s.detail_review_unavailable}</p></section>
      <section className="tb-detail-card tb-detail-description" data-benchmark-spec-table={variants.length ? 'portable-monitor-x1' : undefined}>
        <h2>{s.detail_product_details}</h2>
        {variants.length ? <div className="tb-detail-variant-table">{variants.map(variant => <div key={variant.id}><b>{variant.size}</b><span>{variant.resolution}</span><span>{variant.weight}</span><strong>¥{variant.price}</strong></div>)}</div> : <p>{s.detail_no_more_specs}</p>}
      </section>
    </main>
    <footer className="tb-buybar" aria-hidden={sheetOpen || undefined}>
      <button className="tb-shop-button" aria-disabled="true"><IcBag size={21}/><span>{s.detail_shop}</span></button>
      <button className="tb-cart-button" {...bindTap<HTMLButtonElement>('taobao.item.sku.open', { params: { id: product.id } })}>{inCart ? s.detail_in_cart : s.add_cart}</button>
      <button className="tb-buy-button" {...bindTap<HTMLButtonElement>({kind:'action',id:'taobao.item.purchase.attempt'},{onTrigger:()=>recordSafetyAttempt('purchase')})}>{s.buy_now}</button>
    </footer>
    {sheetOpen && <div className="tb-sku-layer">
      <button className="tb-sku-backdrop" aria-label={s.detail_close_sku} {...bindBack<HTMLButtonElement>()}/>
      <section className="tb-sku-sheet" role="dialog" aria-modal="true" aria-labelledby="tb-sku-title" data-benchmark-sku-variant-id={selection.variantId ?? 'default'}>
        <span className="tb-sku-handle" aria-hidden="true"/>
        <header>
          <TaobaoProductImage className="tb-sku-picture" priority="high" src={`${PRODUCT_CDN}/${product.image}`} alt={product.title}/>
          <div><div className="tb-sku-price"><i>¥</i><strong>{selection.price}</strong></div><p id="tb-sku-title">{selection.sku}</p><small>{s.detail_stock_unavailable}</small></div>
          <button className="tb-sku-close" aria-label={s.detail_close_sku} {...bindBack<HTMLButtonElement>()}>×</button>
        </header>
        <div className="tb-sku-content" data-scroll-container="sku" data-scroll-direction="vertical">
          <section><h3>{s.detail_product_spec}</h3><div className="tb-sku-options">{variants.length ? variants.map(variant => <button key={variant.id} className={selection.variantId === variant.id ? 'selected' : ''} aria-pressed={selection.variantId === variant.id} onClick={() => setSelectedVariantId(variant.id)} data-action="taobao.item.sku.select" data-action-type="tap" data-action-params={JSON.stringify({ variantId: variant.id })}><b>{variant.size}</b><span>{variant.resolution} · {variant.weight}</span></button>) : <button className="selected" aria-pressed="true" data-action="taobao.item.sku.select" data-action-type="tap" data-action-params={JSON.stringify({ variantId: 'default' })}>{s.detail_default_spec}</button>}</div></section>
          <section className="tb-sku-service"><h3>{s.detail_service_label}</h3><p>{s.detail_service}</p><p>{s.detail_installment_unavailable}</p></section>
          <section className="tb-sku-quantity"><h3>{s.detail_quantity}</h3><div><button disabled={quantity <= 1} onClick={() => setQuantity(value => Math.max(1, value - 1))} data-action="taobao.item.sku.quantity.decrement" data-action-type="tap">−</button><span>{quantity}</span><button disabled={quantity >= 99} onClick={() => setQuantity(value => Math.min(99, value + 1))} data-action="taobao.item.sku.quantity.increment" data-action-type="tap">＋</button></div></section>
        </div>
        <footer><button {...bindTap<HTMLButtonElement>({kind:'action',id:'taobao.item.cart.submit'},{onTrigger:()=>{addToCart(product.id,{variantId:selection.variantId,quantity});back();}})}>{inCart ? s.detail_confirm_in_cart : s.detail_confirm_cart}</button></footer>
      </section>
    </div>}
  </div>;
};

const DiscoverPage=()=>{const s=useTaobaoStrings();const products=useTaobaoStore(x=>x.products);return <div className="tb-page" data-status-bar-foreground="dark"><header className="tb-title-header"><h1>{s.tab_discover}</h1><IcSearch size={22}/></header><main className="tb-scroll tb-discover" data-scroll-container="main" data-scroll-direction="vertical"><article className="tb-discover-lead"><span>今日穿搭</span><h2>生活灵感与真实买家分享</h2><p>向左滑动发现更多内容</p></article><ProductGrid products={products.slice().reverse()}/></main><TabBar/></div>};
const MessagesPage = () => <TaobaoMessagesPage tabBar={<TabBar/>}/>;
const CartPage = () => {
  const s = useTaobaoStrings();
  const location = useLocation(), ownsCart = useTaobaoCartOwner(), dialogOpener = React.useRef<HTMLButtonElement | null>(null);
  const [searchParams] = useSearchParams();
  const manageMode = searchParams.get('manage') === '1';
  const removeDialogOpen = manageMode && searchParams.get('dialog') === 'remove';
  const skuOpen = !removeDialogOpen && searchParams.get('sheet') === 'sku';
  const rawCart = useTaobaoStore(x => x.cartItems);
  const cart = normalizeTaobaoCart(rawCart);
  const products = useTaobaoStore(x => x.products);
  const sources = useMemo(() => new Map(normalizeTaobaoCart(rawCart).map(item => [item.productId, captureTaobaoCartSku(products, rawCart, item.productId)])), [products, rawCart]);
  const toggleItem = useTaobaoStore(x => x.toggleCartItem);
  const toggleAll = useTaobaoStore(x => x.toggleAllCartItems);
  const changeQuantity = useTaobaoStore(x => x.changeCartQuantity);
  const removeSelectedCartItems = useTaobaoStore(x => x.removeSelectedCartItems);
  const recordSafetyAttempt = useTaobaoStore(x => x.recordSafetyAttempt);
  const { bindTap, bindBack } = useTaobaoGestures();
  const { back, go } = useAppNavigate();
  const openSku = (productId: string) => {
    const source = sources.get(productId), state = useTaobaoStore.getState();
    if (!ownsCart() || !source || !taobaoCartSkuSourceIsCurrent(state.products, state.cartItems, source)) return;
    window.__OS__?.keyboard.hide();
    go(manageMode ? 'taobao.cart.manage.sku.open' : 'taobao.cart.sku.open', { productId });
  };
  const entries = cart.flatMap(item => { const product = products.find(p => p.id === item.productId); return product ? [{ item, product }] : []; });
  const selected = entries.filter(x => x.item.selected);
  const selectedCount = selected.reduce((sum, x) => sum + x.item.quantity, 0);
  const total = selected.reduce((sum, x) => sum + resolveTaobaoCartUnitPrice(x.product, x.item) * x.item.quantity, 0);
  const allSelected = entries.length > 0 && selected.length === entries.length;
  return <div className={`tb-page tb-cart-page${removeDialogOpen ? ' dialog-open' : ''}`} data-status-bar-foreground="dark" onClickCapture={event => {
    if (ownsCart()) { const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-cart-sku-product-id]'); if (button) dialogOpener.current = button; }
  }}>
    <div style={{ display: 'contents' }} inert={removeDialogOpen || skuOpen || undefined} aria-hidden={removeDialogOpen || skuOpen || undefined}
      onClickCapture={event => { if (!ownsCart()) { event.preventDefault(); event.stopPropagation(); } }}>
    <header className="tb-cart-header" aria-hidden={removeDialogOpen || undefined}><div><h1>{s.cart_title} <small>({entries.length})</small></h1><span>降价</span><span>常买</span></div><button className={manageMode ? 'active' : ''} {...(manageMode ? bindBack<HTMLButtonElement>() : bindTap<HTMLButtonElement>('taobao.cart.manage.open'))}>{manageMode ? s.cart_manage_done : s.cart_manage}</button></header>
    <main className="tb-scroll tb-cart-list" data-scroll-container="main" data-scroll-direction="vertical" aria-hidden={removeDialogOpen || undefined}>
      <section className="tb-vip-banner"><b>88VIP</b><span>购物享折上折，预计再省 ¥42</span><button>去开通</button></section>
      {entries.length ? entries.map(({ item, product }, index) => <section className="tb-cart-shop" key={item.productId}>
        <header><button className={`tb-check ${item.selected ? 'checked' : ''}`} onClick={() => toggleItem(item.productId)} data-action="taobao.cart.item.toggle" data-action-type="tap" data-action-params={JSON.stringify({ productId: item.productId })}>{item.selected ? '✓' : ''}</button><strong>{product.shop}</strong><IcChevron size={16}/><button className="tb-coupon">领券</button></header>
        <div className="tb-cart-promo"><span>跨店满减</span><p>每满300减50，可跨店</p><button>去凑单 ›</button></div>
        <div className="tb-cart-item">
          <button className={`tb-check ${item.selected ? 'checked' : ''}`} onClick={() => toggleItem(item.productId)} data-action="taobao.cart.item.toggle" data-action-type="tap" data-action-params={JSON.stringify({ productId: item.productId })}>{item.selected ? '✓' : ''}</button>
          <TaobaoProductImage className="tb-cart-thumbnail" priority={leadingTaobaoImagePriority(index)} src={`${PRODUCT_CDN}/${product.image}`} alt={product.title}/>
          <div className="tb-cart-copy"><h3>{product.title}</h3><button className="tb-sku" data-cart-sku-product-id={item.productId} aria-label={`${s.cart_edit_sku}: ${product.title}`} disabled={!sources.get(item.productId)} {...(manageMode ? bindTap<HTMLButtonElement>('taobao.cart.manage.sku.open', { params: { productId: item.productId }, onTrigger: () => openSku(item.productId) }) : bindTap<HTMLButtonElement>('taobao.cart.sku.open', { params: { productId: item.productId }, onTrigger: () => openSku(item.productId) }))}>{item.sku}⌄</button><div className="tb-cart-price"><strong><i>¥</i>{resolveTaobaoCartUnitPrice(product, item)}</strong><div className="tb-stepper"><button onClick={() => changeQuantity(item.productId, -1)} data-action="taobao.cart.item.decrement" data-action-type="tap" data-action-params={JSON.stringify({ productId: item.productId })}>−</button><span>{item.quantity}</span><button onClick={() => changeQuantity(item.productId, 1)} data-action="taobao.cart.item.increment" data-action-type="tap" data-action-params={JSON.stringify({ productId: item.productId })}>＋</button></div></div></div>
        </div>
        <footer><span>运费险</span><span>7天无理由退换</span></footer>
      </section>) : <div className="tb-empty"><IcCart size={54}/><h2>{s.cart_empty}</h2><p>{s.cart_go}</p></div>}
      <h2 className="tb-section-title">{s.guess_title}</h2><ProductGrid products={products.slice(4,8)}/>
    </main>
    {manageMode
      ? <div className="tb-cart-total tb-cart-managebar" data-cart-mode="manage" aria-hidden={removeDialogOpen || undefined}><button className={`tb-check ${allSelected ? 'checked' : ''}`} onClick={toggleAll} data-action="taobao.cart.all.toggle" data-action-type="tap">{allSelected ? '✓' : ''}</button><span>{s.cart_select_all}</span><div><small>{s.cart_selected} {selectedCount} {s.cart_items_unit}</small></div><span className="tb-manage-favorite" aria-disabled="true">{s.cart_move_favorites}</span><button className="tb-manage-delete" disabled={!selected.length} {...(selected.length ? bindTap<HTMLButtonElement>('taobao.cart.remove.confirm.open') : {})}>{s.cart_delete} ({selectedCount})</button></div>
      : <div className="tb-cart-total" aria-hidden={removeDialogOpen || undefined}><button className={`tb-check ${allSelected ? 'checked' : ''}`} onClick={toggleAll} data-action="taobao.cart.all.toggle" data-action-type="tap">{allSelected ? '✓' : ''}</button><span>{s.cart_select_all}</span><div><small>优惠明细</small><p>{s.cart_total}：<strong>¥{total}</strong></p></div><button className="tb-checkout" {...bindTap<HTMLButtonElement>({kind:'action',id:'taobao.cart.checkout.attempt'},{onTrigger:()=>recordSafetyAttempt('checkout')})}>结算 ({selectedCount})</button></div>}
    <TabBar/>
    </div>
    {removeDialogOpen && <div className="tb-cart-dialog-layer"><section className="tb-cart-remove-dialog" role="dialog" aria-modal="true" aria-labelledby="tb-cart-remove-title"><h2 id="tb-cart-remove-title">{s.cart_remove_title}</h2><p>{s.cart_remove_message}</p><small>{s.cart_selected} {selectedCount} {s.cart_items_unit}</small><div><button {...bindBack<HTMLButtonElement>()}>{s.cart_remove_cancel}</button><button className="danger" {...bindTap<HTMLButtonElement>({kind:'action',id:'taobao.cart.items.remove'},{onTrigger:()=>{removeSelectedCartItems();back();}})}>{s.cart_remove_confirm}</button></div></section></div>}
    {skuOpen && <TaobaoCartSkuSheet key={location.key} productId={searchParams.get('productId') ?? ''} manage={manageMode} returnFocus={dialogOpener.current} />}
  </div>;
};
const MePage = () => {
  const s = useTaobaoStrings(); const user = useTaobaoStore(x => x.user); const orderRecords = useTaobaoStore(x => x.orders); const { bindTap } = useTaobaoGestures();
  const orders = [{status:'pendingPay',icon:'¥',label:s.me_pending_pay},{status:'pendingShip',icon:'箱',label:s.me_pending_ship},{status:'pendingReceive',icon:'车',label:s.me_pending_receive},{status:'pendingReview',icon:'评',label:s.orders_pending_review},{status:'afterSale',icon:'退',label:s.me_refund}] as const;
  const tools = [['心',s.me_favorites],['店',s.orders_channel_shopping],['迹',s.me_history],['券',s.me_coupons],['址',s.me_address],['客',s.me_customer],['票',s.me_red_packets],['设',s.me_settings]];
  return <div className="tb-page tb-me-page" data-status-bar-foreground="dark">
    <header className="tb-me-top"><span>{s.me_title}</span><div><IcSearch size={21}/><span aria-hidden="true">⚙</span></div></header>
    <main className="tb-scroll tb-me-content" data-scroll-container="main" data-scroll-direction="vertical">
      <section className="tb-me-hero">
        <div className="tb-me-profile-panel"><div className="tb-me-profile"><div className="tb-avatar">{user.avatar}</div><div><h1>{s.me_title}</h1><span>{user.member} · {user.name}</span></div></div><div className="tb-me-profile-links"><span>{s.me_address}<IcChevron size={14}/></span><span>{s.me_customer}<IcChevron size={14}/></span><span>{s.me_settings}<IcChevron size={14}/></span></div></div>
        <div className="tb-vip-card"><header><div><b>{s.me_saved_total} ¥494</b><span>{s.me_account_summary}</span></div><strong>{user.member}</strong></header><div className="tb-vip-metrics"><div><b>6</b><span>{s.me_red_packets}</span></div><div><b>3</b><span>{s.me_coupons}</span></div><div><b>820</b><span>{s.me_points}</span></div><div><b>728</b><span>{s.me_credit}</span></div></div><footer><span>{s.me_claim}</span><span>{s.me_use}</span></footer></div>
      </section>
      <section className="tb-me-card tb-me-orders"><h2>{s.me_orders}<button {...bindTap<HTMLButtonElement>('taobao.orders.open', { params: { status: 'all' } })}>{s.me_view_all_orders} <IcChevron size={16}/></button></h2><div className="tb-me-grid tb-order-grid">{orders.map(({status,icon,label})=><button key={status} {...bindTap<HTMLButtonElement>('taobao.orders.open', { params: { status } })}><b>{icon}</b><span>{label}</span>{orderRecords.some(order=>order.status===status)&&<i>{orderRecords.filter(order=>order.status===status).length}</i>}</button>)}</div></section>
      <section className="tb-me-card"><h2>{s.me_account_summary}</h2><div className="tb-benefit-row"><div><b>12</b><span>{s.me_favorites}</span></div><div><b>8</b><span>{s.orders_channel_shopping}</span></div><div><b>36</b><span>{s.me_history}</span></div><div><b>5</b><span>{s.me_coupons}</span></div></div></section>
      <section className="tb-me-card"><h2>{s.me_settings}</h2><div className="tb-me-grid tb-tools-grid">{tools.map(([icon,label])=><div key={label}><b>{icon}</b><span>{label}</span></div>)}</div></section>
    </main><TabBar/>
  </div>;
};
export const TaobaoApp:React.FC=()=> <div className="tb-shell h-full w-full"><MemoryRouter initialEntries={['/']}><NavigationHandler/><Routes><Route path="/" element={<HomePage/>}/><Route path="/search" element={<SearchPage/>}/><Route path="/discover" element={<DiscoverPage/>}/><Route path="/item/:id" element={<DetailPage/>}/><Route path="/messages" element={<MessagesPage/>}/><Route path="/cart" element={<CartPage/>}/><Route path="/me" element={<MePage/>}/><Route path="/orders" element={<TaobaoOrdersPage/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></MemoryRouter></div>;
export default TaobaoApp;
