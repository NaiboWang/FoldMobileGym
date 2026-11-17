import { describe, expect, it } from 'vitest';
import { smsComposeBackFallback, smsComposeParent } from '../system/Sms/composeOverlay';

describe('SMS compose navigation after cold entry or Activity recreation', () => {
  it.each(['contacts', 'attachments'])('closes cold %s without leaving the draft', panel => {
    expect(smsComposeBackFallback('/new', `?panel=${panel}`, { pathname: '/', search: '' })).toBe('/new');
    expect(smsComposeBackFallback('/new', `?panel=${panel}`)).toBe('/new');
  });
  it('pops a real parent and preserves attachment-to-contacts history', () => {
    expect(smsComposeBackFallback('/new', '?panel=contacts', { pathname: '/new', search: '' })).toBeNull();
    expect(smsComposeBackFallback('/new', '?panel=contacts', { pathname: '/new', search: '?panel=attachments' })).toBeNull();
    expect(smsComposeBackFallback('/new', '?panel=attachments', { pathname: '/new', search: '' })).toBeNull();
  });
  it('closes only the top invalid-recipient dialog, retaining underlying attachments', () => {
    expect(smsComposeParent('/new', '?panel=attachments&dialog=invalidRecipient')).toBe('/new?panel=attachments');
    expect(smsComposeBackFallback('/new', '?panel=attachments&dialog=invalidRecipient',
      { pathname: '/new', search: '?panel=attachments' })).toBeNull();
    expect(smsComposeBackFallback('/new', '?dialog=invalidRecipient')).toBe('/new');
  });
  it('preserves incoming address and body, including encoded query characters', () => {
    const search = new URLSearchParams({ address: '+86 13900007312', body: 'a&b?c', panel: 'contacts' });
    const fallback = smsComposeBackFallback('/new', `?${search}`)!;
    const params = new URLSearchParams(fallback.slice(fallback.indexOf('?')));
    expect(params.get('address')).toBe('+86 13900007312');
    expect(params.get('body')).toBe('a&b?c');
    expect(params.has('panel')).toBe(false);
  });
  it('does not pop into another compose identity or an unrelated overlay', () => {
    expect(smsComposeBackFallback('/new', '?address=13900007312&panel=contacts',
      { pathname: '/new', search: '?address=13900001111' })).toBe('/new?address=13900007312');
    expect(smsComposeBackFallback('/new', '?panel=attachments',
      { pathname: '/new', search: '?panel=contacts' })).toBe('/new');
  });
  it('recognizes the same real parent regardless of query ordering', () => {
    expect(smsComposeBackFallback('/new', '?address=13900007312&body=hello&panel=contacts',
      { pathname: '/new', search: '?body=hello&address=13900007312' })).toBeNull();
  });
  it.each([['/new', ''], ['/new', '?panel=unknown'], ['/', '?panel=contacts']])(
    'does not intercept normal navigation at %s%s', (pathname, search) => {
      expect(smsComposeParent(pathname, search)).toBeNull();
      expect(smsComposeBackFallback(pathname, search)).toBeNull();
    });
});
