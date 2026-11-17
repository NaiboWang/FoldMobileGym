import type { Dish, Shop } from './types';

export interface MeituanMenuGroup { id: string; name: string | null; dishes: Dish[]; unclassified?: boolean }

/** Categories are supplied source metadata; never guess them from a dish name. */
export function meituanMenuGroups(shop: Shop): MeituanMenuGroup[] | null {
  if (!Array.isArray(shop.dishes) || shop.dishes.some(d => !d || typeof d.id !== 'string' || !d.id)
    || new Set(shop.dishes.map(d => d.id)).size !== shop.dishes.length) return null;
  if (shop.menuCategories !== undefined && !Array.isArray(shop.menuCategories)) return null;
  if (!shop.menuCategories?.length) return [{ id: 'all', name: null, dishes: shop.dishes }];
  const ids = new Set<string>();
  for (const category of shop.menuCategories) {
    if (!category || typeof category.id !== 'string' || !category.id || ids.has(category.id)
      || typeof category.name !== 'string' || !category.name.trim()) return null;
    ids.add(category.id);
  }
  const groups: MeituanMenuGroup[] = shop.menuCategories.map(c => ({ id: c.id, name: c.name,
    dishes: shop.dishes.filter(d => d.categoryId === c.id) }));
  const remaining = shop.dishes.filter(d => !d.categoryId || !ids.has(d.categoryId));
  if (remaining.length) {
    let id = 'uncategorized';
    while (ids.has(id)) id += '_';
    groups.push({ id, name: null, dishes: remaining, unclassified: true });
  }
  return groups;
}

/** Merchant media may use the current local simulator delivery, never a remote redirect. */
export function meituanLocalImage(value: unknown, origin: string): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  try {
    const url = new URL(value, origin);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin || url.username || url.password
      || !/^\/(?:cdn|assets|@app-assets|apps\/MeituanWaimai\/res)\//.test(url.pathname)) return undefined;
    return url.href;
  } catch { return undefined; }
}
