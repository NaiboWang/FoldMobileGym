import { describe, expect, it } from 'vitest';
import { smsComposeParent, smsComposeBackFallback } from '../system/Sms/composeOverlay';
describe('SMS context-menu layer Back', () => {
  it.each([
    ['/', '?contextMenu=source', '/'],
    ['/new', '?address=2025550199&body=hello&contextMenu=source', '/new?address=2025550199&body=hello'],
    ['/new', '?panel=attachments&contextMenu=source', '/new?panel=attachments'],
    ['/conversation/source', '?contextMenu=other', '/conversation/source'],
    ['/conversation/source', '?panel=attachments&contextMenu=other', '/conversation/source?panel=attachments'],
  ])('removes only the menu at %s%s', (pathname, search, parent) => {
    expect(smsComposeParent(pathname, search)).toBe(parent);
    expect(smsComposeBackFallback(pathname, search)).toBe(parent);
  });
  it('pops a real exact parent, including differently ordered query parameters', () => {
    expect(smsComposeBackFallback('/', '?contextMenu=source', {pathname:'/',search:''})).toBeNull();
    expect(smsComposeBackFallback('/new', '?address=2025550199&body=hello&contextMenu=source', {pathname:'/new',search:'?body=hello&address=2025550199'})).toBeNull();
  });
  it('does not pop a different recipient, source route or another open menu', () => {
    expect(smsComposeBackFallback('/new', '?address=2025550199&contextMenu=source', {pathname:'/new',search:'?address=2025550101'})).toBe('/new?address=2025550199');
    expect(smsComposeBackFallback('/conversation/source', '?contextMenu=source', {pathname:'/conversation/other',search:''})).toBe('/conversation/source');
    expect(smsComposeBackFallback('/', '?contextMenu=source', {pathname:'/',search:'?contextMenu=other'})).toBe('/');
  });
  it('does not intercept an ordinary list or an unrelated route', () => {
    expect(smsComposeParent('/', '')).toBeNull();
    expect(smsComposeParent('/settings', '?contextMenu=source')).toBeNull();
  });
});
