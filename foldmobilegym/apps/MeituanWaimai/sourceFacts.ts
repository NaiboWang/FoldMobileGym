import type { Dish, Shop } from './types';

/** Controller evidence of delivered menu text, not proof of reading or understanding. */
export function menuFactKey(shopId: string, dish: Dish): string | null {
  const cents = Math.round(dish.price * 100);
  if (!dish.id || !dish.name.trim() || !Number.isFinite(dish.price)
    || dish.price < 0 || !Number.isSafeInteger(cents)) return null;
  return JSON.stringify([shopId, dish.id, dish.name, cents]);
}

export function menuFactRequirements(seed: Record<string, unknown>, shops: Shop[]) {
  if (typeof seed.shop_id !== 'string' || !seed.shop_id
    || !Array.isArray(seed.dish_ids) || !seed.dish_ids.length
    || !seed.dish_ids.every(id => typeof id === 'string' && id.length > 0)
    || new Set(seed.dish_ids).size !== seed.dish_ids.length) return null;
  const shop = shops.find(item => item.id === seed.shop_id);
  if (!shop) return null;
  const keys: string[] = [];
  for (const id of seed.dish_ids) {
    const matches = shop.dishes.filter(dish => dish.id === id);
    if (matches.length !== 1) return null;
    const key = menuFactKey(shop.id, matches[0]);
    if (!key) return null;
    keys.push(key);
  }
  return { shop, keys };
}
