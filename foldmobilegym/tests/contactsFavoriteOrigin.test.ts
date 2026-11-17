import { beforeEach, describe, expect, it, vi } from 'vitest';
import { contactMenuBackFallback, contactOriginSuffix, isFavoriteContactOrigin } from '../system/Contacts/utils/detailOrigin';
import { contactsEditorBackFallback } from '../system/Contacts/utils/contactEditor';

const harness = vi.hoisted(() => ({ navigate: vi.fn(), location: { pathname: '/contacts', search: '' } }));
vi.mock('react', () => ({ useContext: () => ({ navigator: {} }) }));
vi.mock('react-router-dom', () => ({
  UNSAFE_NavigationContext: {}, useLocation: () => harness.location, useNavigate: () => harness.navigate,
  useSearchParams: () => [new URLSearchParams(harness.location.search)],
}));
import { useAppNavigate } from '../system/Contacts/navigation';

describe('Contacts recorded favorite-origin navigation', () => {
  beforeEach(() => { harness.navigate.mockClear(); harness.location = { pathname: '/contacts', search: '' }; });
  it.each(['', '?fav=other', '?fav=', '?fav=True'])('does not infer a favorites surface from %s', search => {
    expect(isFavoriteContactOrigin(search)).toBe(false); expect(contactOriginSuffix(search)).toBe('');
  });
  it('recognizes exact favorites provenance even after un-favoriting the contact', () => {
    expect(isFavoriteContactOrigin('?fav=true')).toBe(true);
    expect(contactOriginSuffix(new URLSearchParams('menu=more&fav=true'))).toBe('?fav=true');
  });
  it('uses favorites provenance only for the favorites-list entry', () => {
    harness.location.search = '?fav=true'; useAppNavigate().go('contact.open', { contactId: 'c1' });
    expect(harness.navigate).toHaveBeenLastCalledWith('/contact/c1?fav=true', undefined);
    harness.location.search = ''; useAppNavigate().go('contact.open', { contactId: 'c1' });
    expect(harness.navigate).toHaveBeenLastCalledWith('/contact/c1', undefined);
  });
  it.each([
    ['contact.menu.open', '/contact/c1', '?fav=true', '/contact/c1?fav=true&menu=more'],
    ['contact.delete.open', '/contact/c1', '?fav=true', '/contact/c1?fav=true&modal=delete'],
    ['contact.edit.open', '/contact/c1', '?fav=true', '/contact/c1/edit?fav=true'],
    ['contact.edit.open', '/contact/c1', '?fav=true&menu=more', '/contact/c1/edit?fav=true'],
    ['contact.edit.discard.open', '/contact/c1/edit', '?fav=true', '/contact/c1/edit?fav=true&modal=discard'],
    ['contact.edit.finish', '/contact/c1/edit', '?fav=true&modal=discard', '/contact/c1?fav=true'],
  ] as const)('keeps provenance through %s at %s%s', (id, pathname, search, expected) => {
    harness.location = { pathname, search }; useAppNavigate().go(id, { contactId: 'c1' });
    expect(harness.navigate.mock.calls[0][0]).toBe(expected);
  });
  it('deleting a favorite returns to the real favorites source, not all contacts', () => {
    harness.location = { pathname: '/contact/c1', search: '?fav=true&modal=delete' };
    useAppNavigate().go('contact.delete.finish');
    expect(harness.navigate).toHaveBeenCalledWith('/contacts?fav=true', { replace: true });
  });
  it('regular directory deletion retains its existing destination', () => {
    harness.location = { pathname: '/contact/c1', search: '?modal=delete' }; useAppNavigate().go('contact.delete.finish');
    expect(harness.navigate).toHaveBeenCalledWith('/contacts', { replace: true });
  });
  it('warm and cold menus keep the favorite detail parent', () => {
    expect(contactMenuBackFallback('/contact/c1', '?fav=true&menu=more', { pathname: '/contact/c1', search: '?fav=true' })).toBeNull();
    expect(contactMenuBackFallback('/contact/c1', '?fav=true&menu=more')).toBe('/contact/c1?fav=true');
    expect(contactMenuBackFallback('/contact/c1', '?fav=true&menu=more', { pathname: '/contact/c1', search: '' })).toBe('/contact/c1?fav=true');
  });
  it('does not treat a standalone detail without a menu as a fallback request', () => {
    expect(contactMenuBackFallback('/contact/c1', '?fav=true')).toBeNull();
    expect(contactMenuBackFallback('/contacts', '?fav=true&menu=more')).toBeNull();
  });
  it('preserves provenance on cold editor Back and discard Back', () => {
    expect(contactsEditorBackFallback('/contact/c1/edit', '?fav=true')).toBe('/contact/c1?fav=true');
    expect(contactsEditorBackFallback('/contact/c1/edit', '?fav=true&modal=discard')).toBe('/contact/c1/edit?fav=true');
    expect(contactsEditorBackFallback('/contact/c1/edit', '?fav=true', { pathname: '/contact/c1', search: '?fav=true' })).toBeNull();
    expect(contactsEditorBackFallback('/contact/c1/edit', '?fav=true&modal=discard', { pathname: '/contact/c1/edit', search: '?fav=true' })).toBeNull();
  });
  it.each(['', '?fav=true'])('opens a real related call from unobscured detail %s', search => {
    harness.location = { pathname: '/contact/c1', search };
    useAppNavigate().go('contact.call.open', { callLogId: 'cl_2' });
    expect(harness.navigate).toHaveBeenCalledWith('/call/cl_2', undefined);
  });
  it.each(['?modal=delete', '?menu=more', '?fav=true&modal=delete'])('rejects a call link behind detail overlay %s', search => {
    harness.location = { pathname: '/contact/c1', search };
    expect(() => useAppNavigate().go('contact.call.open', { callLogId: 'cl_2' })).toThrow('not allowed');
    expect(harness.navigate).not.toHaveBeenCalled();
  });
});
