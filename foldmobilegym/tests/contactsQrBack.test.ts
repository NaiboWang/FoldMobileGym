import { describe, expect, it } from 'vitest';
import { contactQrBackFallback } from '../system/Contacts/utils/qrBack';
import { NAVIGATION_DECLARATION } from '../system/Contacts/navigation.declaration';

describe('contact QR back ownership', () => {
  it('keeps the directory query when opening QR', () => {
    const open = NAVIGATION_DECLARATION.transitions.find(transition => transition.id === 'contact.qr.open');
    expect(open?.preserveParams).toContain('q');
  });
  it('returns a cold QR to its own detail and preserves source parameters', () => {
    expect(contactQrBackFallback('/contact/a', '?fav=1&q=Alice&modal=qr')).toBe('/contact/a?fav=1&q=Alice');
  });
  it('pops only an exact matching parent regardless of query ordering', () => {
    expect(contactQrBackFallback('/contact/a', '?fav=1&q=Alice&modal=qr', { pathname: '/contact/a', search: '?q=Alice&fav=1' })).toBeNull();
    expect(contactQrBackFallback('/contact/a', '?modal=qr', { pathname: '/contact/b', search: '' })).toBe('/contact/a');
    expect(contactQrBackFallback('/contact/a', '?fav=1&modal=qr', { pathname: '/contact/a', search: '' })).toBe('/contact/a?fav=1');
  });
  it('does not claim other routes or layered menus', () => {
    expect(contactQrBackFallback('/contact/a', '?modal=sms')).toBeNull();
    expect(contactQrBackFallback('/contact/a', '?modal=qr&menu=more')).toBeNull();
    expect(contactQrBackFallback('/contacts', '?modal=qr')).toBeNull();
  });
});
