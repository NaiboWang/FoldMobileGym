import { beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({
  navigate: vi.fn(), location: { pathname: '/', search: '' }, navigator: { index: 0 },
}));
vi.mock('react', () => ({
  useContext: () => ({ navigator: harness.navigator }),
  useCallback: (callback: unknown) => callback,
}));
vi.mock('react-router-dom', () => ({
  UNSAFE_NavigationContext: {},
  useLocation: () => harness.location,
  useNavigate: () => harness.navigate,
}));
import { useMeituanNavigation } from '../apps/MeituanWaimai/navigation';
import { syncTracker } from '../os/utils/memoryHistoryTracker';

describe('Meituan navigation command ordering (mocked router, not UI)', () => {
  beforeEach(() => {
    harness.navigate.mockClear();
    harness.location = { pathname: '/', search: '' };
    harness.navigator.index = 0;
  });
  it('flushes unsynchronized query and category before pushing a shop', () => {
    useMeituanNavigation('鸡 & 饭', 'food', 'rice').go('meituan.shop.open', 'shop/a');
    expect(harness.navigate.mock.calls).toEqual([
      ['/?category=food&q=%E9%B8%A1+%26+%E9%A5%AD', { replace: true }],
      ['/shop/shop%2Fa?' + new URLSearchParams({origin: '/?category=food&q=%E9%B8%A1+%26+%E9%A5%AD'}).toString()],
    ]);
  });
  it('flushes the homepage before pushing the cart', () => {
    useMeituanNavigation('鸡', 'all', 'rice').go('meituan.cart.open');
    expect(harness.navigate.mock.calls).toEqual([['/?q=%E9%B8%A1', { replace: true }], ['/cart']]);
  });
  it('does not flush a homepage when opening a shop from the cart', () => {
    harness.location.pathname = '/cart';
    useMeituanNavigation('鸡', 'food', 'rice').go('meituan.shop.open');
    expect(harness.navigate.mock.calls).toEqual([['/shop/rice']]);
  });
  it('pops existing history instead of pushing a back target', () => {
    harness.location.pathname = '/cart'; harness.navigator.index = 2;
    expect(useMeituanNavigation('', 'all', 'rice').back()).toBe(true);
    expect(harness.navigate.mock.calls).toEqual([[-1]]);
  });
  it('falls back from a root cart to its shop with replacement', () => {
    harness.location.pathname = '/cart';
    useMeituanNavigation('', 'all', 'rice').back();
    expect(harness.navigate.mock.calls).toEqual([['/shop/rice', { replace: true }]]);
  });
  it('falls back from a root shop to home without a loop', () => {
    harness.location.pathname = '/shop/rice';
    useMeituanNavigation('', 'all', 'rice').back();
    expect(harness.navigate.mock.calls).toEqual([['/', { replace: true }]]);
  });
  it('does not consume Back at home, but an explicit Home action resets it', () => {
    const nav = useMeituanNavigation('鸡', 'food', 'rice');
    expect(nav.back()).toBe(false); expect(harness.navigate).not.toHaveBeenCalled();
    nav.go('meituan.home.open');
    expect(harness.navigate.mock.calls).toEqual([['/', { replace: true }]]);
  });
  it('opens main search as a URL state and Back consumes it', () => {
    const nav = useMeituanNavigation('鸡', 'food', 'rice');
    nav.go('meituan.search.open');
    expect(harness.navigate.mock.calls).toEqual([['/?category=food&q=%E9%B8%A1&search=open']]);
    harness.navigate.mockClear(); harness.location.search = '?search=open';
    expect(useMeituanNavigation('', 'all', 'rice').back()).toBe(true);
    expect(harness.navigate.mock.calls).toEqual([['/', { replace: true }]]);
  });
  it('opens and exits the Waimai channel without changing the installed app identity', () => {
    const nav = useMeituanNavigation('', 'all', 'rice');
    nav.go('meituan.waimai.open');
    expect(harness.navigate.mock.calls).toEqual([['/?channel=waimai']]);
    harness.navigate.mockClear(); harness.location.search = '?channel=waimai'; harness.navigator.index = 2;
    expect(useMeituanNavigation('', 'all', 'rice').back()).toBe(true);
    expect(harness.navigate.mock.calls).toEqual([[-1]]);
  });
  it('opens an unsupported main service on an explicit scope route', () => {
    useMeituanNavigation('', 'all', 'rice').go('meituan.service.open', 'hotel/travel');
    expect(harness.navigate.mock.calls).toEqual([['/service/hotel%2Ftravel']]);
  });
  it('locates source categories without switching the merchant or losing its parent', () => {
    harness.location = { pathname: '/shop/menu%2Fa%20%25', search: '?origin=%2F' };
    useMeituanNavigation('', 'all', 'rice').go('meituan.menu.category.open', 'drink 🍵');
    expect(harness.navigate.mock.calls).toEqual([['/shop/menu%2Fa%20%25?origin=%2F&menuCategory=drink+%F0%9F%8D%B5', { replace: true }]]);
  });
  it('retains category on tabs but clears it when choosing another source shop', () => {
    harness.location = { pathname: '/shop/rice', search: '?origin=%2F&menuCategory=drinks' };
    const nav = useMeituanNavigation('', 'all', 'rice'); nav.go('meituan.shop.reviews'); nav.go('meituan.context.shop.open', 'salad');
    expect(harness.navigate.mock.calls).toEqual([
      ['/shop/rice/reviews?origin=%2F&menuCategory=drinks', { replace: true }], ['/shop/salad?origin=%2F', { replace: true }],
    ]);
  });
  it('resets unavailable categories explicitly, and ignores menu-only commands from reviews', () => {
    harness.location = { pathname: '/shop/rice', search: '?origin=%2F&menuCategory=missing' };
    useMeituanNavigation('', 'all', 'rice').go('meituan.menu.category.reset');
    expect(harness.navigate.mock.calls).toEqual([['/shop/rice?origin=%2F', { replace: true }]]);
    harness.navigate.mockClear(); harness.location.pathname = '/shop/rice/reviews';
    useMeituanNavigation('', 'all', 'rice').go('meituan.menu.category.open', 'other'); expect(harness.navigate).not.toHaveBeenCalled();
  });
  it('serializes the plain homepage parent and retains it on sibling and tab navigation', () => {
    useMeituanNavigation('', 'all', 'rice').go('meituan.shop.open');
    expect(harness.navigate.mock.calls).toEqual([['/', { replace: true }], ['/shop/rice?origin=%2F']]);
    harness.navigate.mockClear(); harness.location = { pathname: '/shop/rice', search: '?origin=%2F' };
    const nav = useMeituanNavigation('', 'all', 'rice');
    nav.go('meituan.shop.reviews'); nav.go('meituan.context.shop.open', 'salad');
    expect(harness.navigate.mock.calls).toEqual([
      ['/shop/rice/reviews?origin=%2F', { replace: true }], ['/shop/salad?origin=%2F', { replace: true }],
    ]);
  });
  it('flushes a rapid query into the literal search parent before opening a shop', () => {
    harness.location.search = '?search=open';
    useMeituanNavigation('鸡 & 饭', 'food', 'rice').go('meituan.shop.open', 'shop/a');
    const parent = '/?search=open&category=food&q=%E9%B8%A1+%26+%E9%A5%AD';
    expect(harness.navigate.mock.calls).toEqual([[parent, { replace: true }],
      ['/shop/shop%2Fa?' + new URLSearchParams({ origin: parent }).toString()]]);
  });
  it('keeps tabs and sibling selection in one detail history entry', () => {
    const origin = '/?search=open&q=%E9%B8%A1';
    const suffix = '?' + new URLSearchParams({ origin }).toString();
    harness.location = { pathname: '/shop/rice', search: suffix };
    const nav = useMeituanNavigation('鸡', 'all', 'rice');
    nav.go('meituan.shop.reviews'); nav.go('meituan.shop.info');
    nav.go('meituan.context.shop.open', 'salad');
    expect(harness.navigate.mock.calls).toEqual([
      ['/shop/rice/reviews' + suffix, { replace: true }], ['/shop/rice/info' + suffix, { replace: true }],
      ['/shop/salad' + suffix, { replace: true }],
    ]);
  });
  it('returns a cold detail to its exact local parent; invalid parents fall back to home', () => {
    const origin = '/?search=open&q=%2525';
    harness.location = { pathname: '/shop/rice', search: '?' + new URLSearchParams({ origin }).toString() };
    useMeituanNavigation('%25', 'all', 'rice').back();
    expect(harness.navigate.mock.calls).toEqual([[origin, { replace: true }]]);
    harness.navigate.mockClear();
    harness.location.search = '?origin=https%3A%2F%2Fexample.com';
    useMeituanNavigation('', 'all', 'rice').back();
    expect(harness.navigate.mock.calls).toEqual([['/', { replace: true }]]);
  });
  it('pops only a verified previous search parent, not an unrelated home entry', () => {
    const origin = '/?search=open&q=%E9%B8%A1';
    const suffix = '?' + new URLSearchParams({ origin }).toString();
    syncTracker(harness.navigator, { pathname: '/', search: origin.slice(1) });
    harness.navigator.index = 1;
    harness.location = { pathname: '/shop/rice', search: suffix };
    syncTracker(harness.navigator, harness.location);
    useMeituanNavigation('鸡', 'all', 'rice').back();
    expect(harness.navigate.mock.calls).toEqual([[-1]]);
    harness.navigate.mockClear(); harness.navigator.index = 0;
    syncTracker(harness.navigator, { pathname: '/', search: '' });
    harness.navigator.index = 1; syncTracker(harness.navigator, harness.location);
    useMeituanNavigation('鸡', 'all', 'rice').back();
    expect(harness.navigate.mock.calls).toEqual([[origin, { replace: true }]]);
  });
});

