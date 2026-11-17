import type { Draft, Message } from './types';
import { isDocumentReference } from '@/os/utils/documentReference';

export type MailSearchTerm = { field: string; value: string; negative: boolean };
export type ParsedMailSearch = { groups: MailSearchTerm[][]; error?: 'quotes' | 'expression' | 'operator' | 'date' };
export type MailSearchHit = { kind: 'message'; id: string; source: Message } | { kind: 'draft'; id: string; source: Draft };
export const foldMailText = (value: unknown): string => typeof value === 'string' ? value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim() : '';
const text = (value: unknown) => typeof value === 'string' ? value : '';

function calendarDay(value: string): string | undefined {
  const match = /^(\d{4})[-/](\d{2})[-/](\d{2})$/.exec(value);
  if (!match) return;
  const year = Number(match[1]), month = Number(match[2]), day = Number(match[3]);
  if (year < 1 || month < 1 || month > 12) return;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  if (day < 1 || day > [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1]) return;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

/** Linear literal tokenization, never regular expressions compiled from user content. */
export function parseMailSearch(query: string): ParsedMailSearch {
  const raw = query.normalize('NFKC'), tokens: { value: string; quoted: boolean; literal: boolean }[] = [];
  let token = '', quoted = false, hadQuotes = false, literal = false;
  for (let i = 0; i < raw.length; i++) {
    const char = raw[i];
    if (char === '\\' && (raw[i + 1] === '"' || raw[i + 1] === '\\')) { token += raw[++i]; continue; }
    if (char === '"') { if (!quoted && (token === '' || token === '-')) literal = true; quoted = !quoted; hadQuotes = true; continue; }
    if (/\s/.test(char) && !quoted) { if (token || hadQuotes) tokens.push({ value: token, quoted: hadQuotes, literal }); token = ''; hadQuotes = false; literal = false; }
    else token += char;
  }
  if (quoted) return { groups: [], error: 'quotes' };
  if (token || hadQuotes) tokens.push({ value: token, quoted: hadQuotes, literal });
  const groups: MailSearchTerm[][] = [[]];
  for (const part of tokens) {
    const item = part.value;
    if (item === 'OR' && !part.quoted) { if (!groups.at(-1)?.length) return { groups: [], error: 'expression' }; groups.push([]); continue; }
    const negative = item.startsWith('-') && item.length > 1, body = negative ? item.slice(1) : item;
    const match = part.literal ? null : /^([a-z]+):(.*)$/i.exec(body), name = match?.[1].toLowerCase();
    const supported = ['from', 'to', 'subject', 'in', 'is', 'has', 'filename', 'before', 'after'];
    const unavailable = ['label', 'cc', 'bcc', 'category', 'larger', 'smaller', 'older', 'newer'];
    if (name && unavailable.includes(name)) return { groups: [], error: 'operator' };
    const field = name && supported.includes(name) ? name : 'text';
    let value = field === 'text' ? body : match?.[2] ?? '';
    if (!value) return { groups: [], error: 'expression' };
    if (field === 'in' && !['inbox', 'archive', 'drafts', 'anywhere'].includes(foldMailText(value))) return { groups: [], error: 'operator' };
    if (field === 'is' && !['starred', 'unread'].includes(foldMailText(value))) return { groups: [], error: 'operator' };
    if (field === 'has' && foldMailText(value) !== 'attachment') return { groups: [], error: 'operator' };
    if (field === 'before' || field === 'after') { const day = calendarDay(value); if (!day) return { groups: [], error: 'date' }; value = day; }
    groups.at(-1)?.push({ field, value: foldMailText(value), negative });
  }
  if (tokens.length && !groups.at(-1)?.length) return { groups: [], error: 'expression' };
  return { groups };
}

function predicate(hit: MailSearchHit, term: MailSearchTerm, starred: ReadonlySet<string>, archived: ReadonlySet<string>, unread: ReadonlySet<string>): boolean | undefined {
  const source = hit.source, wanted = term.value;
  const attachments = hit.kind === 'draft' ? (hit.source.attachments ?? []).filter(isDocumentReference) : [];
  const names = attachments.map(item => item.path.split('/').at(-1) ?? '');
  switch (term.field) {
    case 'is': return hit.kind === 'message' ? (wanted === 'unread' ? unread.has(hit.id) : starred.has(hit.id)) : undefined;
    case 'in': return wanted === 'anywhere' || (wanted === 'drafts' ? hit.kind === 'draft'
      : hit.kind === 'message' && (wanted === 'archive' ? archived.has(hit.id) : !archived.has(hit.id)));
    case 'subject': return foldMailText(source.subject).includes(wanted);
    case 'from': {
      if (hit.kind !== 'message') return;
      const address = foldMailText(hit.source.senderAddress), display = foldMailText(hit.source.from);
      if (wanted.includes('@')) return address ? address.includes(wanted) : undefined;
      return address || display ? [address, display].some(value => value.includes(wanted)) : undefined;
    }
    case 'to': return hit.kind === 'draft' && foldMailText(hit.source.to) ? foldMailText(hit.source.to).includes(wanted) : undefined;
    case 'has': return hit.kind === 'draft' ? attachments.length > 0 : undefined;
    case 'filename': return hit.kind === 'draft' ? names.some(name => foldMailText(name).includes(wanted)) : undefined;
    case 'before': case 'after': {
      const day = hit.kind === 'message' ? calendarDay(text(hit.source.date).trim().slice(0, 10)) : undefined;
      if (!day) return;
      return term.field === 'before' ? day < wanted : day >= wanted;
    }
    default: {
      const fields = hit.kind === 'message'
        ? [source.subject, source.body, hit.source.from, hit.source.senderAddress]
        : [source.subject, source.body, hit.source.to, ...names];
      return fields.some(value => foldMailText(value).includes(wanted));
    }
  }
}

/** Resolve identity before filtering. Shadowed duplicate IDs must not impersonate an openable record. */
export function searchMail(messages: Message[], drafts: Draft[], query: string, starredIds: readonly string[] = [], archivedIds: readonly string[] = [], unreadIds?: readonly string[]): { hits: MailSearchHit[]; error?: ParsedMailSearch['error'] } {
  const parsed = parseMailSearch(query); if (parsed.error) return { hits: [], error: parsed.error };
  // Legacy callers without the relationship must not present unknown read
  // status as a known-empty set, even for a negated or OR expression.
  if (unreadIds === undefined && parsed.groups.some(group => group.some(term => term.field === 'is' && term.value === 'unread'))) return { hits: [], error: 'operator' };
  const starred = new Set(starredIds);
  const archived = new Set(archivedIds);
  const unread = new Set(unreadIds ?? []);
  const candidates: MailSearchHit[] = [], seenMessages = new Set<string>(), seenDrafts = new Set<string>();
  for (const source of messages) {
    if (!source || typeof source.id !== 'string' || !source.id || seenMessages.has(source.id)) continue;
    seenMessages.add(source.id); candidates.push({ kind: 'message', id: source.id, source });
  }
  for (const source of drafts) {
    if (!source || typeof source.id !== 'string' || !source.id || seenDrafts.has(source.id)) continue;
    seenDrafts.add(source.id); candidates.push({ kind: 'draft', id: source.id, source });
  }
  return { hits: candidates.filter(hit => parsed.groups.some(group => group.every(term => {
    const matches = predicate(hit, term, starred, archived, unread); return matches !== undefined && (term.negative ? !matches : matches);
  }))) };
}
