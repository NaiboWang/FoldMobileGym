import { describe, expect, it } from 'vitest';
import { contactEmailIntent } from '../system/Contacts/utils/contactEmailIntent';
import type { Contact } from '../system/Contacts/types';

const contact: Contact = {
  id: 'contact-1', displayName: 'Local Contact', phones: [],
  emails: [{ id: 'work', label: 'Work', email: 'person@example.invalid' }],
};

describe('contact email intent identity', () => {
  it('creates a mailto intent only for the exact current row', () => {
    const email = contact.emails![0];
    expect(contactEmailIntent(contact, email, email.id, email.email)).toEqual({ action: 'ACTION_VIEW', scheme: 'mailto', data: { address: email.email } });
    expect(contactEmailIntent(contact, { ...email }, email.id, email.email)).toBeNull();
    expect(contactEmailIntent(contact, email, email.id, 'other@example.invalid')).toBeNull();
  });

  it.each(['', 'person@invalid', 'person@example.invalid\nBcc:other@example.invalid'])('rejects invalid or injected address %s', address => {
    const email = { ...contact.emails![0], email: address };
    expect(contactEmailIntent({ ...contact, emails: [email] }, email, email.id, address)).toBeNull();
  });
});
