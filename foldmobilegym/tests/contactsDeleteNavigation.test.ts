import { describe, expect, it } from 'vitest';
import { NAVIGATION_DECLARATION } from '../system/Contacts/navigation.declaration';

describe('Contacts deletion confirmation navigation', () => {
  const route = NAVIGATION_DECLARATION.routes.find(route => route.path === '/contact/:contactId')!;
  it('declares a distinct URL confirmation and a typed target for submit', () => {
    const modal = route.uiStates.find(state => state.id === 'contactDetail.delete')!;
    expect(modal.search).toEqual({ modal: 'delete' });
    expect('actions' in modal && modal.actions[0]).toMatchObject({
      id: 'contacts.contact.delete.submit', behavior: 'submit', scope: 'item', paramsSchema: { contactId: 'string' },
    });
  });
  it('pushes the confirmation only from an unobscured contact', () => {
    expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === 'contact.delete.open')).toMatchObject({
      from: { path: '/contact/:contactId', search: { modal: null, menu: null } },
      to: '/contact/:contactId', params: { contactId: 'string' }, search: { modal: 'delete' }, mode: 'push',
    });
  });
  it('does not declare contact switching while deletion confirmation is open', () => {
    expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === 'contact.switch')?.from)
      .toEqual({ path: '/contact/:contactId', search: { modal: null, menu: null } });
  });
  it('returns to a live list after confirmed deletion and names the modal scroller', () => {
    expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === 'contact.delete.finish')).toMatchObject({
      from: { path: '/contact/:contactId', search: { modal: 'delete' } }, to: '/contacts', search: {}, mode: 'replace',
    });
    expect(route.scrollContainers.map(scroll => scroll.name)).toEqual(['main', 'directory', 'confirmation', 'menu', 'smsNumbers']);
  });
});
