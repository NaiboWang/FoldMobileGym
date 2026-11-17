import { describe, expect, it, vi } from 'vitest';
import { persistEditorText, type EditorTextDraft } from '../system/Notes/editorPersistence';

const draft = (patch: Partial<EditorTextDraft> = {}): EditorTextDraft => ({
  title: 'Public title', content: 'Public body', folderId: 'unfiled', isNew: true, isTrashed: false, ...patch,
});
describe('Note text is published synchronously, without duplicate creation', () => {
  it('creates once and updates the same ID before the route render catches up', () => {
    const add = vi.fn(() => ({ id: 'new-id' })), update = vi.fn();
    const data = draft();
    expect(persistEditorText(data, null, add, update)).toBe('new-id');
    expect(persistEditorText(draft({ content: 'Continued' }), 'new-id', add, update)).toBe('new-id');
    expect(add).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledExactlyOnceWith('new-id', { title: data.title, content: 'Continued', folderId: 'unfiled' });
    expect(data).toEqual(draft());
  });
  it.each(['', ' ', '\n\t'])('does not create an empty/whitespace editor %j', text => {
    const add = vi.fn(), update = vi.fn();
    expect(persistEditorText(draft({ title: text, content: text }), null, add, update)).toBeNull();
    expect(add).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
  });
  it.each(['title', 'content'] as const)('accepts a single nonempty %s without trimming data', field => {
    const add = vi.fn(() => ({ id: 'created' }));
    const data = draft({ title: '', content: '', [field]: '  中文 😀\n', folderId: 'custom' });
    expect(persistEditorText(data, null, add, vi.fn())).toBe('created');
    expect(add).toHaveBeenCalledWith({ title: data.title, content: data.content, folderId: 'custom' });
  });
  it('updates the actual old note, never a cached new-note ID', () => {
    const add = vi.fn(), update = vi.fn();
    expect(persistEditorText(draft({ isNew: false, existingId: 'old' }), 'unrelated', add, update)).toBe('old');
    expect(update).toHaveBeenCalledWith('old', expect.any(Object)); expect(add).not.toHaveBeenCalled();
  });
  it('allows clearing an existing note without deleting or creating it', () => {
    const add = vi.fn(), update = vi.fn();
    expect(persistEditorText(draft({ isNew: false, existingId: 'old', title: '', content: '' }), null, add, update)).toBe('old');
    expect(update).toHaveBeenCalledWith('old', { title: '', content: '', folderId: 'unfiled' }); expect(add).not.toHaveBeenCalled();
  });
  it('does not recreate a missing existing note', () => {
    const add = vi.fn(), update = vi.fn();
    expect(persistEditorText(draft({ isNew: false }), null, add, update)).toBeNull();
    expect(add).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
  });
  it('does not modify a trashed note', () => {
    const add = vi.fn(), update = vi.fn();
    expect(persistEditorText(draft({ isTrashed: true }), null, add, update)).toBeNull();
    expect(add).not.toHaveBeenCalled(); expect(update).not.toHaveBeenCalled();
  });
  it.each([true, false])('propagates storage errors for new=%s', isNew => {
    const fail = () => { throw Error('storage unavailable'); };
    expect(() => persistEditorText(draft({ isNew, existingId: 'old' }), null, fail, fail)).toThrow('storage unavailable');
  });
});
