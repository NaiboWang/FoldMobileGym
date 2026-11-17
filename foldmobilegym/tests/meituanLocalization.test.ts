import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { strings } from '../apps/MeituanWaimai/res/strings';
import { stringsEn } from '../apps/MeituanWaimai/res/strings.en';

describe('Meituan localized interface resources', () => {
  it('provides a nonempty English entry for every resource key', () => {
    expect(Object.keys(stringsEn).sort()).toEqual(Object.keys(strings).sort());
    expect(Object.values(stringsEn).every(value => value.trim().length > 0)).toBe(true);
  });
  it('localizes the home, menu and cart chrome', () => {
    for (const key of ['location', 'address', 'search', 'promo', 'promoDetail', 'promoTitleLineOne',
      'promoTitleLineTwo', 'recommended', 'food', 'drinks', 'nearby', 'freeDelivery', 'clear', 'cart'] as const) {
      expect(stringsEn[key]).not.toBe(strings[key]);
    }
  });
  it('does not bypass the locale resolver or retain the hardcoded hero/menu headings', () => {
    const source = readFileSync(new URL('../apps/MeituanWaimai/MeituanWaimaiApp.tsx', import.meta.url), 'utf8');
    expect(source).not.toMatch(/\{s\./);
    expect(source).not.toContain('想吃什么，<br/>现在就点');
    expect(source).not.toContain('<h2>热销推荐</h2>');
  });
  it('has singular item units and does not round order cards to tenths', () => {
    expect(stringsEn.item).toBe('item');
    expect(stringsEn.orderItem).toBe('item');
    const source = readFileSync(new URL('../apps/MeituanWaimai/MeituanWaimaiApp.tsx', import.meta.url), 'utf8');
    expect(source).not.toContain('order.total.toFixed(1)');
    expect(source).toContain('order.total.toFixed(2)');
  });
});
