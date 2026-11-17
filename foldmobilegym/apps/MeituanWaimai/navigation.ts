import { readReviewMediaRequest, reviewMediaBackDelta, reviewMediaOwnerPath } from './reviewMedia';
import { useCallback, useContext } from 'react';
import { UNSAFE_NavigationContext, useLocation, useNavigate } from 'react-router-dom';
import { readMeituanOrigin } from './searchOrigin';
import { getTracker } from '../../os/utils/memoryHistoryTracker';
import { readShopRouteId, readShopRouteSection } from './routeIdentity';

type Category = 'all' | 'food' | 'drinks' | 'market';
type Transition = 'meituan.home.open' | `meituan.home.category.${Category}`
  | 'meituan.search.open' | 'meituan.waimai.open' | 'meituan.service.open' | 'meituan.context.shop.open'
  | 'meituan.shop.open' | 'meituan.shop.menu' | 'meituan.shop.reviews' | 'meituan.shop.info'
  | 'meituan.menu.category.open' | 'meituan.menu.category.reset'
  | 'meituan.reviews.filter.all' | 'meituan.reviews.filter.latest' | 'meituan.reviews.filter.positive'
  | 'meituan.reviews.filter.negative' | 'meituan.reviews.filter.media'
  | 'meituan.reviews.media.open' | 'meituan.reviews.media.close' | 'meituan.reviews.media.previous' | 'meituan.reviews.media.next'
  | 'meituan.cart.open' | 'meituan.checkout.open' | 'meituan.orders.open' | 'meituan.profile.open';

