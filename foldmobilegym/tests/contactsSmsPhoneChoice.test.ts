import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contactSmsAddress, contactSmsPhones, contactSmsPickerBackFallback } from '../system/Contacts/utils/smsPhoneChoice';
import type { ContactPhone } from '../system/Contacts/types';

const h = vi.hoisted(() => ({ location: { pathname: '/contact/c1', search: '' }, navigate: vi.fn() }));
vi.mock('react', () => ({ useContext: () => ({ navigator: {} }) }));
vi.mock('react-router-dom', () => ({ UNSAFE_NavigationContext: {}, useLocation: () => h.location,
  useNavigate: () => h.navigate, useSearchParams: () => [new URLSearchParams(h.location.search)] }));
import { useAppNavigate } from '../system/Contacts/navigation';

const phones: ContactPhone[] = [
  { id: 'work', number: '10086', label: 'Work' },
  { id: 'primary', number: '123 06', label: 'Mobile', isPrimary: true },
  { id: 'same', number: '12306', label: 'Home' },
  { id: 'empty', number: ' \n\t', label: 'Other' },
];
describe('Contacts SMS phone source projection', () => {
  it('retains exact phone objects and orders the primary before secondary', () => {
    const result = contactSmsPhones(phones); expect(result).toEqual([phones[1], phones[0]]);
    expect(result[0]).toBe(phones[1]); expect(result[1]).toBe(phones[0]);
  });
  it('does not rewrite source objects, labels, primary flags or ordering', () => {
    const before = JSON.stringify(phones); contactSmsPhones(phones); expect(JSON.stringify(phones)).toBe(before);
  });
  it('does not invent a recipient for no-phone and whitespace-only contacts', () => {
    expect(contactSmsPhones([])).toEqual([]); expect(contactSmsPhones([phones[3]])).toEqual([]);
  });
  it.each([undefined, null])('preserves the existing no-phone behavior for legacy %s fields', phones => {
    expect(contactSmsPhones(phones)).toEqual([]);
  });
  it('does not require a chooser for formatted duplicates of one address', () => {
    expect(contactSmsPhones([phones[2], phones[1]])).toEqual([phones[1]]);
  });
  it('retains input ordering without a declared primary', () => {
    expect(contactSmsPhones([phones[2], phones[0]])).toEqual([phones[2], phones[0]]);
  });
  it('does not collapse two addresses merely because phone IDs match', () => {
    const other = { ...phones[0], id: phones[1].id }; expect(contactSmsPhones([phones[1], other])).toEqual([phones[1], other]);
  });
  it('preserves the existing whitespace-only normalization contract', () => {
    expect(contactSmsAddress(' +86 123\t06 ')).toBe('+8612306'); expect(contactSmsAddress('123-06')).toBe('123-06');
  });
});

describe('Contacts SMS picker owns exactly one removable URL layer', () => {
  it('keeps cold favorite and directory query provenance', () => {
    expect(contactSmsPickerBackFallback('/contact/c1', '?fav=true&q=hello+world&modal=sms')).toBe('/contact/c1?fav=true&q=hello+world');
    expect(contactSmsPickerBackFallback('/contact/c1', '?modal=sms')).toBe('/contact/c1');
  });
  it('pops a semantically equal warm parent without changing query encoding/order', () => {
    expect(contactSmsPickerBackFallback('/contact/c1', '?fav=true&modal=sms&q=hello+world',
      { pathname: '/contact/c1', search: '?q=hello%20world&fav=true' })).toBeNull();
  });
  it.each([
    { pathname: '/contact/c2', search: '?fav=true' },
    { pathname: '/contact/c1', search: '' },
    { pathname: '/contact/c1', search: '?fav=true&modal=delete' },
    { pathname: '/contact/c1', search: '?fav=true&q=other' },
  ])('does not pop unrelated history %o', previous => {
    expect(contactSmsPickerBackFallback('/contact/c1', '?fav=true&modal=sms', previous)).toBe('/contact/c1?fav=true');
  });
  it.each(['/contact/c1/edit', '/contacts', '/'])('does not own another surface %s', pathname => {
    expect(contactSmsPickerBackFallback(pathname, '?modal=sms')).toBeNull();
  });
  it.each(['', '?modal=delete', '?menu=more', '?modal=sms&menu=more'])('does not close another layer %s', search => {
    expect(contactSmsPickerBackFallback('/contact/c1', search)).toBeNull();
  });
});

describe('Contacts SMS picker declares a real source transition', () => {
  beforeEach(() => { h.navigate.mockClear(); h.location = { pathname: '/contact/c1', search: '' }; });
  it.each(['', '?fav=true', '?fav=true&q=local'])('keeps source provenance on open %s', search => {
    h.location.search = search; useAppNavigate().go('contact.sms.picker.open', { contactId: 'c1' });
    const url = new URL(h.navigate.mock.calls[0][0], 'http://local.invalid');
    expect(url.pathname).toBe('/contact/c1'); expect(url.searchParams.get('modal')).toBe('sms');
    for (const [key, value] of new URLSearchParams(search)) expect(url.searchParams.get(key)).toBe(value);
  });
  it.each(['?menu=more', '?modal=delete', '?modal=sms'])('rejects opening beneath %s', search => {
    h.location.search = search; expect(() => useAppNavigate().go('contact.sms.picker.open', { contactId: 'c1' })).toThrow('not allowed');
    expect(h.navigate).not.toHaveBeenCalled();
  });
  it('closes cold picker to its same detail instead of a seeded Calls page', () => {
    h.location.search = '?fav=true&modal=sms'; useAppNavigate().closeSmsPicker();
    expect(h.navigate).toHaveBeenCalledWith('/contact/c1?fav=true', { replace: true });
  });
  it('does not navigate when no picker is open', () => { useAppNavigate().closeSmsPicker(); expect(h.navigate).not.toHaveBeenCalled(); });
});
