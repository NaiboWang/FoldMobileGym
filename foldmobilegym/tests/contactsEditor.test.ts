import { describe, expect, it } from 'vitest';
import type { Contact } from '../system/Contacts/types';
import { contactDraft, contactDraftDirty, contactDraftPatch, contactDraftWithDialedNumber, contactsEditorBackFallback, nextContactFieldId } from '../system/Contacts/utils/contactEditor';
import { NAVIGATION_DECLARATION } from '../system/Contacts/navigation.declaration';

const contact: Contact = { id: 'source', displayName: ' Original ', company: ' Company ', title: ' Role ', notes: ' untouched\n',
  phones: [{ id: 'personal', label: 'custom phone', number: '+1 202 555 0100', isPrimary: true }, { id: 'p2', label: 'work', number: '2025550101' }],
  emails: [{ id: 'customEmail', label: 'Personal', email: 'original@example.test' }], starred: true, avatarUri: '/own-avatar', avatarColor: '#abc',
  createdAt: 10, updatedAt: 20, lastContactedAt: 15, sectionKey: 'O', sortKey: 'original',
};

describe('Contact editor source-preserving draft', () => {
  it('owns independent rows and does not mutate the provider before save', () => {
    const draft = contactDraft(contact); draft.phones[0].number = 'changed'; draft.emails[0].email = 'changed';
    expect(contact.phones[0].number).toBe('+1 202 555 0100'); expect(contact.emails?.[0].email).toBe('original@example.test');
  });
  it('emits no patch for pristine sources, retaining every optional/whitespace field exactly', () => {
    expect(contactDraftPatch(contactDraft(contact), contact)).toEqual({});
    expect(contactDraftDirty(contactDraft(contact), contactDraft(contact))).toBe(false);
  });
  it.each(['displayName', 'company', 'title', 'notes'] as const)('edits only %s', field => {
    const draft = contactDraft(contact); draft[field] = '  Updated value  ';
    expect(contactDraftPatch(draft, contact)).toEqual({ [field]: 'Updated value' });
  });
  it('allows explicitly clearing optional text without resetting identity or account metadata', () => {
    const draft = contactDraft(contact); draft.company = ''; draft.notes = '  ';
    expect(contactDraftPatch(draft, contact)).toEqual({ company: undefined, notes: undefined });
  });
  it('preserves a missing emails field and empty phone source on unrelated edits', () => {
    const source = { ...contact, phones: [], emails: undefined };
    const draft = contactDraft(source); draft.title = 'New title';
    expect(contactDraftPatch(draft, source)).toEqual({ title: 'New title' });
  });
  it('keeps each actual phone id, label and primary flag when changing one number', () => {
    const draft = contactDraft(contact); draft.phones[1].number = '  5550102  ';
    expect(contactDraftPatch(draft, contact)).toEqual({ phones: [contact.phones[0], { ...contact.phones[1], number: '5550102' }] });
  });
  it('can remove all phones and emails without inventing replacement records', () => {
    const draft = contactDraft(contact); draft.phones = []; draft.emails = [];
    expect(contactDraftPatch(draft, contact)).toEqual({ phones: [], emails: [] });
  });
  it('filters blank new rows and allocates stable noncolliding ids', () => {
    expect(nextContactFieldId('p', [{ id: 'p1' }, { id: 'p3' }])).toBe('p2');
    expect(nextContactFieldId('e', [{ id: 'e1' }, { id: 'e2' }])).toBe('e3');
    const draft = contactDraft(); draft.displayName = '  New contact  ';
    expect(contactDraftPatch(draft)).toMatchObject({ displayName: 'New contact', phones: [], emails: [] });
  });
  it('detects changes and reverts to pristine when exact draft values are restored', () => {
    const initial = contactDraft(contact), draft = contactDraft(contact); draft.notes += 'x';
    expect(contactDraftDirty(draft, initial)).toBe(true); draft.notes = initial.notes;
    expect(contactDraftDirty(draft, initial)).toBe(false);
  });
});

describe('Dialpad existing-contact draft', () => {
  it('stages the number without changing the original and retains existing phone metadata', () => {
    const draft = contactDraftWithDialedNumber(contact, '12345');
    expect(draft.phones.slice(0, 2)).toEqual(contact.phones);
    expect(draft.phones[2]).toMatchObject({ id: 'p1', number: '12345', isPrimary: false });
    expect(contact.phones).toHaveLength(2);
    expect(contactDraftDirty(draft, contactDraft(contact))).toBe(true);
  });
  it('does not duplicate formatted equivalents or invent extra rows for an empty contact', () => {
    expect(contactDraftWithDialedNumber(contact, '+1 (202) 555-0100').phones).toHaveLength(2);
    expect(contactDraftWithDialedNumber({ ...contact, phones: [] }, '99').phones).toEqual([{ id: 'p1', label: '手机', number: '99', isPrimary: true }]);
  });
  it('preserves dialpad provenance through discard and only pops to the matching picker', () => {
    const query = '?from=dialpad&number=123';
    expect(contactsEditorBackFallback('/contact/source/edit', query, { pathname: '/contacts/choose-existing', search: '?number=123' })).toBeNull();
    expect(contactsEditorBackFallback('/contact/source/edit', query, { pathname: '/contacts/choose-existing', search: '?number=999' })).toBe('/contacts/choose-existing?number=123');
    expect(contactsEditorBackFallback('/contact/source/edit', query + '&modal=discard', { pathname: '/', search: '' })).toBe('/contact/source/edit?from=dialpad&number=123');
  });
});

describe('Contact editor cold and warm back ownership', () => {
  it.each(['/contacts/new', '/contact/A/edit'])('closes a cold discard first at %s', path => {
    expect(contactsEditorBackFallback(path, '?modal=discard', { pathname: '/', search: '' })).toBe(path);
    expect(contactsEditorBackFallback(path, '?modal=discard', { pathname: path, search: '' })).toBeNull();
  });
  it('returns a cold edit to its visible contact and a cold New to the contact list', () => {
    expect(contactsEditorBackFallback('/contact/A/edit', '', { pathname: '/', search: '' })).toBe('/contact/A');
    expect(contactsEditorBackFallback('/contacts/new', '', { pathname: '/', search: '' })).toBe('/contacts');
  });
  it('retains genuine parent history and never reopens a menu as the edit parent', () => {
    expect(contactsEditorBackFallback('/contact/A/edit', '', { pathname: '/contact/A', search: '' })).toBeNull();
    expect(contactsEditorBackFallback('/contact/A/edit', '', { pathname: '/contact/A', search: '?menu=more' })).toBe('/contact/A');
    expect(contactsEditorBackFallback('/contacts/new', '', { pathname: '/contacts', search: '' })).toBeNull();
  });
  it('does not reinterpret call, detail or settings routes as editors', () => {
    expect(contactsEditorBackFallback('/call/A', '')).toBeNull();
    expect(contactsEditorBackFallback('/contact/A', '')).toBeNull();
  });
  it('declares an edit deep link with distinct draft and discard states', () => {
    const route = NAVIGATION_DECLARATION.routes.find(route => route.path === '/contact/:contactId/edit');
    expect(route).toMatchObject({ entryPoint: 'deepLink', params: { contactId: 'string' } });
    expect(route?.uiStates.map(state => state.search)).toEqual([{}, { modal: 'discard' }]);
    expect(route?.scrollContainers.map(container => container.name)).toEqual(['main', 'discard']);
  });
});