export function useMeituanNavigation(query: string, category: Category, cartShopId: string) {
  const navigate = useNavigate();
  const location = useLocation();
  const { navigator } = useContext(UNSAFE_NavigationContext);
  const current = new URLSearchParams(location.search);
  const originContext = readMeituanOrigin(location.search);
  const searchOrigin = originContext?.path ?? null;
  const hasSearchContext = originContext?.kind === 'search';
  const isMainSearch = current.get('search') === 'open' || (Boolean(current.get('q')) && current.get('channel') !== 'waimai');
  const homeCategoryRoute = (nextCategory: Category) => {
    const params = new URLSearchParams(location.pathname === '/' ? location.search : searchOrigin?.slice(2));
    for (const key of [...params.keys()]) if (!['q', 'category', 'search', 'channel'].includes(key)) params.delete(key);
    if (nextCategory === 'all') params.delete('category');
    if (nextCategory !== 'all') params.set('category', nextCategory);
    if (query) params.set('q', query); else params.delete('q');
    if (current.get('channel') === 'waimai') params.set('channel', 'waimai');
    if (current.get('search') === 'open' || hasSearchContext) params.set('search', 'open');
    const search = params.toString();
    return search ? `/?${search}` : '/';
  };
  const replaceSearch = useCallback((path: string) => navigate(path, { replace: true }), [navigate]);
  const shopContextSearch = (keepCategory = true) => {
    const params = new URLSearchParams();
    const carryOrigin = location.pathname === '/' ? current.get('channel') !== 'waimai' : searchOrigin !== null;
    if (carryOrigin) {
      const parent = new URLSearchParams(homeCategoryRoute(category).slice(2));
      if (isMainSearch || hasSearchContext) parent.set('search', 'open');
      parent.delete('channel');
      params.set('origin', parent.size ? '/?' + parent.toString() : '/');
    }
    if (keepCategory && location.pathname.startsWith('/shop/')) {
      for (const key of ['menuCategory', 'reviewFilter']) {
        for (const value of current.getAll(key)) params.append(key, value);
      }
    }
    return params.size ? '?' + params.toString() : '';
  };
  const closeReviewMedia = () => {
    const tracker = getTracker(navigator);
    const index = (navigator as unknown as { index?: number }).index ?? 0;
    const delta = tracker ? reviewMediaBackDelta(tracker.stack, index, location) : 0;
    if (delta) navigate(delta);
    else replaceSearch(reviewMediaOwnerPath(location));
  };
  const go = (id: Transition, shopId = cartShopId, mediaIndex?: number) => {
    if (id === 'meituan.home.open') replaceSearch('/');
    if (id === 'meituan.search.open') {
      if (current.get('search') === 'open') return;
      const params = new URLSearchParams(homeCategoryRoute(category).slice(2));
      params.delete('channel');
      params.set('search', 'open');
      const search = params.toString();
      navigate(search ? `/?${search}` : '/?search=open');
    }
    if (id === 'meituan.waimai.open') {
      const params = new URLSearchParams(homeCategoryRoute(category).slice(2));
      params.delete('search');
      params.set('channel', 'waimai');
      const search = params.toString();
      navigate(search ? `/?${search}` : '/?channel=waimai');
    }
    if (id === 'meituan.service.open' && shopId) {
      navigate(`/service/${encodeURIComponent(shopId)}`);
    }
    if (id === 'meituan.context.shop.open') {
      if (!searchOrigin) return;
      replaceSearch('/shop/' + encodeURIComponent(shopId) + shopContextSearch(false));
    }
    if (id === 'meituan.menu.category.open' || id === 'meituan.menu.category.reset') {
      const routeShop = readShopRouteId(location.pathname);
      if (!routeShop || readShopRouteSection(location.pathname) !== 'menu') return;
      const params = new URLSearchParams(shopContextSearch().slice(1));
      if (id === 'meituan.menu.category.reset') params.delete('menuCategory');
      else params.set('menuCategory', shopId);
      const search = params.toString();
      replaceSearch('/shop/' + encodeURIComponent(routeShop) + (search ? '?' + search : ''));
    }
    if (id === 'meituan.reviews.filter.all' || id === 'meituan.reviews.filter.latest'
      || id === 'meituan.reviews.filter.positive' || id === 'meituan.reviews.filter.negative' || id === 'meituan.reviews.filter.media') {
      const routeShop = readShopRouteId(location.pathname);
      if (!routeShop || readShopRouteSection(location.pathname) !== 'reviews') return;
      const params = new URLSearchParams(shopContextSearch().slice(1));
      params.delete('reviewFilter');
      if (id === 'meituan.reviews.filter.latest') params.set('reviewFilter', 'latest');
      if (id === 'meituan.reviews.filter.positive') params.set('reviewFilter', 'positive');
      if (id === 'meituan.reviews.filter.negative') params.set('reviewFilter', 'negative');
      if (id === 'meituan.reviews.filter.media') params.set('reviewFilter', 'media');
      replaceSearch('/shop/' + encodeURIComponent(routeShop) + '/reviews' + (params.size ? '?' + params.toString() : ''));
    }
    if (id === 'meituan.reviews.media.open' || id === 'meituan.reviews.media.close'
      || id === 'meituan.reviews.media.previous' || id === 'meituan.reviews.media.next') {
      const routeShop = readShopRouteId(location.pathname);
      if (!routeShop || readShopRouteSection(location.pathname) !== 'reviews') return;
      const params = new URLSearchParams(location.search);
      if (id === 'meituan.reviews.media.close') { closeReviewMedia(); return; }
      const reviewId = id === 'meituan.reviews.media.open' ? shopId : params.get('reviewMedia');
      const currentIndex = Number(params.get('reviewMediaIndex') ?? 0);
      const index = id === 'meituan.reviews.media.open' ? mediaIndex
        : currentIndex + (id === 'meituan.reviews.media.next' ? 1 : -1);
      if (!reviewId || index === undefined || !Number.isInteger(index) || index < 0) return;
      params.set('reviewMedia', reviewId);
      params.set('reviewMediaIndex', String(index));
      const path = '/shop/' + encodeURIComponent(routeShop) + '/reviews?' + params.toString();
      if (id === 'meituan.reviews.media.open') navigate(path);
      else replaceSearch(path);
    }
    if (id === 'meituan.home.category.all') replaceSearch(homeCategoryRoute('all'));
    if (id === 'meituan.home.category.food') replaceSearch(homeCategoryRoute('food'));
    if (id === 'meituan.home.category.drinks') replaceSearch(homeCategoryRoute('drinks'));
    if (id === 'meituan.home.category.market') replaceSearch(homeCategoryRoute('market'));
    if (id === 'meituan.shop.open' || id === 'meituan.cart.open') {
      // Flush typed input before pushing: the 250 ms URL debounce may not have fired.
      // Keep the context in router history, not a hidden last-search cache.
      if (location.pathname === '/') replaceSearch(homeCategoryRoute(category));
      navigate(id === 'meituan.cart.open' ? '/cart' : `/shop/${encodeURIComponent(shopId)}${shopContextSearch()}`);
    }
    if (id === 'meituan.shop.menu') replaceSearch(`/shop/${encodeURIComponent(shopId)}${shopContextSearch()}`);
    if (id === 'meituan.shop.reviews') replaceSearch(`/shop/${encodeURIComponent(shopId)}/reviews${shopContextSearch()}`);
    if (id === 'meituan.shop.info') replaceSearch(`/shop/${encodeURIComponent(shopId)}/info${shopContextSearch()}`);
    if (id === 'meituan.checkout.open') navigate('/order');
    if (id === 'meituan.orders.open') replaceSearch('/orders');
    if (id === 'meituan.profile.open') replaceSearch('/me');
  };
  const back = () => {
    const homeParams = new URLSearchParams(location.search);
    if (location.pathname === '/' && (isMainSearch || homeParams.get('channel') === 'waimai')) {
      const index = (navigator as unknown as { index?: number }).index ?? 0;
      if (index > 0) navigate(-1);
      else replaceSearch('/');
      return true;
    }
    if (readShopRouteSection(location.pathname) === 'reviews' && readReviewMediaRequest(location.search).kind !== 'closed') {
      closeReviewMedia(); return true;
    }
    if (location.pathname === '/') return false;
    // MemoryRouter exposes its history index; direct/deep-link entries have no
    // prior page. Fall back without pushing a new entry or creating a back loop.
    const index = (navigator as unknown as { index?: number }).index ?? 0;
    if (searchOrigin) {
      const tracker = getTracker(navigator), previous = tracker?.stack[tracker.index - 1];
      if (previous && previous.pathname + previous.search === searchOrigin) navigate(-1);
      else replaceSearch(searchOrigin);
      return true;
    }
    if (index > 0) navigate(-1);
    else replaceSearch(location.pathname === '/cart' && cartShopId
      ? `/shop/${encodeURIComponent(cartShopId)}` : '/');
    return true;
  };
  return { go, back, replaceSearch };
}
