import { describe, it, expect } from 'vitest';
import { meituanLocalImage, meituanMenuGroups } from '../apps/MeituanWaimai/menuModel';
import { readShopRouteSection } from '../apps/MeituanWaimai/routeIdentity';
import type { Shop } from '../apps/MeituanWaimai/types';
const shop = (): Shop => ({ id: 'source', name: 'Source', rating: '4', sales: '1', time: '20', category: 'food', categoryId: 'food', dishes: [
  { id: 'a', name: 'A', price: 7.35, note: '', emoji: '🍱', categoryId: 'meal/a %' },
  { id: 'b', name: 'B', price: 12, note: '', emoji: '🧋', categoryId: 'drink' },
] });
describe('Source-backed Meituan menu projection', () => {
  it('keeps legacy menus complete without inventing categories or changing source data', () => {
    const original = shop(), before = structuredClone(original), groups = meituanMenuGroups(original)!;
    expect(groups).toEqual([{ id: 'all', name: null, dishes: original.dishes }]);
    expect(groups[0].dishes).toBe(original.dishes); expect(original).toEqual(before);
  });
  it('keeps exact configured order, names, dish identity and prices', () => {
    const original = shop(); original.menuCategories = [{ id: 'drink', name: '饮品' }, { id: 'meal/a %', name: '主食' }];
    const groups = meituanMenuGroups(original)!;
    expect(groups.map(g => [g.id, g.name])).toEqual([['drink', '饮品'], ['meal/a %', '主食']]);
    expect(groups[1].dishes[0]).toBe(original.dishes[0]); expect(groups[1].dishes[0].price).toBe(7.35);
  });
  it('retains unassigned items in an honest collision-free remainder', () => {
    const original = shop(); original.menuCategories = [{ id: 'uncategorized', name: 'Existing' }];
    const groups = meituanMenuGroups(original)!;
    expect(groups[1].id).toBe('uncategorized_'); expect(groups[1].unclassified).toBe(true);
    expect(groups[1].dishes).toEqual(original.dishes);
  });
  it('rejects duplicate category and dish identities', () => {
    const original = shop(); original.menuCategories = [{ id: 'x', name: 'X' }, { id: 'x', name: 'Y' }];
    expect(meituanMenuGroups(original)).toBeNull(); delete original.menuCategories;
    original.dishes[1].id = 'a'; expect(meituanMenuGroups(original)).toBeNull();
  });
  it('rejects malformed metadata without inventing a valid category', () => {
    const original = shop(); original.menuCategories = [{ id: '', name: 'X' }];
    expect(meituanMenuGroups(original)).toBeNull();
    original.menuCategories = [{ id: 'x', name: '  ' }]; expect(meituanMenuGroups(original)).toBeNull();
    original.menuCategories = {} as never; expect(meituanMenuGroups(original)).toBeNull();
  });
  it('reports a malformed source row rather than crashing or substituting a dish', () => {
    const original = shop(); original.dishes = [null as never];
    expect(meituanMenuGroups(original)).toBeNull();
  });
});
describe('Local merchant media references', () => {
  const origin = 'http://127.0.0.1:3188';
  it('accepts current-origin delivered resource paths', () => {
    for (const path of ['/assets/source.png', '/cdn/source.jpg', '/@app-assets/source.webp', '/apps/MeituanWaimai/res/chicken-bowl.png']) {
      expect(meituanLocalImage(path, origin)).toBe(origin + path);
    }
  });
  it('rejects another host, a missing value and unrelated delivery paths without making requests', () => {
    for (const value of ['https://example.invalid/cover.jpg', 'http://localhost:9999/assets/a.png', '/not-media/example', '', null]) {
      expect(meituanLocalImage(value, origin)).toBeUndefined();
    }
  });
});
describe('Merchant section identity', () => {
  it('distinguishes a shop named info/reviews from its actual section', () => {
    expect(readShopRouteSection('/shop/info')).toBe('menu'); expect(readShopRouteSection('/shop/reviews')).toBe('menu');
    expect(readShopRouteSection('/shop/info/reviews')).toBe('reviews'); expect(readShopRouteSection('/shop/reviews/info')).toBe('info');
    expect(readShopRouteSection('/shop/a/other')).toBeNull(); expect(readShopRouteSection('/shop/%bad')).toBeNull();
  });
});
