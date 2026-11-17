import { describe, expect, it } from 'vitest';
import { mailtoEditor, saveMailto, updateMailto } from '../apps/Mail/mailtoDrafts';

const initial = { drafts: [] };

describe('independent mailto draft buffers', () => {
  it('accepts only a supplied mailbox and keeps the ordinary draft store separate', () => {
    const view = mailtoEditor(initial, '  person@example.invalid ');
    expect(view.address).toBe('person@example.invalid');
    expect(view.input).toEqual({ to: 'person@example.invalid', subject: '', body: '' });
    expect(updateMailto(initial, view.address!, view.key, { body: 'Local body' })?.mailtoInputs?.[view.address!]?.body).toBe('Local body');
    expect(initial.drafts).toEqual([]);
  });

  it('rejects stale callbacks and incomplete saves', () => {
    const view = mailtoEditor(initial, 'person@example.invalid');
    expect(updateMailto(initial, view.address!, JSON.stringify(['stale']), { body: 'ignored' })).toBeNull();
    const pending = updateMailto(initial, view.address!, view.key, { subject: 'Subject' })!;
    const state = { ...initial, ...pending };
    expect(saveMailto(state, view.address!, mailtoEditor(state, view.address!).key)).toBeNull();
  });

  it('saves once, updates the same draft, and refuses duplicate stale commits', () => {
    const view = mailtoEditor(initial, 'person@example.invalid');
    const state = { ...initial, ...updateMailto(initial, view.address!, view.key, { subject: 'Subject', body: 'Body' }) };
    const saveKey = mailtoEditor(state, view.address!).key;
    const patch = saveMailto(state, view.address!, saveKey)!;
    expect(patch.drafts).toEqual([{ id: 'draft-1', to: 'person@example.invalid', subject: 'Subject', body: 'Body' }]);
    const saved = { ...state, ...patch };
    expect(saveMailto(saved, view.address!, saveKey)).toBeNull();
    const changed = { ...saved, ...updateMailto(saved, view.address!, mailtoEditor(saved, view.address!).key, { body: 'Updated' }) };
    const update = saveMailto(changed, view.address!, mailtoEditor(changed, view.address!).key)!;
    expect(update.drafts).toEqual([{ id: 'draft-1', to: 'person@example.invalid', subject: 'Subject', body: 'Updated' }]);
  });

  it.each(['', 'Display Name', 'person@invalid', 'person@example.invalid\r\nBcc:other@example.invalid'])('rejects unsafe or incomplete mailbox %s', value => {
    expect(mailtoEditor(initial, value).address).toBeNull();
  });

  it('retains pending text and refuses to overwrite a removed or replaced saved draft', () => {
    const recipient = 'person@example.invalid';
    const ready = { ...initial, ...updateMailto(initial, recipient, mailtoEditor(initial, recipient).key, { subject: 'Subject', body: 'Body' }) };
    const saved = { ...ready, ...saveMailto(ready, recipient, mailtoEditor(ready, recipient).key) };
    const pending = { ...saved, ...updateMailto(saved, recipient, mailtoEditor(saved, recipient).key, { body: 'Pending text' }) };
    for (const drafts of [[], [{ ...pending.drafts![0], body: 'Newer source version' }], [pending.drafts![0], pending.drafts![0]]]) {
      const changed = { ...pending, drafts };
      expect(mailtoEditor(changed, recipient).available).toBe(false);
      expect(saveMailto(changed, recipient, mailtoEditor(changed, recipient).key)).toBeNull();
      expect(mailtoEditor(changed, recipient).input.body).toBe('Pending text');
    }
  });

  it('preserves separate recipients through a JSON round trip', () => {
    const recipient = 'person@example.invalid', other = 'other@example.invalid';
    const first = { ...initial, ...updateMailto(initial, recipient, mailtoEditor(initial, recipient).key, { body: 'First buffer' }) };
    const second = { ...first, ...updateMailto(first, other, mailtoEditor(first, other).key, { body: 'Second buffer' }) };
    const restored = JSON.parse(JSON.stringify(second));
    expect(mailtoEditor(restored, recipient).input.body).toBe('First buffer');
    expect(mailtoEditor(restored, other).input.body).toBe('Second buffer');
  });
});
