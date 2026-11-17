import { beforeEach, describe, expect, it } from 'vitest';
import ContentResolver from '../os/ContentResolver';
import { getAllStoreStates } from '../os/createAppStore';
import { ensureContactsProviderRegistered, useContactsProviderStore } from '../os/providers/ContactsProvider';
import { updateContactIfCurrent, useContactsStore } from '../system/Contacts/state';
import type { Contact } from '../system/Contacts/types';

const fixture: Contact = { id: 'snapshot-editor', displayName: 'Snapshot source', phones: [], notes: 'Original', starred: true, createdAt: 1 };
describe('Contacts live provider snapshot and editor claims', () => {
  beforeEach(() => {
    ensureContactsProviderRegistered();
    useContactsProviderStore.setState({ contacts: [{ ...fixture }] });
    useContactsStore.setState({ mutationCount: 0 });
  });
  it('invalidates an already cached app snapshot immediately after provider insertion without an app-store write', () => {
    const raw = useContactsStore.getState(), cached = getAllStoreStates().contacts;
    const uri = ContentResolver.insert('content://contacts/contacts', { displayName: 'Inserted', phones: [] });
    const after = getAllStoreStates().contacts;
    expect(useContactsStore.getState()).toBe(raw); expect(after).not.toBe(cached);
    expect(after.contacts.map((contact: Contact) => contact.id)).toContain(uri.split('/').pop());
    expect(after.mutation_count).toBe(0); expect(getAllStoreStates().contacts).toBe(after);
  });
  it('refreshes external update, delete and full provider replacement without fabricating UI mutation counts', () => {
    getAllStoreStates(); ContentResolver.update('content://contacts/contacts/snapshot-editor', { notes: 'External' });
    expect(getAllStoreStates().contacts.contacts[0].notes).toBe('External');
    ContentResolver.delete('content://contacts/contacts/snapshot-editor'); expect(getAllStoreStates().contacts.contacts).toEqual([]);
    useContactsProviderStore.setState({ contacts: [{ ...fixture, displayName: 'Replaced' }] });
    expect(getAllStoreStates().contacts.contacts[0].displayName).toBe('Replaced');
    expect(getAllStoreStates().contacts.mutation_count).toBe(0);
  });
  it('saves one patch to the exact live source and increments the original mutation contract once', () => {
    const source = useContactsProviderStore.getState().contacts[0];
    expect(updateContactIfCurrent(source, { notes: 'Edited' })).toBe(true);
    expect(getAllStoreStates().contacts.contacts[0]).toMatchObject({ ...fixture, notes: 'Edited' });
    expect(getAllStoreStates().contacts.mutation_count).toBe(1);
    expect(updateContactIfCurrent(source, { notes: 'Duplicate queued submit' })).toBe(false);
    expect(getAllStoreStates().contacts.contacts[0].notes).toBe('Edited');
    expect(getAllStoreStates().contacts.mutation_count).toBe(1);
  });
  it('rejects same-ID replaced or deleted sources, including a no-op submit', () => {
    const source = useContactsProviderStore.getState().contacts[0];
    ContentResolver.update('content://contacts/contacts/snapshot-editor', { notes: 'External' });
    expect(updateContactIfCurrent(source, { notes: 'Stale draft' })).toBe(false);
    expect(updateContactIfCurrent(source, {})).toBe(false);
    const current = useContactsProviderStore.getState().contacts[0];
    ContentResolver.delete('content://contacts/contacts/snapshot-editor');
    expect(updateContactIfCurrent(current, { notes: 'Deleted draft' })).toBe(false);
    expect(useContactsStore.getState().mutationCount).toBe(0);
  });
  it('pristine submit leaves both source reference and counters untouched', () => {
    const source = useContactsProviderStore.getState().contacts[0];
    expect(updateContactIfCurrent(source, {})).toBe(true);
    expect(useContactsProviderStore.getState().contacts[0]).toBe(source);
    expect(useContactsStore.getState().mutationCount).toBe(0);
  });
});
