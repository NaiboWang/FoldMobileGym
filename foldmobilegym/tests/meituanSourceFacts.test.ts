import { describe, expect, it } from 'vitest';
import { menuFactKey, menuFactRequirements } from '../apps/MeituanWaimai/sourceFacts';
import { resolveMeituanShops } from '../apps/MeituanWaimai/data';

describe('menu delivery requirements', () => {
  const shops = resolveMeituanShops();
  const seed = { shop_id: 'rice', dish_ids: ['chicken'] };
  it('requires explicit dishes rather than store opening', () => {
    expect(menuFactRequirements({ shop_id: 'rice' }, shops)).toBeNull();
    expect(menuFactRequirements({ ...seed, dish_ids: [] }, shops)).toBeNull();
  });
  it('keys the required current name and price to both identities', () => {
    const result = menuFactRequirements(seed, shops)!;
    expect(result.keys).toEqual([menuFactKey('rice', result.shop.dishes.find(d => d.id === 'chicken')!)]);
  });
  it('rejects wrong/hidden shops and unavailable dishes', () => {
    expect(menuFactRequirements({ ...seed, shop_id: 'missing' }, shops)).toBeNull();
    expect(menuFactRequirements(seed, resolveMeituanShops({ rice: null }))).toBeNull();
    expect(menuFactRequirements({ ...seed, dish_ids: ['missing'] }, shops)).toBeNull();
  });
  it('rejects malformed and ambiguous IDs', () => {
    for (const dish_ids of ['chicken', ['chicken', 'chicken'], [42], ['']]) {
      expect(menuFactRequirements({ ...seed, dish_ids }, shops)).toBeNull();
    }
    const rice = shops.find(shop => shop.id === 'rice')!;
    expect(menuFactRequirements(seed, [{ ...rice, dishes: [rice.dishes[0], rice.dishes[0]] }])).toBeNull();
  });
  it('rejects nonfinite/negative/unsafe prices and unnamed facts', () => {
    const dish = shops[0].dishes[0];
    for (const price of [NaN, Infinity, -1, Number.MAX_SAFE_INTEGER]) {
      expect(menuFactKey('rice', { ...dish, price })).toBeNull();
    }
    expect(menuFactKey('rice', { ...dish, name: ' ' })).toBeNull();
  });
  it('does not reuse a different store, name or price', () => {
    const dish = shops[0].dishes[0];
    const key = menuFactKey('rice', dish);
    expect(menuFactKey('tea', dish)).not.toBe(key);
    expect(menuFactKey('rice', { ...dish, name: 'Changed' })).not.toBe(key);
    expect(menuFactKey('rice', { ...dish, price: dish.price + 1 })).not.toBe(key);
  });
});
