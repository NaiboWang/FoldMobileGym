import { describe, expect, it } from 'vitest';
import { resolveMeituanShops } from '../apps/MeituanWaimai/data';

describe('Meituan world and scenario catalog', () => {
  it('preserves the original default prices and store-scoped dish identity', () => {
    const shops = resolveMeituanShops();
    expect(shops.map(shop => shop.id)).toEqual(['rice', 'salad', 'tea', 'market']);
    expect(shops[0].dishes[0].price).toBe(24.8);
    expect(shops.filter(shop => shop.dishes.some(dish => dish.id === 'yogurt')).map(shop => shop.id))
      .toEqual(['salad', 'tea']);
  });
  it('resolves a full scenario entity without changing base data', () => {
    const original = resolveMeituanShops()[0];
    const injected = { ...original, name: 'Scenario store', dishes: [{ ...original.dishes[0], price: 12.3 }] };
    expect(resolveMeituanShops({ rice: injected })[0]).toEqual(injected);
    expect(resolveMeituanShops()[0]).toEqual(original);
    expect(resolveMeituanShops(undefined).length).toBe(4);
  });
  it('hides tombstoned shops without changing the base catalog', () => {
    expect(resolveMeituanShops({ rice: null }).map(shop => shop.id)).toEqual(['salad', 'tea', 'market']);
    expect(resolveMeituanShops()).toHaveLength(4);
  });
  it('supports all shops hidden and ignores undefined patches', () => {
    expect(resolveMeituanShops({ rice: null, salad: null, tea: null, market: null })).toEqual([]);
    expect(resolveMeituanShops({ rice: undefined })).toEqual(resolveMeituanShops());
  });
  it('rejects mismatched overlay keys rather than displaying another identity', () => {
    expect(() => resolveMeituanShops({ rice: { ...resolveMeituanShops()[0], id: 'other' } }))
      .toThrow('identity mismatch');
  });
});
