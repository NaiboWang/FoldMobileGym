import { describe, expect, it } from 'vitest';
import { NAVIGATION_DECLARATION } from '../system/Contacts/navigation.declaration';
describe('Contact to dialpad navigation', () => {
  it('pushes the actual selected number and preserves a return to detail', () => {
    expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === 'contact.dial.open')).toMatchObject({
      from: { path: '/contact/:contactId', search: { modal: null } }, to: '/', search: { dialpad: 'true' },
      searchParams: { number: 'string' }, mode: 'push',
    });
  });
  it('declares the number seed and separate panel scroll surface', () => {
    const route = NAVIGATION_DECLARATION.routes.find(r => r.path === '/')!;
    expect(route.queryParams).toEqual({ number: 'string' });
    expect(route.scrollContainers.map(c => c.name)).toEqual(['main', 'dialpad']);
    const state = route.uiStates.find(state => state.id === 'calls.dialpad')!;
    expect('actions' in state && state.actions.map(action => action.id)).toEqual(['contacts.dialpad.digit.append', 'contacts.dialpad.digit.remove', 'contacts.dialpad.sms.open']);
  });
  it.each(['tab.contacts', 'tab.favorites', 'search.open', 'call.open', 'settings.open.calls'])('excludes the obscured calls page from %s', id => {
    const from = NAVIGATION_DECLARATION.transitions.find(t => t.id === id)!.from;
    const sources = Array.isArray(from) ? from : [from];
    expect(sources).toContainEqual({ path: '/', search: { dialpad: null } });
    expect(sources).not.toContain('/');
  });
});
