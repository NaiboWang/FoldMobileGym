import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../os/createAppStore', async () => {
  const { createStore } = await import('zustand/vanilla');
  return { createAppStoreWithActions: (_id: string, initial: object, actions: (set: unknown) => object) =>
    createStore(set => ({ ...initial, ...actions(set) })), registerStateAdapter: vi.fn() };
});
import { useMailStore } from '../apps/Mail/state';
import { mailFolderRows } from '../apps/Mail/folders';
import { parseMailSearch, searchMail } from '../apps/Mail/search';
import type { Draft } from '../apps/Mail/types';
import { mailMessageMenuParent, hasMailMessageMenuParent } from '../apps/Mail/navigation';

const initial = useMailStore.getState();
beforeEach(() => useMailStore.setState(initial, true));
describe('Mail archive keeps original messages and reversible membership', () => {
  it('moves only a source relationship, not the original message or unrelated data', () => {
    const source = initial.messages[0], before = JSON.stringify(initial.messages);
    expect(initial.setArchived(source, true)).toBe(true);
    const current = useMailStore.getState();
    expect(current.archivedIds).toEqual([source.id]); expect(current.messages).toBe(initial.messages);
    expect(JSON.stringify(current.messages)).toBe(before); expect(current.drafts).toBe(initial.drafts);
    expect(current.starredIds).toBe(initial.starredIds); expect(current.verifiedIds).toBe(initial.verifiedIds);
    expect(current.editorBuffers).toBe(initial.editorBuffers); expect(current.replyInputs).toBe(initial.replyInputs);
    expect(current.draftInput).toBe(initial.draftInput);
  });
  it('restores the same original message to Inbox', () => {
    const source = initial.messages[0]; initial.setArchived(source, true);
    expect(initial.setArchived(source, false)).toBe(true); expect(useMailStore.getState().archivedIds).toEqual([]);
    expect(useMailStore.getState().messages[0]).toBe(source);
  });
  it('is idempotent rather than undoing a duplicate callback', () => {
    const source = initial.messages[0]; initial.setArchived(source, true); const before = useMailStore.getState();
    expect(initial.setArchived(source, true)).toBe(false); expect(useMailStore.getState()).toBe(before);
  });
  it('does not accept a caller copy of a source', () => {
    expect(initial.setArchived({ ...initial.messages[0] }, true)).toBe(false); expect(useMailStore.getState()).toBe(initial);
  });
  it('rejects removed sources without manufacturing an archived record', () => {
    const source = initial.messages[0]; useMailStore.setState({ messages: initial.messages.slice(1) }); const before = useMailStore.getState();
    expect(initial.setArchived(source, true)).toBe(false); expect(useMailStore.getState()).toBe(before);
  });
  it('rejects a same-ID replacement until its actual new source is selected', () => {
    const source = initial.messages[0], next = { ...source, body: 'A different live source' };
    useMailStore.setState({ messages: [next, ...initial.messages.slice(1)] }); const before = useMailStore.getState();
    expect(initial.setArchived(source, true)).toBe(false); expect(useMailStore.getState()).toBe(before);
    expect(initial.setArchived(next, true)).toBe(true);
  });
  it('rejects ambiguous duplicate IDs instead of hiding two different messages', () => {
    const source = initial.messages[0]; useMailStore.setState({ messages: [...initial.messages, { ...source, body: 'Other source with same id' }] });
    const before = useMailStore.getState(); expect(initial.setArchived(source, true)).toBe(false); expect(useMailStore.getState()).toBe(before);
  });
  it('accepts legacy persisted state with no archive relation', () => {
    useMailStore.setState({ archivedIds: undefined }); expect(initial.setArchived(initial.messages[0], true)).toBe(true);
    expect(useMailStore.getState().archivedIds).toEqual([initial.messages[0].id]);
  });
  it('does not clean unrelated relationship IDs as a side effect', () => {
    useMailStore.setState({ archivedIds: ['unrelated-legacy-id'] }); initial.setArchived(initial.messages[0], true);
    expect(useMailStore.getState().archivedIds).toEqual(['unrelated-legacy-id', initial.messages[0].id]);
  });
  it('does not change the active editor or selected reader as a store-side navigation side effect', () => {
    initial.open(initial.messages[1].id); const before = useMailStore.getState(); initial.setArchived(initial.messages[0], true);
    expect(useMailStore.getState().selectedId).toBe(before.selectedId); expect(useMailStore.getState().composeOpen).toBe(before.composeOpen);
  });
  it('preserves populated draft, recovery and reply buffers byte-for-byte', () => {
    const input = { to: 'local@example.invalid', subject: 'Unsent', body: 'Keep\nall authored text' };
    useMailStore.setState({ drafts: [{ id: 'local-draft', ...input }], draftInput: input,
      editorBuffers: { new: input }, replyInputs: { [initial.messages[0].id]: input }, verifiedIds: [initial.messages[0].id], starredIds: [initial.messages[0].id] });
    const before = useMailStore.getState(); initial.setArchived(initial.messages[0], true); const after = useMailStore.getState();
    for (const key of ['drafts', 'draftInput', 'editorBuffers', 'replyInputs', 'verifiedIds', 'starredIds'] as const) expect(after[key]).toBe(before[key]);
  });
});

