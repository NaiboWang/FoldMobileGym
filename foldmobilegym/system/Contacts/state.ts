import { useCallback, useSyncExternalStore } from 'react';
import { createAppStoreWithActions, invalidateStateCache, registerStateAdapter } from '../../os/createAppStore';
import ContentResolver from '../../os/ContentResolver';
import { ensureContactsProviderRegistered, useContactsProviderStore } from '../../os/providers/ContactsProvider';
import { CONTACTS_CONFIG } from './data';
import type { Contact, ContactId } from './types';
import * as TimeService from '../../os/TimeService';

// ---- Helper functions ----

export type PhoneSettingsValue = string | number | boolean | null;

interface ContactsState {
  searchHistory: string[];
  settings: Record<string, PhoneSettingsValue>;
  mutationCount: number;
  callCount: number;
}

interface ContactsActions {
  addSearchHistory: (query: string) => void;
  clearSearchHistory: () => void;
  removeSearchHistoryItem: (query: string) => void;
  updateSettings: (patch: Record<string, PhoneSettingsValue>) => void;
}

// ---- Initial state ----

const initialState: ContactsState = {
  searchHistory: [],
  settings: { ...(CONTACTS_CONFIG.settings ?? {}) },
  mutationCount: 0,
  callCount: 0,
};

// ---- Store ----

export const useContactsStore = createAppStoreWithActions<ContactsState, ContactsActions>(
  'contacts',
  initialState,
  (set, get) => ({
    addSearchHistory: (query) => {
      const q = query.trim();
      if (!q) return;
      set((state) => {
        const next = [q, ...state.searchHistory.filter((x) => x !== q)];
        return { searchHistory: next.slice(0, 20) };
      });
    },

    clearSearchHistory: () => {
      set({ searchHistory: [] });
    },

    removeSearchHistoryItem: (query) => {
      const q = query.trim();
      if (!q) return;
      set((state) => ({
        searchHistory: state.searchHistory.filter((x) => x !== q),
      }));
    },
    updateSettings: (patch) => {
      set((state) => ({ settings: { ...state.settings, ...patch } }));
    },
  }),
);

// ---- Convenience hooks for phone settings ----

export function usePreferenceValue<T extends PhoneSettingsValue>(
  key: string,
  fallback: T,
): [T, (v: T) => void] {
  const value = useContactsStore((s) => {
    const val = s.settings[key];
    return (val === undefined ? fallback : val) as T;
  });
  const updateSettings = useContactsStore((s) => s.updateSettings);
  const setValue = useCallback(
    (v: T) => updateSettings({ [key]: v }),
    [key, updateSettings],
  );
  return [value, setValue];
}

export function useBooleanPreference(key: string, fallback: boolean): [boolean, (v: boolean) => void] {
  const [v, setV] = usePreferenceValue<boolean>(key, fallback);
  return [Boolean(v), (next) => setV(next)];
}

export function useStringPreference(key: string, fallback: string): [string, (v: string) => void] {
  const [v, setV] = usePreferenceValue<string>(key, fallback);
  return [String(v), (next) => setV(next)];
}

export function readPhoneSettingsPreference<T extends PhoneSettingsValue>(key: string): T | undefined {
  const prefs = useContactsStore.getState().settings;
  return prefs[key] as T | undefined;
}

function queryContacts(uri: string): Contact[] {
  ensureContactsProviderRegistered();
  try {
    return ContentResolver.query<Contact>(uri).items;
  } catch {
    return [];
  }
}

let _contactsSnapshot: Contact[] | null = null;
let _starredSnapshot: Contact[] | null = null;
let _contactsSource: Contact[] | null = null;

function ensureContactsSnapshots() {
  if (_contactsSnapshot && _starredSnapshot && _contactsSource === useContactsProviderStore.getState().contacts) return;
  refreshContactsSnapshots();
}

function refreshContactsSnapshots() {
  _contactsSnapshot = queryContacts('content://contacts/contacts');
  _starredSnapshot = queryContacts('content://contacts/contacts/starred');
  _contactsSource = useContactsProviderStore.getState().contacts;
}

