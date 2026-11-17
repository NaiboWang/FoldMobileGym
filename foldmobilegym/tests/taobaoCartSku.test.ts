import { describe, expect, it } from 'vitest';
import { TAOBAO_CONFIG } from '../apps/Taobao/data';
import { captureTaobaoCartSku, initialTaobaoCartVariant, nextTaobaoCartSku, taobaoCartSkuSourceIsCurrent, hasTaobaoCartSkuParent, taobaoCartSkuParent } from '../apps/Taobao/cartSkuModel';
import type { TaobaoCartItem } from '../apps/Taobao/cartModel';
const products = TAOBAO_CONFIG.products, monitor = products.find(p => p.id === 'portable_monitor_x1')!;
const row: TaobaoCartItem = { productId: monitor.id, quantity: 2, selected: false, variantId: 'x1_13', sku: '13.3英寸；1080P；580g' };
const cart = [row], source = captureTaobaoCartSku(products, cart, monitor.id)!;
describe('Taobao cart SKU exact source and draft projection', () => {
  it('retains original product and row objects without rewriting defaults', () => {
    expect(source.product).toBe(monitor); expect(source.rawItem).toBe(row); expect(source.row).toBe(row); expect(source.cart).toBe(cart);
  });
  it.each(['absent', ''])('does not manufacture a source for %s', id => { expect(captureTaobaoCartSku(products, cart, id)).toBeNull(); });
  it('rejects duplicate product IDs and duplicate cart IDs', () => {
    expect(captureTaobaoCartSku([...products, { ...monitor }], cart, monitor.id)).toBeNull();
    expect(captureTaobaoCartSku(products, [row, { ...row }], monitor.id)).toBeNull();
  });
  it('does not treat a same-ID row or product replacement as the displayed source', () => {
    expect(taobaoCartSkuSourceIsCurrent(products, [{ ...row }], source)).toBe(false);
    expect(taobaoCartSkuSourceIsCurrent(products.map(p => p === monitor ? { ...p } : p), cart, source)).toBe(false);
  });
  it('rejects removed or newly ambiguous target sources', () => {
    expect(taobaoCartSkuSourceIsCurrent(products, [], source)).toBe(false);
    expect(taobaoCartSkuSourceIsCurrent(products, [row, row], source)).toBe(false);
  });
  it('allows unrelated row changes and reordering while retaining the exact original target', () => {
    expect(taobaoCartSkuSourceIsCurrent(products, [{ ...TAOBAO_CONFIG.cartItems[0] }, row], source)).toBe(true);
  });
  it('requires exact array identity for legacy primitive rows rather than guessing replacement identity', () => {
    const legacy = ['phone'], captured = captureTaobaoCartSku(products, legacy, 'phone')!;
    expect(captured.row).toEqual({ productId: 'phone', quantity: 1, selected: true, sku: '默认规格' });
    expect(taobaoCartSkuSourceIsCurrent(products, legacy, captured)).toBe(true);
    expect(taobaoCartSkuSourceIsCurrent(products, [...legacy], captured)).toBe(false);
  });
  it('initializes from the real variant ID, then only an exact unique legacy SKU match', () => {
    expect(initialTaobaoCartVariant(source)).toBe('x1_13');
    const legacyRow = { ...row, variantId: undefined };
    expect(initialTaobaoCartVariant(captureTaobaoCartSku(products, [legacyRow], monitor.id)!)).toBe('x1_13');
    expect(initialTaobaoCartVariant(captureTaobaoCartSku(products, [{ ...legacyRow, sku: 'Unknown old option' }], monitor.id)!)).toBeUndefined();
  });
  it('updates only declared variant facts and quantity, preserving selection and extra row metadata', () => {
    const annotated = { ...row, localNote: 'Keep original metadata' }, captured = captureTaobaoCartSku(products, [annotated], monitor.id)!;
    expect(nextTaobaoCartSku(captured, 'x1_15', 3)).toEqual({ ...annotated, quantity: 3, variantId: 'x1_15', sku: '15.6英寸；2.5K；780g' });
    expect(annotated.quantity).toBe(2);
  });
  it.each([undefined, 'invented'])('does not silently choose the first variant for %s', id => { expect(nextTaobaoCartSku(source, id, 2)).toBeNull(); });
  it('preserves an actual cart SKU when the product supplies no alternative variants', () => {
    const original = TAOBAO_CONFIG.cartItems[0], captured = captureTaobaoCartSku(products, [original], original.productId)!;
    expect(nextTaobaoCartSku(captured, undefined, 3)).toEqual({ ...original, quantity: 3 });
    expect(nextTaobaoCartSku(captured, 'invented', 3)).toBeNull();
  });
  it.each([0, -1, 1.5, Number.NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid quantity %s without clamping a source fact', quantity => {
    expect(nextTaobaoCartSku(source, 'x1_15', quantity)).toBeNull();
  });
  it('does not invent a 99-item stock limit for the existing unbounded cart quantity contract', () => {
    expect(nextTaobaoCartSku(source, 'x1_13', 150)?.quantity).toBe(150);
  });
  it('rejects ambiguous or invalid-price variant facts', () => {
    const variant = monitor.variants![0], product = { ...monitor, variants: [variant, { ...variant }] };
    expect(nextTaobaoCartSku(captureTaobaoCartSku([product], cart, monitor.id)!, variant.id, 2)).toBeNull();
    const invalid = { ...monitor, variants: [{ ...variant, price: Number.NaN }] };
    expect(nextTaobaoCartSku(captureTaobaoCartSku([invalid], cart, monitor.id)!, variant.id, 2)).toBeNull();
  });
});
describe('Taobao cart SKU source history', () => {
  it('removes only the SKU layer and target while preserving management and other parent query values', () => {
    expect(taobaoCartSkuParent('?manage=1&sheet=sku&productId=phone&q=local+text')).toBe('/cart?manage=1&q=local+text');
    expect(taobaoCartSkuParent('?sheet=sku&productId=phone')).toBe('/cart');
  });
  it('pops only a semantically matching parent', () => {
    expect(hasTaobaoCartSkuParent('?sheet=sku&productId=phone&manage=1&q=local+text', { pathname: '/cart', search: '?q=local%20text&manage=1' })).toBe(true);
  });
  it.each([undefined, { pathname: '/cart', search: '' }, { pathname: '/cart', search: '?manage=1&sheet=sku&productId=other' },
    { pathname: '/cart', search: '?manage=1&dialog=remove' }, { pathname: '/item/phone', search: '?manage=1' }])('does not borrow another parent %o', previous => {
    expect(hasTaobaoCartSkuParent('?manage=1&sheet=sku&productId=phone', previous)).toBe(false);
  });
});