describe('Mail archive projection and search use original identities', () => {
  const messages = initial.messages, archived = [messages[0].id];
  const drafts: Draft[] = [{ id: messages[0].id, to: 'local@example.invalid', subject: 'Unsent', body: 'Original draft' }];
  const hits = (query: string) => searchMail(messages, drafts, query, [messages[0].id], archived).hits.map(hit => `${hit.kind}:${hit.id}`);
  it('removes archived messages from Inbox, retains all mail, stars and same-ID drafts', () => {
    const inbox = mailFolderRows('inbox', messages, drafts, archived, archived);
    expect(inbox.messages).toEqual([messages[1]]); expect(inbox.messages[0]).toBe(messages[1]); expect(inbox.drafts).toBe(drafts);
    expect(mailFolderRows('all', messages, drafts, [], archived).messages).toBe(messages);
    expect(mailFolderRows('starred', messages, drafts, archived, archived).messages).toEqual([messages[0]]);
  });
  it('preserves the original Inbox array when there is no matching archived relation', () => {
    expect(mailFolderRows('inbox', messages, drafts).messages).toBe(messages);
    expect(mailFolderRows('inbox', messages, drafts, [], ['unknown']).messages).toBe(messages);
  });
  it('finds archived original messages with in:archive and never a same-ID draft', () => {
    expect(hits('in:archive')).toEqual([`message:${messages[0].id}`]);
    expect(hits('IN:ARCHIVE')).toEqual([`message:${messages[0].id}`]);
  });
  it('keeps archived messages in unqualified search and in:anywhere', () => {
    expect(hits('')).toHaveLength(3); expect(hits('in:anywhere')).toHaveLength(3);
  });
  it('makes in:inbox and its negative aware of actual membership', () => {
    expect(hits('in:inbox')).toEqual([`message:${messages[1].id}`]);
    expect(hits('-in:archive')).toEqual([`message:${messages[1].id}`, `draft:${drafts[0].id}`]);
  });
  it('combines archive with existing star and OR operators', () => {
    expect(hits('in:archive is:starred')).toEqual([`message:${messages[0].id}`]);
    expect(hits('in:archive OR in:drafts')).toEqual([`message:${messages[0].id}`, `draft:${drafts[0].id}`]);
  });
  it('does not infer archival state from subject/body text', () => {
    const source = { ...messages[0], subject: 'Archived message in words only' };
    expect(searchMail([source], [], 'in:archive').hits).toEqual([]);
  });
  it('keeps unavailable folders unavailable and quoted field text literal', () => {
    expect(parseMailSearch('in:trash').error).toBe('operator');
    expect(parseMailSearch('"in:archive"').groups).toEqual([[{ field: 'text', value: 'in:archive', negative: false }]]);
  });
});

describe('Mail More owns a removable URL layer', () => {
  it('removes only the menu and keeps query/source folder exactly', () => {
    expect(mailMessageMenuParent('/search/message/a', '?menu=message&q=hello+world&originFolder=all'))
      .toBe('/search/message/a?q=hello+world&originFolder=all');
  });
  it('recognizes semantically equal warm parents despite encoding/order differences', () => {
    expect(hasMailMessageMenuParent('/search/message/a', '?menu=message&q=hello+world&originFolder=all',
      { pathname: '/search/message/a', search: '?originFolder=all&q=hello%20world' })).toBe(true);
  });
  it('does not pop an unrelated source or query', () => {
    expect(hasMailMessageMenuParent('/search/message/a', '?menu=message&q=one', { pathname: '/search/message/b', search: '?q=one' })).toBe(false);
    expect(hasMailMessageMenuParent('/search/message/a', '?menu=message&q=one', { pathname: '/search/message/a', search: '?q=two' })).toBe(false);
  });
  it('provides a cold parent without inventing another reader', () => {
    expect(hasMailMessageMenuParent('/folder/all', '?menu=message')).toBe(false);
    expect(mailMessageMenuParent('/folder/all', '?menu=message')).toBe('/folder/all');
    expect(mailMessageMenuParent('/', '?menu=message')).toBe('/');
  });
});
