import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotesStore } from '../system/Notes/state';
import { createNoteId } from '../system/Notes/utils';
import type { Note } from '../system/Notes/types';

const original: Note = { id: '9', title: 'Original', content: 'Unchanged', folderId: 'unfiled', updatedAt: 1 };
beforeEach(() => {
  vi.spyOn(Math, 'random').mockReturnValue(0.25);
  useNotesStore.setState({ notes: [{ ...original }], createdCount: 0, deletedCount: 7 });
});
afterEach(() => vi.restoreAllMocks());

describe('Notes new-record identity', () => {
  it('retains a free normal candidate without mutating inputs', () => {
    const notes = [{ id: 'old' }];
    expect(createNoteId(notes, 'fresh')).toBe('fresh');
    expect(notes).toEqual([{ id: 'old' }]);
  });
  it('allocates against the live occupied suffix chain in addNote', () => {
    const old = [original, { ...original, id: '9-1' }, { ...original, id: '9-2' }];
    useNotesStore.setState({ notes: old });
    const added = useNotesStore.getState().addNote({ title: 'New', content: 'Body' });
    expect(added.id).toBe('9-3');
    expect(useNotesStore.getState().notes.filter(note => note.id !== added.id)).toEqual(old);
    expect(useNotesStore.getState().createdCount).toBe(1);
    expect(useNotesStore.getState().deletedCount).toBe(7);
  });
  it('repeated entropy creates two independent records and edits only one', () => {
    const first = useNotesStore.getState().addNote({ title: 'First', content: 'One' });
    const second = useNotesStore.getState().addNote({ title: 'Second', content: 'Two' });
    expect(first.id).not.toBe(second.id);
    useNotesStore.getState().updateNote(first.id, { content: 'Edited' });
    expect(useNotesStore.getState().notes.find(note => note.id === first.id)?.content).toBe('Edited');
    expect(useNotesStore.getState().notes.find(note => note.id === second.id)).toEqual(second);
    expect(useNotesStore.getState().notes.find(note => note.id === original.id)).toEqual(original);
    expect(useNotesStore.getState().createdCount).toBe(2);
    expect(useNotesStore.getState().deletedCount).toBe(7);
  });
  it('zero entropy cannot create an empty route ID', () => {
    vi.mocked(Math.random).mockReturnValue(0);
    expect(useNotesStore.getState().addNote().id).toBe('note');
    expect(useNotesStore.getState().addNote().id).toBe('note-1');
  });
  it('reserves new for the empty editor rather than a saved record', () => {
    expect(createNoteId([], 'new')).toBe('new-1');
    expect(createNoteId([{ id: 'new-1' }, { id: 'new-2' }], 'new')).toBe('new-3');
  });
  it('includes private and trashed records in occupied IDs', () => {
    const old = [{ ...original, trashedAt: 10 }, { ...original, id: '9-1', isPrivate: true }];
    useNotesStore.setState({ notes: old });
    expect(useNotesStore.getState().addNote().id).toBe('9-2');
    expect(useNotesStore.getState().notes.filter(note => old.some(item => item.id === note.id))).toEqual(old);
  });
  it('preserves complete supplied fields and explicit blank-create compatibility', () => {
    const added = useNotesStore.getState().addNote({ title: 'Title', content: 'Body', folderId: 'folder' });
    expect(added).toMatchObject({ title: 'Title', content: 'Body', folderId: 'folder' });
    expect(useNotesStore.getState().addNote()).toMatchObject({ title: '', content: '', folderId: 'unfiled' });
  });
  it('does not deduplicate two intentional creates based on equal text', () => {
    const first = useNotesStore.getState().addNote({ title: 'Same', content: 'Same' });
    const second = useNotesStore.getState().addNote({ title: 'Same', content: 'Same' });
    expect(second.id).not.toBe(first.id);
    expect(useNotesStore.getState().createdCount).toBe(2);
  });
});
