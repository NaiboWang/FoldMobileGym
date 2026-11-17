import { describe, it, expect } from 'vitest';
import { readMeituanOrigin, readMeituanSearchOrigin } from '../apps/MeituanWaimai/searchOrigin';

const search = (origin: string) => '?' + new URLSearchParams({ origin }).toString();
describe('Meituan local search parent identity', () => {
  it('distinguishes a literal home or filtered home from a search parent', () => {
    expect(readMeituanOrigin(search('/'))).toEqual({ path: '/', kind: 'home' });
    expect(readMeituanOrigin(search('/?category=food'))).toEqual({ path: '/?category=food', kind: 'home' });
    expect(readMeituanSearchOrigin(search('/'))).toBeNull();
    expect(readMeituanOrigin(search('/?q='+encodeURIComponent('鸡')))?.kind).toBe('search');
    expect(readMeituanOrigin('?origin=%2F&origin=%2F')).toBeNull();
    expect(readMeituanOrigin(search('/?'))).toBeNull();
  });
  it('retains literal local query/category without double decoding', () => {
    const parent = '/?search=open&q=' + encodeURIComponent('A & B/%25 鸡') + '&category=food';
    expect(readMeituanSearchOrigin(search(parent))).toBe(parent);
  });
  it('rejects external, non-search, extra-key and ambiguous parents', () => {
    for (const parent of ['https://example.com/?search=open', '//example.com/?search=open', '/shop/rice',
      '/?search=closed', '/?search=open#fragment', '/?search=open&channel=waimai',
      '/?search=open&category=unknown', '/?search=open&search=open', '/?search=open&redirect=/orders']) {
      expect(readMeituanSearchOrigin(search(parent)), parent).toBeNull();
    }
    expect(readMeituanSearchOrigin('')).toBeNull();
    expect(readMeituanSearchOrigin('?source=search')).toBeNull();
  });
});
