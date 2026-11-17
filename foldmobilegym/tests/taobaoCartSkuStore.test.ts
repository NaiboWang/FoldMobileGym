import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../os/createAppStore', async () => {
  const { createStore } = await import('zustand/vanilla');
  return { createAppStoreWithActions: (_id: string, initial: object, actions: (set: unknown) => object) => createStore(set => ({ ...initial, ...actions(set) })), registerStateAdapter: vi.fn() };
});
import { useTaobaoStore } from '../apps/Taobao/state';
import { captureTaobaoCartSku } from '../apps/Taobao/cartSkuModel';
const initial = useTaobaoStore.getState();
beforeEach(() => useTaobaoStore.setState(initial, true));
describe('Taobao cart SKU compare-and-save', () => {
  it('preserves known default cart specification, other rows, original product records and safety facts', () => {
    const source = captureTaobaoCartSku(initial.products, initial.cartItems, 'phone')!;
    expect(initial.updateCartSku(source, { quantity: 3 })).toBe(true); const after = useTaobaoStore.getState();
    expect(after.cartItems[0]).toEqual({ ...initial.cartItems[0], quantity: 3 });
    expect(after.cartItems[1]).toBe(initial.cartItems[1]); expect(after.cartItems[2]).toBe(initial.cartItems[2]);
    for (const key of ['products', 'orders', 'user', 'messages', 'search', 'safetyAudit', 'detailScrollTopByProduct'] as const) expect(after[key]).toBe(initial[key]);
  });
  it('keeps the same store and row for an accepted no-op save', () => {
    const source = captureTaobaoCartSku(initial.products, initial.cartItems, 'phone')!;
    expect(initial.updateCartSku(source, { quantity: source.row.quantity })).toBe(true); expect(useTaobaoStore.getState()).toBe(initial);
  });
  it('rejects a retained source after another editor changes the row', () => {
    const source = captureTaobaoCartSku(initial.products, initial.cartItems, 'phone')!;
    initial.changeCartQuantity('phone', 1); const before = useTaobaoStore.getState();
    expect(initial.updateCartSku(source, { quantity: 5 })).toBe(false); expect(useTaobaoStore.getState()).toBe(before);
  });
  it('does not recreate a removed cart entry', () => {
    const source = captureTaobaoCartSku(initial.products, initial.cartItems, 'phone')!;
    useTaobaoStore.setState({ cartItems: initial.cartItems.slice(1) }); const before = useTaobaoStore.getState();
    expect(initial.updateCartSku(source, { quantity: 5 })).toBe(false); expect(useTaobaoStore.getState()).toBe(before);
  });
  it('rejects a repriced or replaced product', () => {
    const source = captureTaobaoCartSku(initial.products, initial.cartItems, 'phone')!;
    useTaobaoStore.setState({ products: initial.products.map(product => product.id === 'phone' ? { ...product, price: product.price + 1 } : product) });
    const before = useTaobaoStore.getState(); expect(initial.updateCartSku(source, { quantity: 3 })).toBe(false); expect(useTaobaoStore.getState()).toBe(before);
  });
  it('does not use invalid quantities or undeclared variants to repair source data', () => {
    const source = captureTaobaoCartSku(initial.products, initial.cartItems, 'phone')!;
    expect(initial.updateCartSku(source, { quantity: 0 })).toBe(false);
    expect(initial.updateCartSku(source, { quantity: 2, variantId: 'invented' })).toBe(false); expect(useTaobaoStore.getState()).toBe(initial);
  });
  it('does not update all ambiguous same-ID rows', () => {
    const source = captureTaobaoCartSku(initial.products, initial.cartItems, 'phone')!;
    useTaobaoStore.setState({ cartItems: [...initial.cartItems, { ...source.row }] }); const before = useTaobaoStore.getState();
    expect(initial.updateCartSku(source, { quantity: 3 })).toBe(false); expect(useTaobaoStore.getState()).toBe(before);
  });
  it('replaces only the explicitly edited legacy row and leaves other primitive entries unchanged', () => {
    const legacy = ['phone', 'bag'] as unknown as typeof initial.cartItems;
    useTaobaoStore.setState({ cartItems: legacy }); const source = captureTaobaoCartSku(initial.products, legacy, 'phone')!;
    expect(initial.updateCartSku(source, { quantity: 2 })).toBe(true);
    expect(useTaobaoStore.getState().cartItems).toEqual([{ productId: 'phone', quantity: 2, selected: true, sku: '默认规格' }, 'bag']);
  });
  it('preserves legacy primitive data on accepted no-op save', () => {
    const legacy = ['phone'] as unknown as typeof initial.cartItems; useTaobaoStore.setState({ cartItems: legacy });
    const before = useTaobaoStore.getState(), source = captureTaobaoCartSku(initial.products, legacy, 'phone')!;
    expect(initial.updateCartSku(source, { quantity: 1 })).toBe(true); expect(useTaobaoStore.getState()).toBe(before);
  });
});
