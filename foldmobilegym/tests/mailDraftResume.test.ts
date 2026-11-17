import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../os/createAppStore', async () => {
  const { createStore } = await import('zustand/vanilla');
  return {
    createAppStoreWithActions: (_id: string, initial: object, actions: (set: unknown) => object) =>
      createStore((set) => ({ ...initial, ...actions(set) })),
    registerStateAdapter: vi.fn(),
  };
});
import { useMailStore } from '../apps/Mail/state';

const draft = { to: 'test@example.invalid', subject: 'Diagnostic', body: 'Line one\n第二行' };
const initial = useMailStore.getState();
beforeEach(() => useMailStore.setState(initial, true));
describe('Mail in-progress draft lifecycle', () => {
  it('opening a message leaves compose without discarding unfinished text', () => {
    useMailStore.getState().beginCompose(); useMailStore.getState().updateDraft(draft);
    useMailStore.getState().open(initial.messages[0].id);
    expect(useMailStore.getState().composeOpen).toBe(false);
    expect(useMailStore.getState().selectedId).toBe(initial.messages[0].id);
    useMailStore.getState().beginCompose(); expect(useMailStore.getState().draftInput).toEqual(draft);
    expect(useMailStore.getState().drafts).toEqual([]);
  });
  it('opens a saved draft without creating or changing records', () => {
    useMailStore.setState({ drafts: [{ id: 'saved-a', ...draft }] });
    useMailStore.getState().openDraft('saved-a');
    expect(useMailStore.getState().draftInput).toEqual(draft);
    expect(useMailStore.getState().editingDraftId).toBe('saved-a');
    expect(useMailStore.getState().drafts).toEqual([{ id: 'saved-a', ...draft }]);
  });
  it('updates the same saved identity, preserving order and other drafts', () => {
    const other = { id: 'other', ...draft, subject: 'Unchanged' };
    useMailStore.setState({ drafts: [{ id: 'saved-a', ...draft }, other] });
    useMailStore.getState().openDraft('saved-a');
    useMailStore.getState().updateDraft({ body: 'Edited body' });
    useMailStore.getState().saveDraft();
    useMailStore.getState().saveDraft();
    expect(useMailStore.getState().drafts).toEqual([{ id: 'saved-a', ...draft, body: 'Edited body' }, other]);
  });
  it('keeps unfinished new-mail text while viewing and saving an existing draft', () => {
    useMailStore.setState({ drafts: [{ id: 'saved-a', ...draft }] });
    useMailStore.getState().beginCompose(); useMailStore.getState().updateDraft({ body: 'Unfinished new mail' });
    useMailStore.getState().openDraft('saved-a'); useMailStore.getState().updateDraft({ subject: 'Updated' });
    useMailStore.getState().saveDraft(); useMailStore.getState().beginCompose();
    expect(useMailStore.getState().draftInput).toEqual({ to: '', subject: '', body: 'Unfinished new mail' });
    expect(useMailStore.getState().drafts).toHaveLength(1);
  });
  it('keeps independent unsaved edits when switching saved drafts', () => {
    useMailStore.setState({ drafts: [{ id: 'a', ...draft }, { id: 'b', ...draft, subject: 'B' }] });
    useMailStore.getState().openDraft('a'); useMailStore.getState().updateDraft({ body: 'A buffer' });
    useMailStore.getState().openDraft('b'); useMailStore.getState().updateDraft({ body: 'B buffer' });
    useMailStore.getState().openDraft('a'); expect(useMailStore.getState().draftInput.body).toBe('A buffer');
    useMailStore.getState().openDraft('b'); expect(useMailStore.getState().draftInput.body).toBe('B buffer');
    expect(useMailStore.getState().drafts.map(item => item.body)).toEqual([draft.body, draft.body]);
  });
  it('closing an edited saved draft keeps its unsaved text available on reopen', () => {
    useMailStore.setState({ drafts: [{ id: 'saved-a', ...draft }] });
    useMailStore.getState().openDraft('saved-a'); useMailStore.getState().updateDraft({ body: 'Not saved' });
    useMailStore.getState().closeCompose(); useMailStore.getState().openDraft('saved-a');
    expect(useMailStore.getState().draftInput.body).toBe('Not saved');
    expect(useMailStore.getState().drafts[0].body).toBe(draft.body);
  });
  it('opening a missing ID does not overwrite the active editor', () => {
    useMailStore.getState().beginCompose(); useMailStore.getState().updateDraft(draft);
    const before = useMailStore.getState(); useMailStore.getState().openDraft('missing');
    expect(useMailStore.getState()).toBe(before);
  });
  it('a stale editor cannot recreate a removed saved draft', () => {
    useMailStore.setState({ drafts: [{ id: 'saved-a', ...draft }] }); useMailStore.getState().openDraft('saved-a');
    useMailStore.setState({ drafts: [] });
    const before = useMailStore.getState(); useMailStore.getState().saveDraft();
    expect(useMailStore.getState()).toBe(before);
    expect(useMailStore.getState().draftInput).toEqual(draft);
  });
  it('resumes a partially entered recipient after closing compose', () => {
    useMailStore.getState().beginCompose();
    useMailStore.getState().updateDraft({ to: draft.to });
    useMailStore.getState().closeCompose();
    useMailStore.getState().beginCompose();
    expect(useMailStore.getState().draftInput).toEqual({ to: draft.to, subject: '', body: '' });
    expect(useMailStore.getState().drafts).toEqual([]);
  });
  it('resumes all fields without appending a saved draft', () => {
    useMailStore.getState().beginCompose();
    useMailStore.getState().updateDraft(draft);
    useMailStore.getState().closeCompose();
    useMailStore.getState().beginCompose();
    expect(useMailStore.getState().draftInput).toEqual(draft);
    expect(useMailStore.getState().messages).toEqual(initial.messages);
    expect(useMailStore.getState().drafts).toEqual([]);
  });
  it('saves the full draft once and starts the next composition empty', () => {
    useMailStore.getState().beginCompose();
    useMailStore.getState().updateDraft(draft);
    useMailStore.getState().saveDraft();
    useMailStore.getState().saveDraft();
    expect(useMailStore.getState().drafts).toEqual([{ id: 'draft-1', ...draft }]);
    expect(useMailStore.getState().composeOpen).toBe(false);
    useMailStore.getState().beginCompose();
    expect(useMailStore.getState().draftInput).toEqual({ to: '', subject: '', body: '' });
    useMailStore.getState().saveDraft();
    expect(useMailStore.getState().drafts).toHaveLength(1);
  });
  it.each(['to', 'subject', 'body'] as const)('rejects an incomplete %s even at the action layer', field => {
    useMailStore.getState().beginCompose();
    useMailStore.getState().updateDraft({ ...draft, [field]: '   ' });
    const before = useMailStore.getState();
    useMailStore.getState().saveDraft();
    expect(useMailStore.getState()).toBe(before);
  });
  it('does not save when the editor is closed', () => {
    useMailStore.getState().updateDraft(draft);
    const before = useMailStore.getState();
    useMailStore.getState().saveDraft();
    expect(useMailStore.getState()).toBe(before);
  });
  it.each([
    ['draft-2'],
    ['draft-3', 'external-saved-draft'],
    ['draft-4', 'draft-5', 'draft-6'],
    ['draft-1', 'draft-2', 'draft-3'],
  ])('allocates a distinct identity with existing records: %j', (...ids) => {
    const saved = ids.map(id => ({ id, to: 'old@example.invalid', subject: 'Existing', body: 'Keep unchanged' }));
    useMailStore.setState({ drafts: saved });
    useMailStore.getState().beginCompose();
    useMailStore.getState().updateDraft(draft);
    useMailStore.getState().saveDraft();
    const records = useMailStore.getState().drafts;
    expect(records.slice(0, saved.length)).toEqual(saved);
    expect(new Set(records.map(record => record.id)).size).toBe(records.length);
    expect(records.at(-1)).toMatchObject(draft);
    expect(records).toHaveLength(saved.length + 1);
  });
});
