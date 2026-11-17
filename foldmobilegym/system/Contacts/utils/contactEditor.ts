import type { Contact, ContactEmail, ContactPhone } from '../types';
import { contactOriginSuffix } from './detailOrigin';

export interface ContactDraft {
  displayName: string; company: string; title: string; notes: string;
  phones: ContactPhone[]; emails: ContactEmail[];
}

export function contactDraft(source?: Contact): ContactDraft {
  return { displayName: source?.displayName ?? '', company: source?.company ?? '',
    title: source?.title ?? '', notes: source?.notes ?? '',
    phones: source?.phones.length ? source.phones.map(phone => ({ ...phone })) : [{ id: 'p1', label: '手机', number: '', isPrimary: true }],
    emails: source?.emails?.length ? source.emails.map(email => ({ ...email })) : [{ id: 'e1', label: '工作', email: '', isPrimary: true }],
  };
}

export function nextContactFieldId(prefix: string, rows: { id: string }[]): string {
  const used = new Set(rows.map(row => row.id)); let index = 1;
  while (used.has(`${prefix}${index}`)) index++;
  return `${prefix}${index}`;
}

/** Stage a dialed number without writing to the contact or replacing existing numbers. */
export function contactDraftWithDialedNumber(source: Contact, number: string): ContactDraft {
  const draft = contactDraft(source), value = number.trim();
  const normalized = (phone: string) => phone.replace(/[\s().-]/g, '');
  if (!value || draft.phones.some(phone => normalized(phone.number) === normalized(value))) return draft;
  const empty = draft.phones.find(phone => !phone.number.trim());
  if (empty) empty.number = value;
  else draft.phones.push({ id: nextContactFieldId('p', draft.phones), label: '手机', number: value, isPrimary: false });
  return draft;
}

/** Only changed editable fields enter a provider patch. Unedited metadata is not a form default. */
export function contactDraftPatch(draft: ContactDraft, source?: Contact): Partial<Omit<Contact, 'id'>> {
  const initial = contactDraft(source), patch: Partial<Omit<Contact, 'id'>> = {};
  if (!source || draft.displayName !== initial.displayName) patch.displayName = draft.displayName.trim();
  for (const key of ['company', 'title', 'notes'] as const) {
    if (!source || draft[key] !== initial[key]) patch[key] = draft[key].trim() || undefined;
  }
  if (!source || JSON.stringify(draft.phones) !== JSON.stringify(initial.phones)) {
    patch.phones = draft.phones.filter(phone => phone.number.trim()).map(phone => ({ ...phone, number: phone.number.trim() }));
  }
  if (!source || JSON.stringify(draft.emails) !== JSON.stringify(initial.emails)) {
    patch.emails = draft.emails.filter(email => email.email.trim()).map(email => ({ ...email, email: email.email.trim() }));
  }
  return patch;
}

export function contactDraftDirty(draft: ContactDraft, initial: ContactDraft): boolean {
  return JSON.stringify(draft) !== JSON.stringify(initial);
}

type ContactHistoryEntry = { pathname: string; search: string };

/** Only return to an immediately recorded, unobscured New-contact source. */
export function contactNewSourceDelta(stack: ContactHistoryEntry[], index: number): number | null {
  const current = stack[index];
  if (current?.pathname !== '/contacts/new') return null;
  let sourceIndex = index - 1;
  if (new URLSearchParams(current.search).get('modal') === 'discard') {
    const editor = stack[sourceIndex];
    if (editor?.pathname !== '/contacts/new' || new URLSearchParams(editor.search).has('modal')) return null;
    sourceIndex--;
  }
  const source = stack[sourceIndex], params = new URLSearchParams(source?.search);
  if (!source || params.has('menu') || params.has('modal')) return null;
  if (source.pathname !== '/contacts' && !/^\/contact\/[^/]+$/.test(source.pathname)
    && !(source.pathname === '/' && params.get('dialpad') === 'true')) return null;
  return index - sourceIndex;
}

export function contactsEditorBackFallback(pathname: string, search: string, previous?: { pathname: string; search: string }): string | null {
  const editing = /^\/contact\/([^/]+)\/edit$/.exec(pathname);
  if (!editing && pathname !== '/contacts/new') return null;
  const number = new URLSearchParams(search).get('number');
  const fromPicker = editing && new URLSearchParams(search).get('from') === 'dialpad' && Boolean(number);
  const suffix = fromPicker ? `?${new URLSearchParams({ from: 'dialpad', number: number! })}` : editing ? contactOriginSuffix(search) : number ? `?${new URLSearchParams({ number })}` : '';
  const previousParams = new URLSearchParams(previous?.search);
  const sameOrigin = fromPicker ? previousParams.get('from') === 'dialpad' && previousParams.get('number') === number
    : contactOriginSuffix(previousParams) === contactOriginSuffix(search);
  if (new URLSearchParams(search).get('modal') === 'discard') {
    return previous?.pathname === pathname && !previousParams.has('modal') && sameOrigin ? null : pathname + suffix;
  }
  if (fromPicker && previous?.pathname === '/contacts/choose-existing' && previousParams.get('number') === number) return null;
  if (fromPicker) return `/contacts/choose-existing?${new URLSearchParams({ number: number! })}`;
  if (!editing && previous && (previous.pathname === '/contacts' || /^\/contact\/[^/]+$/.test(previous.pathname)
    || (previous.pathname === '/' && previousParams.get('dialpad') === 'true'))
    && !previousParams.has('menu') && !previousParams.has('modal')) return null;
  const parent = editing ? `/contact/${editing[1]}` : '/contacts';
  return previous?.pathname === parent && !previousParams.has('menu') && !previousParams.has('modal') && sameOrigin ? null : parent + (editing ? suffix : '');
}
