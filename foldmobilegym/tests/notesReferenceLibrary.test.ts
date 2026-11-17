import { describe, expect, it } from 'vitest';
import * as TimeService from '../os/TimeService';
import { groupReferenceNotes, noteLibraryDate, noteLibraryGroupLabel } from '../system/Notes/referenceLibrary';
import { strings } from '../system/Notes/res/strings';
import { stringsEn } from '../system/Notes/res/strings.en';
import { resolveAppStrings } from '../os/useAppStrings';
import type { Note } from '../system/Notes/types';
const stamp = (year: number, month: number, day: number, hour = 12) => TimeService.fromLocalParts(year, month - 1, day, hour).getTime();
const now = stamp(2026, 2, 5);
const note = (id: string, updatedAt: number, pinned = false): Note => ({ id, title: id, content: 'Source text', updatedAt, pinned, folderId: 'unfiled' });

describe('Notes source-backed reference library', () => {
  it('does not manufacture records or empty group headings', () => expect(groupReferenceNotes([], now)).toEqual([]));
  it('groups pinned first, recent next, then exact older year/month', () => {
    const groups = groupReferenceNotes([note('old', stamp(2025, 8, 1)), note('recent', stamp(2026, 2, 4)), note('pin', stamp(2024, 3, 1), true)], now);
    expect(groups.map(g => g.key)).toEqual(['pinned', 'recent', 'month:2025-08']);
    expect(groups.map(g => g.notes.map(n => n.id))).toEqual([['pin'], ['recent'], ['old']]);
  });
  it('sorts real records newest-first without mutating the array or objects', () => {
    const first = Object.freeze(note('first', stamp(2026, 2, 1))), second = Object.freeze(note('second', stamp(2026, 2, 4)));
    const input = Object.freeze([first, second]);
    const groups = groupReferenceNotes(input, now);
    expect(input).toEqual([first, second]); expect(groups[0].notes).toEqual([second, first]); expect(groups[0].notes[0]).toBe(second);
  });
  it('keeps original source order when two timestamps tie', () => {
    expect(groupReferenceNotes([note('b', now), note('a', now)], now)[0].notes.map(n => n.id)).toEqual(['b', 'a']);
  });
  it('includes midnight six local dates ago but not the prior instant', () => {
    const boundary = TimeService.fromLocalParts(2026, 0, 30).getTime();
    const groups = groupReferenceNotes([note('at', boundary), note('before', boundary - 1)], now);
    expect(groups.map(g => g.key)).toEqual(['recent', 'month:2026-01']); expect(groups[0].notes.map(n => n.id)).toEqual(['at']);
  });
  it('keeps future timestamps out of recent, rather than hiding/rebasing them', () => {
    const future = note('future', stamp(2026, 2, 6));
    expect(groupReferenceNotes([future], now)[0]).toMatchObject({ key: 'month:2026-02', notes: [future] });
  });
  it('rolls a record into its real month on a time jump and back on reversal', () => {
    const source = [note('live', stamp(2026, 2, 4))];
    expect(groupReferenceNotes(source, now)[0].key).toBe('recent');
    expect(groupReferenceNotes(source, stamp(2026, 3, 5))[0].key).toBe('month:2026-02');
    expect(groupReferenceNotes(source, now)[0].key).toBe('recent');
  });
  it('does not merge the same month across two years', () => {
    expect(groupReferenceNotes([note('a', stamp(2024, 8, 1)), note('b', stamp(2025, 8, 1))], now).map(g => g.key)).toEqual(['month:2025-08', 'month:2024-08']);
  });
  it('sorts pinned notes by real update time without also duplicating month groups', () => {
    const groups = groupReferenceNotes([note('a', stamp(2025, 8, 1), true), note('b', stamp(2026, 2, 4), true)], now);
    expect(groups).toHaveLength(1); expect(groups[0].notes.map(n => n.id)).toEqual(['b', 'a']);
  });
  it.each([NaN, Infinity, -Infinity, 9e15])('retains an invalid timestamp in undated rather than inventing its date: %s', value => {
    const source = note('invalid', value), groups = groupReferenceNotes([source], now);
    expect(groups[0]).toMatchObject({ key: 'undated', notes: [source] }); expect(noteLibraryDate(value, now, 'en')).toBe('');
  });
  it('retains pinned invalid-date records in pinned without crashing', () => {
    const groups = groupReferenceNotes([note('invalid', NaN, true)], now);
    expect(groups[0].key).toBe('pinned'); expect(noteLibraryGroupLabel(groups[0], now, 'zh-Hans', strings)).toBe(strings.action_pin);
  });
  it('handles an invalid current clock without producing a fake recent group', () => {
    const group = groupReferenceNotes([note('source', now)], NaN)[0]; expect(group.key).toBe('month:2026-02');
    expect(noteLibraryGroupLabel(group, NaN, 'en', strings)).toBe('February 2026');
  });
  it('uses localized headers and real current-year date labels', () => {
    const en = resolveAppStrings(strings, stringsEn, 'en');
    const recent = groupReferenceNotes([note('recent', now)], now)[0];
    expect(noteLibraryGroupLabel(recent, now, 'zh-Hans', strings)).toBe('最近7天');
    expect(noteLibraryGroupLabel(recent, now, 'en', en)).toBe('Last 7 days');
    const month = groupReferenceNotes([note('month', stamp(2025, 8, 1))], now)[0];
    expect(noteLibraryGroupLabel(month, now, 'zh-Hans', strings)).toBe('2025年8月');
    expect(noteLibraryGroupLabel(month, now, 'en', en)).toBe('August 2025');
    expect(noteLibraryDate(now, now, 'en')).toBe('Feb 5');
    expect(noteLibraryDate(stamp(2025, 8, 1), now, 'en')).toBe('Aug 1, 2025');
    expect(noteLibraryDate(now, now, 'zh-Hans')).toBe('2月5日');
  });
});
