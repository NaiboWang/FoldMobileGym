import { describe, expect, it } from 'vitest';
import { readShopRouteId } from '../apps/MeituanWaimai/routeIdentity';

describe('Meituan shop route identity', () => {
  it('reads menu, reviews and info without confusing route suffixes with IDs', () => {
    for (const suffix of ['', '/reviews', '/info']) expect(readShopRouteId(`/shop/rice${suffix}`)).toBe('rice');
  });
  it('decodes an encoded identity exactly once', () => {
    const id = '测试 店/one';
    expect(readShopRouteId(`/shop/${encodeURIComponent(id)}`)).toBe(id);
    expect(readShopRouteId('/shop/%252F')).toBe('%2F');
  });
  it('rejects missing, malformed and unsupported routes', () => {
    for (const route of ['/cart', '/shop/', '/shop/%XX', '/shop/rice/other', '/shop/rice/extra/info']) {
      expect(readShopRouteId(route)).toBeNull();
    }
  });
});
