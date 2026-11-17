import { describe, expect, it } from 'vitest';
import { dialIntentRoute } from '../system/Contacts/utils/dialIntentRoute';
describe('Phone dial-entry payload isolation', () => {
  it('encodes a number without losing +, #, * or leading zeroes', () => {
    const route = dialIntentRoute('/?dialpad=true', { action: 'ACTION_VIEW', scheme: 'tel', data: { number: '+86 00123*#' } });
    expect(new URLSearchParams(route.split('?')[1]).get('number')).toBe('+8600123*#');
  });
  it('accepts an explicit ACTION_DIAL address alias', () => {
    expect(new URLSearchParams(dialIntentRoute('/?dialpad=true', { action: 'ACTION_DIAL', data: { address: '100 86' } }).split('?')[1]).get('number')).toBe('10086');
  });
  it('retains an explicitly empty or nonempty route seed', () => {
    for (const seed of ['', '00123']) {
      const route = '/?dialpad=true&number=' + seed;
      expect(dialIntentRoute(route, { action: 'ACTION_DIAL', data: { number: '999' } })).toBe(route);
    }
  });
  it('does not reuse a stale intent for ordinary opening or another detail', () => {
    const intent = { action: 'ACTION_VIEW', scheme: 'tel', data: { number: '999' } };
    expect(dialIntentRoute('/', intent)).toBe('/');
    expect(dialIntentRoute('/contact/example', intent)).toBe('/contact/example');
  });
  it('does not infer a number from a name or coerce an invalid payload', () => {
    for (const data of [{ displayName: 'Review' }, { number: 12306 }, {}, { number: ' ' }]) {
      expect(dialIntentRoute('/?dialpad=true', { action: 'ACTION_DIAL', data })).toBe('/?dialpad=true');
    }
  });
  it('ignores unrelated actions and schemes', () => {
    expect(dialIntentRoute('/?dialpad=true', { action: 'ACTION_SEND', data: { number: '123' } })).toBe('/?dialpad=true');
    expect(dialIntentRoute('/?dialpad=true', { action: 'ACTION_VIEW', scheme: 'sms', data: { number: '123' } })).toBe('/?dialpad=true');
  });
});
