import { beforeEach, describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ location: { pathname: '/cart', search: '' }, navigate: vi.fn(), tracker: undefined as undefined | {
  index: number; stack: Array<{ pathname: string; search: string }>;
} }));
vi.mock('react', () => ({ useCallback: (callback: unknown) => callback, useContext: () => ({ navigator: {} }) }));
vi.mock('react-router-dom', () => ({ UNSAFE_NavigationContext: {}, useNavigate: () => h.navigate, useLocation: () => h.location }));
vi.mock('../os/utils/memoryHistoryTracker', () => ({ getTracker: () => h.tracker }));
import { shouldReplaceTaobaoTransition, useAppNavigate, useCloseTaobaoCartSku } from '../apps/Taobao/navigation';
describe('Taobao cart SKU navigation', () => {
  beforeEach(() => { h.navigate.mockClear(); h.location = { pathname: '/cart', search: '' }; h.tracker = undefined; });
  it('pushes regular and management edit contexts separately and encodes the original product ID', () => {
    useAppNavigate().go('taobao.cart.sku.open', { productId: 'local/item?' });
    expect(h.navigate).toHaveBeenLastCalledWith('/cart?sheet=sku&productId=local%2Fitem%3F', { replace: false });
    useAppNavigate().go('taobao.cart.manage.sku.open', { productId: 'phone' });
    expect(h.navigate).toHaveBeenLastCalledWith('/cart?manage=1&sheet=sku&productId=phone', { replace: false });
  });
  it('does not turn either overlay into a replacing tab switch', () => {
    expect(shouldReplaceTaobaoTransition('taobao.cart.sku.open')).toBe(false);
    expect(shouldReplaceTaobaoTransition('taobao.cart.manage.sku.open')).toBe(false);
    expect(shouldReplaceTaobaoTransition('taobao.tab.cart')).toBe(true);
  });
  it.each(['', '?manage=1'])('uses the same context for cold close %s', parent => {
    h.location.search = parent + (parent ? '&' : '?') + 'sheet=sku&productId=phone'; useCloseTaobaoCartSku()();
    expect(h.navigate).toHaveBeenCalledWith('/cart' + parent, { replace: true });
  });
  it('pops a matching warm source and does not add another cart history entry', () => {
    h.location.search = '?manage=1&sheet=sku&productId=phone';
    h.tracker = { index: 1, stack: [{ pathname: '/cart', search: '?manage=1' }, h.location] }; useCloseTaobaoCartSku()();
    expect(h.navigate).toHaveBeenCalledWith(-1);
  });
  it('does not pop another product/source or delete-confirmation layer', () => {
    h.location.search = '?sheet=sku&productId=phone'; h.tracker = { index: 1, stack: [{ pathname: '/item/phone', search: '' }, h.location] };
    useCloseTaobaoCartSku()(); expect(h.navigate).toHaveBeenCalledWith('/cart', { replace: true });
  });
  it.each([{ pathname: '/cart', search: '' }, { pathname: '/cart', search: '?manage=1&dialog=remove' }, { pathname: '/item/phone', search: '?sheet=sku' }])('does not close an unrelated surface %o', location => {
    h.location = location; useCloseTaobaoCartSku()(); expect(h.navigate).not.toHaveBeenCalled();
  });
});
