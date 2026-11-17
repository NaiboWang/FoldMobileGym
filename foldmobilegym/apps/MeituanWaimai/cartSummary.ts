import type { Shop } from './types';

export interface CartSummary {
  valid: boolean;
  shopId: string;
  shopName: string;
  quantity: number;
  subtotalCents: number | null;
  items: Array<{ dishId: string; name: string; quantity: number; unitPriceCents: number; subtotalCents: number }>;
}

// Shared display/judge projection. Derived values are never written back to
// persistence, and unknown items cannot silently disappear from judgment.
export function summarizeMeituanCart(cart: { shopId: string; quantities: Record<string, number> }, shops: Shop[]): CartSummary {
  const shop = shops.find(entry => entry.id === cart.shopId);
  const result: CartSummary = { valid: Boolean(shop), shopId: cart.shopId,
    shopName: shop?.name || '', quantity: 0, subtotalCents: 0, items: [] };
  const dishes = new Map(shop?.dishes.map(dish => [dish.id, dish]) || []);
  if (shop && dishes.size !== shop.dishes.length) result.valid = false;
  for (const [dishId, quantity] of Object.entries(cart.quantities)) {
    const dish = dishes.get(dishId);
    const cents = dish ? Math.round(dish.price * 100) : NaN;
    if (!dish || !Number.isSafeInteger(quantity) || quantity <= 0 ||
      !Number.isFinite(dish.price) || dish.price < 0 || !Number.isSafeInteger(cents) ||
      !Number.isSafeInteger(cents * quantity) ||
      !Number.isSafeInteger(result.quantity + quantity) ||
      !Number.isSafeInteger((result.subtotalCents ?? 0) + cents * quantity)) {
      result.valid = false;
      continue;
    }
    const subtotalCents = cents * quantity;
    result.items.push({ dishId, name: dish.name, quantity, unitPriceCents: cents, subtotalCents });
    result.quantity += quantity;
    result.subtotalCents = (result.subtotalCents ?? 0) + subtotalCents;
  }
  if (!result.valid) result.subtotalCents = null;
  return result;
}