describe('Meituan review chip URL commands (mocked router)', () => {
  beforeEach(() => { harness.navigate.mockClear(); harness.location = { pathname: '/shop/reviews/reviews', search: '?origin=%2F&menuCategory=food&reviewFilter=negative' }; harness.navigator.index = 1; });
  it('replaces the selected chip on the current literal shop, retaining only its source/category', () => {
    useMeituanNavigation('', 'all', 'rice').go('meituan.reviews.filter.media');
    expect(harness.navigate.mock.calls).toEqual([['/shop/reviews/reviews?origin=%2F&menuCategory=food&reviewFilter=media', { replace: true }]]);
  });
  it('All removes every duplicate/unknown filter explicitly', () => {
    harness.location.search += '&reviewFilter=unknown';
    useMeituanNavigation('', 'all', 'rice').go('meituan.reviews.filter.all');
    expect(harness.navigate.mock.calls).toEqual([['/shop/reviews/reviews?origin=%2F&menuCategory=food', { replace: true }]]);
  });
  it('retains the filter across merchant tabs but not a different shop', () => {
    const nav = useMeituanNavigation('', 'all', 'rice'); nav.go('meituan.shop.menu', 'reviews');
    expect(harness.navigate.mock.calls[0]).toEqual(['/shop/reviews?origin=%2F&menuCategory=food&reviewFilter=negative', { replace: true }]);
    nav.go('meituan.context.shop.open', 'tea');
    expect(harness.navigate.mock.calls[1]).toEqual(['/shop/tea?origin=%2F', { replace: true }]);
  });
  it('rejects a review-filter command from a different route', () => {
    harness.location.pathname = '/shop/reviews';
    useMeituanNavigation('', 'all', 'rice').go('meituan.reviews.filter.positive');
    expect(harness.navigate).not.toHaveBeenCalled();
  });
});


