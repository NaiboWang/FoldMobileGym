import { describe, expect, it } from 'vitest';
import { findNoteText, nextNoteTextMatch } from '../system/Notes/textSearch';
import { getNoteEditorSheet, noteEditorBackFallback } from '../system/Notes/editorOverlay';
import { NAVIGATION_DECLARATION } from '../system/Notes/navigation.declaration';

describe('Read-only literal note text search', () => {
  it('finds case-insensitive title/body/checklist matches in authored order without mutating input', () => {
    const docs = Object.freeze([Object.freeze({ id: 'title', text: 'Alpha' }), Object.freeze({ id: 'content', text: 'alpha ALPHA' }), Object.freeze({ id: 'checklist:1', text: 'Alpha task' })]);
    expect(findNoteText(docs, 'alpha')).toEqual([{ documentId: 'title', start: 0, end: 5 }, { documentId: 'content', start: 0, end: 5 }, { documentId: 'content', start: 6, end: 11 }, { documentId: 'checklist:1', start: 0, end: 5 }]);
    expect(docs[1].text).toBe('alpha ALPHA');
  });
  it.each(['[a+b]', '.*', '(a)', '$', '\\', '?', '^'])('treats %s literally rather than as executable regex syntax', query => {
    const text = `before ${query} after`;
    expect(findNoteText([{ id: 'body', text }], query)).toEqual([{ documentId: 'body', start: 7, end: 7 + query.length }]);
  });
  it('retains UTF-16 slice offsets for astral/Chinese/multiline text', () => {
    const text = '🧭中文\n🧭中文';
    expect(findNoteText([{ id: 'body', text }], '🧭中文')).toEqual([{ documentId: 'body', start: 0, end: 4 }, { documentId: 'body', start: 5, end: 9 }]);
    expect(findNoteText([{ id: 'body', text }], '文\n🧭')).toEqual([{ documentId: 'body', start: 3, end: 7 }]);
  });
  it('does not trim literal spaces, cross document boundaries or invent empty-query matches', () => {
    const docs = [{ id: 'title', text: 'one' }, { id: 'body', text: 'two two' }];
    expect(findNoteText(docs, '')).toEqual([]);
    expect(findNoteText(docs, 'onetwo')).toEqual([]);
    expect(findNoteText(docs, ' ')).toEqual([{ documentId: 'body', start: 3, end: 4 }]);
    expect(findNoteText(docs, 'absent')).toEqual([]);
  });
  it('returns non-overlapping matches and cycles both directions without stale empty indices', () => {
    expect(findNoteText([{ id: 'body', text: 'aaaa' }], 'aa')).toHaveLength(2);
    expect(nextNoteTextMatch(0, -1, 3)).toBe(2);
    expect(nextNoteTextMatch(2, 1, 3)).toBe(0);
    expect(nextNoteTextMatch(0, 1, 0)).toBe(0);
  });
  it('owns search through the URL and preserves both parent views on cold Back', () => {
    expect(getNoteEditorSheet('/note/one', '?sheet=search')).toBe('search');
    expect(noteEditorBackFallback('/note/one', '?sheet=search')).toBe('/note/one');
    expect(noteEditorBackFallback('/note/one', '?view=full&sheet=search')).toBe('/note/one?view=full');
    expect(NAVIGATION_DECLARATION.transitions.find(t => t.id === 'notes.editor.search.open')).toMatchObject({ mode: 'push', preserveParams: ['view'], search: { sheet: 'search' } });
  });
});
