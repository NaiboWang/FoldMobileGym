import { describe, expect, it } from 'vitest';
import { NAVIGATION_DECLARATION } from '../system/Contacts/navigation.declaration';

describe('Contacts recorded master/detail surface', () => {
  it('allows the visible detail edit control from both base and menu states', () => {
    const transition = NAVIGATION_DECLARATION.transitions.find(item => item.id === 'contact.edit.open')!;
    expect(transition.from).toEqual([
      { path: '/contact/:contactId', search: { modal: null, menu: null } },
      { path: '/contact/:contactId', search: { modal: null, menu: 'more' } },
    ]);
  });

  it('keeps the contact detail route as a declared directory/detail surface', () => {
    const route = NAVIGATION_DECLARATION.routes.find(item => item.path === '/contact/:contactId')!;
    expect(route.scrollContainers.map(item => item.name)).toContain('directory');
    expect(route.uiStates.map(item => item.id)).toContain('contactDetail.base');
    expect(route.queryParams).toEqual({ q: 'string', fav: 'string' });
  });
});