describe('Meituan media closes to the verified owning reviews entry', () => {
  const owner={pathname:'/shop/rice/reviews',search:'?origin=%2F&reviewFilter=media'};
  const media={...owner,search:owner.search+'&reviewMedia=source&reviewMediaIndex=1'};
  beforeEach(()=>{harness.navigate.mockClear();harness.navigator.index=0;syncTracker(harness.navigator,{pathname:'/',search:''});});
  it('does not pop to an unrelated page on cold media Back',()=>{
    harness.navigator.index=1;harness.location=media;syncTracker(harness.navigator,media);
    useMeituanNavigation('', 'all', 'rice').back();
    expect(harness.navigate.mock.calls).toEqual([[owner.pathname+owner.search,{replace:true}]]);
  });
  it('pops the owning review entry on Close rather than creating a duplicate',()=>{
    syncTracker(harness.navigator,owner);harness.navigator.index=1;harness.location=media;syncTracker(harness.navigator,media);
    useMeituanNavigation('', 'all', 'rice').go('meituan.reviews.media.close');
    expect(harness.navigate.mock.calls).toEqual([[-1]]);
  });
  it('consumes orphan media-index Back without leaving the reviews owner',()=>{
    harness.location={...owner,search:owner.search+'&reviewMediaIndex=0'};
    useMeituanNavigation('', 'all', 'rice').back();
    expect(harness.navigate.mock.calls).toEqual([[owner.pathname+owner.search,{replace:true}]]);
  });
  it('unwinds contiguous old duplicate media entries to their owner',()=>{
    syncTracker(harness.navigator,owner);harness.navigator.index=1;syncTracker(harness.navigator,media);
    harness.navigator.index=2;harness.location=media;syncTracker(harness.navigator,media);
    useMeituanNavigation('', 'all', 'rice').back();expect(harness.navigate.mock.calls).toEqual([[-2]]);
  });
});
