import { describe, expect, it } from 'vitest';
import { NAVIGATION_DECLARATION } from '../system/Sms/navigation.declaration';
import { smsContactOptions, filterSmsContactOptions } from '../system/Sms/contactOptions';
import type { Contact } from '../system/Contacts/types';
const fixture = (patch: Partial<Contact>): Contact => ({ id: 'contact-a', displayName: 'Review contact', phones: [], ...patch });
describe('SMS contact number options', () => {
  it('offers each distinct number instead of only the first', () => {
    expect(smsContactOptions([fixture({ phones: [
      { id: 'p1', label: 'Mobile', number: '123 06' }, { id: 'p2', label: 'Work', number: '10086' },
      { id: 'p3', label: 'Duplicate', number: '12306' }, { id: 'p4', label: 'Empty', number: ' ' },
    ] })]).map(option => option.phoneNumber)).toEqual(['12306', '10086']);
  });
  it('keeps different contacts with a shared phone number distinct', () => {
    const contacts = [fixture({ phones: [{ id: 'p', label: '', number: '12306' }] }), fixture({ id: 'contact-b', phones: [{ id: 'p', label: '', number: '12306' }] })];
    const options = smsContactOptions(contacts);
    expect(options).toHaveLength(2); expect(new Set(options.map(option => option.key)).size).toBe(2);
  });
  it('does not fabricate phone data for an empty or unnamed contact', () => {
    expect(smsContactOptions([fixture({}), fixture({ displayName: ' ', phones: [{ id: 'p', label: '', number: '12306' }] })])).toEqual([]);
  });
  it('matches a secondary number and a case-insensitive literal name', () => {
    const options = smsContactOptions([fixture({ displayName: 'Review [A]', phones: [{ id: 'p', label: '', number: '+86 13800000000' }] })]);
    expect(filterSmsContactOptions(options, '[a]')).toHaveLength(1);
    expect(filterSmsContactOptions(options, '138 000')).toHaveLength(1);
    expect(filterSmsContactOptions(options, 'not found')).toHaveLength(0);
  });
});
describe('SMS compose overlay navigation', () => {
  const route = NAVIGATION_DECLARATION.routes.find(route => route.path === '/new')!;
  it('declares all supported panel/error combinations and deep-link seeds', () => {
    expect(route.uiStates.map(state => state.search)).toEqual([{}, { panel: 'contacts' }, { panel: 'attachments' }, { dialog: 'invalidRecipient' }, { panel: 'attachments', dialog: 'invalidRecipient' }]);
    expect(route.queryParams).toEqual({ address: 'string', body: 'string' });
  });
  it('pushes overlays while preserving the original draft request', () => {
    for (const id of ['compose.contacts.open', 'compose.attachments.open', 'compose.invalidRecipient.open']) {
      expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === id)).toMatchObject({ mode: 'push', to: '/new', preserveParams: expect.arrayContaining(['address', 'body']) });
    }
  });
  it('retains the attachment panel beneath the recipient error', () => {
    expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === 'compose.invalidRecipient.open')).toMatchObject({
      preserveParams: ['panel', 'address', 'body'], search: { dialog: 'invalidRecipient' },
    });
  });
});