function subscribeContacts(listener: () => void): () => void {
  return ContentResolver.registerContentObserver('content://contacts/contacts', () => {
    refreshContactsSnapshots();
    listener();
  });
}

export function useContactsList(): Contact[] {
  return useSyncExternalStore(
    subscribeContacts,
    () => {
      ensureContactsSnapshots();
      return _contactsSnapshot ?? [];
    },
    () => [],
  );
}

export function useContact(contactId?: string): Contact | undefined {
  return useSyncExternalStore(
    subscribeContacts,
    () => {
      if (!contactId) return undefined;
      return queryContacts(`content://contacts/contacts/${contactId}`)[0];
    },
    () => {
      if (!contactId) return undefined;
      return queryContacts(`content://contacts/contacts/${contactId}`)[0];
    },
  );
}

export function createContact(draft: Omit<Contact, 'id' | 'createdAt' | 'updatedAt'>): ContactId {
  const uri = ContentResolver.insert('content://contacts/contacts', {
    ...draft,
    createdAt: TimeService.now(),
    updatedAt: TimeService.now(),
  });
  useContactsStore.setState((state) => ({ mutationCount: state.mutationCount + 1 }));
  return String(uri.split('/').pop() ?? '');
}

export function updateContact(contactId: ContactId, patch: Partial<Omit<Contact, 'id'>>): void {
  ContentResolver.update(`content://contacts/contacts/${contactId}`, patch);
  useContactsStore.setState((state) => ({ mutationCount: state.mutationCount + 1 }));
}

export function contactSourceIsCurrent(source: Contact): boolean {
  return queryContacts(`content://contacts/contacts/${source.id}`)[0] === source;
}

/** Compare live provider identity before a queued editor submit can write. */
export function updateContactIfCurrent(source: Contact, patch: Partial<Omit<Contact, 'id'>>): boolean {
  if (!contactSourceIsCurrent(source)) return false;
  if (!Object.keys(patch).length) return true;
  const count = ContentResolver.update(`content://contacts/contacts/${source.id}`, patch);
  if (count !== 1) return false;
  useContactsStore.setState(state => ({ mutationCount: state.mutationCount + 1 }));
  return true;
}

export function deleteContact(contactId: ContactId): void {
  ContentResolver.delete(`content://contacts/contacts/${contactId}`);
  useContactsStore.setState((state) => ({ mutationCount: state.mutationCount + 1 }));
}

export function toggleStarred(contactId: ContactId, to?: boolean): void {
  const current = queryContacts(`content://contacts/contacts/${contactId}`)[0];
  if (!current) return;
  ContentResolver.update(`content://contacts/contacts/${contactId}`, {
    starred: typeof to === 'boolean' ? to : !Boolean(current.starred),
  });
  useContactsStore.setState((state) => ({ mutationCount: state.mutationCount + 1 }));
}

export function recordLastContacted(contactId: ContactId): void {
  const now = TimeService.now();
  ContentResolver.update(`content://contacts/contacts/${contactId}`, {
    lastContactedAt: now,
    updatedAt: now,
  });
}

export function useStarredContacts(): Contact[] {
  return useSyncExternalStore(
    subscribeContacts,
    () => {
      ensureContactsSnapshots();
      return _starredSnapshot ?? [];
    },
    () => [],
  );
}

registerStateAdapter('contacts', (raw: Record<string, any>) => ({
  ...raw,
  contacts: queryContacts('content://contacts/contacts'),
  mutation_count: Number(raw.mutationCount ?? 0),
  call_count: Number(raw.callCount ?? 0),
}));

// The adapter includes provider-owned contacts, which may change without an app-store mutation.
const unsubscribeContactsSnapshot = useContactsProviderStore.subscribe((state, previous) => {
  if (state.contacts !== previous.contacts) invalidateStateCache('contacts');
});
if (import.meta.hot) import.meta.hot.dispose(unsubscribeContactsSnapshot);
