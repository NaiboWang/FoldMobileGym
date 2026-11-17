import * as TimeService from '../../os/TimeService';
import type { Note } from './types';
import type { strings } from './res/strings';
import type { Locale } from '../../os/locale';

export type NoteLibraryGroup = {
  key: string;
  kind: 'pinned' | 'recent' | 'month' | 'undated';
  timestamp?: number;
  notes: Note[];
};

function validDate(timestamp: number): Date | undefined {
  if (!Number.isFinite(timestamp)) return;
  const date = TimeService.fromTimestamp(timestamp);
  return Number.isFinite(date.getTime()) ? date : undefined;
}

/** Presentation only. Callers supply their real visible records; no record is rewritten. */
export function groupReferenceNotes(notes: readonly Note[], now: number): NoteLibraryGroup[] {
  const current = validDate(now);
  // Today and the previous six local dates, not seven fixed 24-hour intervals.
  const cutoff = current ? TimeService.fromLocalParts(current.getFullYear(), current.getMonth(), current.getDate() - 6).getTime() : Infinity;
  const groups = new Map<string, NoteLibraryGroup>();
  const ordered = [...notes].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    const at = validDate(a.updatedAt)?.getTime() ?? -Infinity;
    const bt = validDate(b.updatedAt)?.getTime() ?? -Infinity;
    return at === bt ? 0 : at > bt ? -1 : 1;
  });
  for (const note of ordered) {
    const date = validDate(note.updatedAt);
    const kind = note.pinned ? 'pinned' : !date ? 'undated' : note.updatedAt >= cutoff && note.updatedAt <= now ? 'recent' : 'month';
    const key = kind === 'month' ? `month:${date!.getFullYear()}-${String(date!.getMonth() + 1).padStart(2, '0')}` : kind;
    let group = groups.get(key);
    if (!group) { group = { key, kind, ...(date ? { timestamp: date.getTime() } : {}), notes: [] }; groups.set(key, group); }
    group.notes.push(note);
  }
  const rank = (kind: NoteLibraryGroup['kind']) => kind === 'pinned' ? 0 : kind === 'recent' ? 1 : kind === 'month' ? 2 : 3;
  return [...groups.values()].sort((a, b) => rank(a.kind) - rank(b.kind) || (b.timestamp ?? 0) - (a.timestamp ?? 0));
}

export function noteLibraryGroupLabel(group: NoteLibraryGroup, now: number, locale: Locale, s: typeof strings): string {
  if (group.kind === 'pinned') return s.action_pin;
  if (group.kind === 'recent') return s.library_recent;
  if (group.kind === 'undated' || group.timestamp === undefined) return s.library_undated;
  const date = TimeService.fromTimestamp(group.timestamp), current = validDate(now);
  return new Intl.DateTimeFormat(locale, { month: 'long', ...(current?.getFullYear() === date.getFullYear() ? {} : { year: 'numeric' as const }) }).format(date);
}

export function noteLibraryDate(timestamp: number, now: number, locale: Locale): string {
  const date = validDate(timestamp);
  if (!date) return '';
  const current = validDate(now);
  return new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', ...(current?.getFullYear() === date.getFullYear() ? {} : { year: 'numeric' as const }) }).format(date);
}

/** Presentation bands only; the recording establishes evening, not boundary rules. */
export function noteLibraryGreeting(now: number, s: typeof strings): string {
  const date = validDate(now);
  if (!date) return s.library_greeting_generic;
  const hour = date.getHours();
  if (hour < 5 || hour >= 18) return s.library_greeting_evening;
  return hour < 12 ? s.library_greeting_morning : s.library_greeting_afternoon;
}
