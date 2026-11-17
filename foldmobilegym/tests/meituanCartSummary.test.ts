import { describe, expect, it } from 'vitest';
import { summarizeMeituanCart } from '../apps/MeituanWaimai/cartSummary';
import { resolveMeituanShops } from '../apps/MeituanWaimai/data';

describe('Meituan shared cart summary', () => {
  const shops = resolveMeituanShops();
  it('resolves names, quantities and exact subtotal cents', () => {
    const summary = summarizeMeituanCart({ shopId: 'rice', quantities: { chicken: 2, beef: 1 } }, shops);
    expect(summary.valid).toBe(true);
    expect(summary.quantity).toBe(3);
    expect(summary.subtotalCents).toBe(7940);
    expect(summary.items.map(item => [item.dishId, item.unitPriceCents, item.subtotalCents]))
      .toEqual([['chicken', 2480, 4960], ['beef', 2980, 2980]]);
  });
  it('rejects unknown items instead of ignoring them in totals', () => {
    expect(summarizeMeituanCart({ shopId: 'missing', quantities: {} }, shops).valid).toBe(false);
    const summary = summarizeMeituanCart({ shopId: 'rice', quantities: { chicken: 1, missing: 1 } }, shops);
    expect(summary.valid).toBe(false);
    expect(summary.subtotalCents).toBeNull();
  });
  it('rejects invalid quantities and unsafe totals', () => {
    for (const quantity of [0, -1, NaN, Infinity, 0.5, Number.MAX_SAFE_INTEGER]) {
      const summary = summarizeMeituanCart({ shopId: 'rice', quantities: { chicken: quantity } }, shops);
      expect(summary.valid).toBe(false);
      expect(summary.subtotalCents).toBeNull();
    }
  });
  it('uses the scenario catalog while preserving store-scoped identity', () => {
    const injected = resolveMeituanShops({ rice: { ...shops[0], dishes: [{ ...shops[0].dishes[0], price: 12.3 }] } });
    expect(summarizeMeituanCart({ shopId: 'rice', quantities: { chicken: 2 } }, injected).subtotalCents).toBe(2460);
    expect(summarizeMeituanCart({ shopId: 'rice', quantities: { yogurt: 1 } }, shops).valid).toBe(false);
    expect(summarizeMeituanCart({ shopId: 'tea', quantities: { yogurt: 1 } }, shops).valid).toBe(true);
  });
});
