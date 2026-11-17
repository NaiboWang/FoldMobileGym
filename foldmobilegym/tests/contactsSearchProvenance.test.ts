import { describe, expect, it } from 'vitest';
import { NAVIGATION_DECLARATION } from '../system/Contacts/navigation.declaration';
import { contactMenuBackFallback, contactOriginSuffix } from '../system/Contacts/utils/detailOrigin';
import { contactsEditorBackFallback } from '../system/Contacts/utils/contactEditor';

describe('contact directory search provenance', () => {
  it('retains q in all detail, menu and editor transitions', () => {
    for (const id of ['contact.switch', 'contact.delete.open', 'contact.menu.open', 'contact.edit.open', 'contact.edit.finish', 'contact.edit.discard.open']) {
      expect(NAVIGATION_DECLARATION.transitions.find(item => item.id === id)?.preserveParams, id).toContain('q');
    }
  });
  it('only retains favorite origin and search query in detail suffix', () => {
    expect(contactOriginSuffix('?q=A%26B&fav=true&menu=more')).toBe('?fav=true&q=A%26B');
    expect(contactOriginSuffix('?q=')).toBe('?q=');
    expect(contactOriginSuffix('?modal=qr')).toBe('');
  });
  it('matches the exact parent query for warm and cold menus', () => {
    const s = '?fav=true&q=Alice&menu=more';
    expect(contactMenuBackFallback('/contact/a', s, { pathname: '/contact/a', search: '?q=Alice&fav=true' })).toBeNull();
    expect(contactMenuBackFallback('/contact/a', s, { pathname: '/contact/a', search: '?fav=true&q=Bob' })).toBe('/contact/a?fav=true&q=Alice');
    expect(contactMenuBackFallback('/contact/a', s)).toBe('/contact/a?fav=true&q=Alice');
  });
  it('returns to the exact detail or editor for cold edit/discard routes', () => {
    expect(contactsEditorBackFallback('/contact/a/edit', '?q=Alice')).toBe('/contact/a?q=Alice');
    expect(contactsEditorBackFallback('/contact/a/edit', '?q=Alice&modal=discard')).toBe('/contact/a/edit?q=Alice');
    expect(contactsEditorBackFallback('/contact/a/edit', '?q=Alice', { pathname: '/contact/a', search: '?q=Bob' })).toBe('/contact/a?q=Alice');
    expect(contactsEditorBackFallback('/contact/a/edit', '?q=Alice', { pathname: '/contact/a', search: '?q=Alice' })).toBeNull();
  });
});
