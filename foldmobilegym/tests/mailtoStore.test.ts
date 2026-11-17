import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../os/createAppStore', async () => {
  const { createStore } = await import('zustand/vanilla');
  return { createAppStoreWithActions: (_id: string, initial: object, actions: (set: unknown) => object) =>
    createStore(set => ({ ...initial, ...actions(set) })), registerStateAdapter: vi.fn() };
});
import { useMailStore } from '../apps/Mail/state';
import { mailtoEditor } from '../apps/Mail/mailtoDrafts';
const initial = useMailStore.getState(), recipient = 'person@example.invalid';
beforeEach(() => useMailStore.setState(initial, true));

describe('mailto store integration', () => {
  it('keeps the active ordinary compose and recovery/reply buffers untouched', () => {
    const ordinary = { to: 'existing@example.invalid', subject: 'Original subject', body: 'Original body' };
    useMailStore.setState({ composeOpen: true, draftInput: ordinary, editorBuffers: { new: ordinary }, replyInputs: { reply: ordinary } });
    const before = useMailStore.getState();
    before.updateMailto(recipient, mailtoEditor(before, recipient).key, { subject: 'Local subject', body: 'Local body' });
    const pending = useMailStore.getState();
    expect(pending.saveMailto(recipient, mailtoEditor(pending, recipient).key)).toBe(true);
    const after = useMailStore.getState();
    for (const field of ['composeOpen', 'draftInput', 'editorBuffers', 'replyInputs', 'selectedId', 'editingDraftId', '_temp', 'messages'] as const) expect(after[field]).toBe(before[field]);
    expect(after.drafts).toHaveLength(1);
    expect(after.drafts[0].to).toBe(recipient);
  });

  it('does not write stale input callbacks and exposes an explicit reset value', () => {
    expect(initial.mailtoInputs).toBeUndefined();
    const before = mailtoEditor(initial, recipient);
    initial.updateMailto(recipient, before.key, { body: 'Current' });
    initial.updateMailto(recipient, before.key, { body: 'Stale' });
    expect(mailtoEditor(useMailStore.getState(), recipient).input.body).toBe('Current');
    useMailStore.setState(initial, true);
    expect(useMailStore.getState().mailtoInputs).toBeUndefined();
  });
});
