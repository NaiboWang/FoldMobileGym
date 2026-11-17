import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../os/createAppStore', async () => {
  const { createStore } = await import('zustand/vanilla');
  return { createAppStoreWithActions: (_id: string, initial: object, actions: (set: unknown) => object) => createStore(set => ({ ...initial, ...actions(set) })), registerStateAdapter: vi.fn() };
});
import { useMailStore } from '../apps/Mail/state';
import { canUseReplySurface, replyAddress, replyEditor, replySourceKey } from '../apps/Mail/replyDrafts';
import { mailReplyId, mailSearchBackFallback } from '../apps/Mail/searchRouting';
import { NAVIGATION_DECLARATION } from '../apps/Mail/navigation.declaration';
import type { Draft, Message } from '../apps/Mail/types';
const initial = useMailStore.getState();
const source: Message = { id: 'original', from: 'Review', senderAddress: 'review@lab.example', subject: 'Review confirmation', body: '14:30, Room 402', date: '2026-11-04' };
const ordinary: Draft = { id: 'ordinary', to: 'other@lab.example', subject: 'Other draft', body: 'Protected' };
const saved: Draft = { id: 'existing-reply', to: source.senderAddress!, subject: `Re: ${source.subject}`, body: 'Original prefix,', attachments: [{ id: 'file', path: '/sdcard/fixture.txt', createdAt: 42 }], replyTo: { messageId: source.id, sourceKey: replySourceKey(source) } };
const view = () => replyEditor(useMailStore.getState(), source.id);
const type = (body: string) => useMailStore.getState().updateReply(source.id, view().key, body);
beforeEach(() => { useMailStore.setState(initial, true); useMailStore.setState({ messages: [source], drafts: [ordinary] }); });
describe('source-bound Mail replies', () => {
  it('opens empty without creating a completed draft or changing ordinary compose', () => {
    const before = useMailStore.getState(); expect(view().input.body).toBe(''); expect(view().input.to).toBe(source.senderAddress);
    expect(view().available).toBe(true); expect(useMailStore.getState()).toBe(before);
    expect(useMailStore.getState().saveReply(source.id, view().key)).toBe(false);
    expect(useMailStore.getState().draftInput).toEqual(initial.draftInput);
  });
  it('preserves prefix, original attachments, subject and saved identity', () => {
    useMailStore.setState({ drafts: [ordinary, saved] }); type(saved.body + 'Confirmed 14:30, Room 402.');
    expect(useMailStore.getState().saveReply(source.id, view().key)).toBe(true);
    expect(useMailStore.getState().drafts).toEqual([ordinary, { ...saved, body: saved.body + 'Confirmed 14:30, Room 402.' }]);
    expect(useMailStore.getState().messages).toEqual([source]);
  });
  it('creates one actual reply and rejects a duplicate stale commit', () => {
    type('Confirmed'); const key = view().key;
    expect(useMailStore.getState().saveReply(source.id, key)).toBe(true);
    expect(useMailStore.getState().saveReply(source.id, key)).toBe(false);
    expect(useMailStore.getState().drafts).toHaveLength(2);
    const id = view().draft!.id; type('Updated'); expect(useMailStore.getState().saveReply(source.id, view().key)).toBe(true);
    expect(view().draft!.id).toBe(id); expect(useMailStore.getState().drafts).toHaveLength(2);
  });
  it('does not overwrite a newer pending input with an old callback', () => {
    const old = view().key; type('Current'); useMailStore.getState().updateReply(source.id, old, 'Stale');
    expect(view().input.body).toBe('Current');
  });
  it.each(['id', 'from', 'senderAddress', 'subject', 'date', 'body'] as const)('rejects changed source %s and retains unsaved text', field => {
    type('Unfinished'); useMailStore.setState({ messages: [{ ...source, [field]: 'Changed' }] });
    expect(view().available).toBe(false); expect(useMailStore.getState().saveReply(source.id, view().key)).toBe(false);
    expect(useMailStore.getState().replyInputs![source.id].body).toBe('Unfinished'); expect(useMailStore.getState().drafts).toEqual([ordinary]);
  });
  it('rejects removed or replaced saved drafts', () => {
    useMailStore.setState({ drafts: [ordinary, saved] }); type('Pending');
    useMailStore.setState({ drafts: [ordinary, { ...saved, body: 'New external version' }] });
    expect(view().available).toBe(false); expect(useMailStore.getState().saveReply(source.id, view().key)).toBe(false);
    useMailStore.setState({ drafts: [ordinary] }); expect(view().available).toBe(false);
    expect(useMailStore.getState().saveReply(source.id, view().key)).toBe(false);
  });
  it('refuses to silently adopt a reply that appeared during a new pending draft', () => {
    type('Pending new'); useMailStore.setState({ drafts: [ordinary, saved] }); expect(view().available).toBe(false);
  });
  it('does not choose between multiple replies or permit generic compose to strip binding', () => {
    useMailStore.setState({ drafts: [ordinary, saved] }); const before = useMailStore.getState();
    useMailStore.getState().openDraft(saved.id); expect(useMailStore.getState()).toBe(before);
    useMailStore.setState({ drafts: [saved, { ...saved, id: 'duplicate' }] }); expect(view().status).toBe('ambiguous');
    expect(useMailStore.getState().saveReply(source.id, view().key)).toBe(false);
  });
  it('retains complete pending reply through JSON and initializes reset field as undefined', () => {
    useMailStore.setState({ drafts: [ordinary, saved] }); type('Pending');
    const inputs = JSON.parse(JSON.stringify(useMailStore.getState().replyInputs)); useMailStore.setState({ replyInputs: inputs });
    expect(view().available).toBe(true); expect(view().input.body).toBe('Pending'); expect(initial.replyInputs).toBeUndefined();
  });
  it.each([undefined, '', 'Display Name', 'person@invalid', 'a@b.example\r\nBcc:other@b.example'])('never invents an address from %s', senderAddress => {
    expect(replyAddress({ ...source, senderAddress })).toBeNull();
  });
  it('accepts only the explicitly provided trimmed address', () => expect(replyAddress({ ...source, senderAddress: ' review@lab.example ' })).toBe('review@lab.example'));
});
describe('reply parent navigation', () => {
  it('requires an actual reader before starting a reply rather than a fictitious search-list shortcut', () => {
    expect(NAVIGATION_DECLARATION.transitions.find(item => item.id === 'mail.search.reply.open')?.from).toBe('/search/message/:messageId');
  });
  it('revokes interaction under Recents/Home and for a foreign Activity', () => {
    expect(canUseReplySurface(true, {})).toBe(true);
    expect(canUseReplySurface(true, { isRecentsVisible: true })).toBe(false);
    expect(canUseReplySurface(true, { isLauncherVisible: true })).toBe(false);
    expect(canUseReplySurface(false, {})).toBe(false); expect(canUseReplySurface(true)).toBe(false);
  });
  it('decodes identity once and rejects malformed input', () => {
    expect(mailReplyId('/reply/%E4%B8%AD%2F%252F')).toBe('中/%2F'); expect(mailReplyId('/reply/%bad')).toBe(''); expect(mailReplyId('/')).toBeNull();
  });
  it('reconstructs cold original reader and preserves warm inbox history', () => {
    expect(mailSearchBackFallback('/reply/a', '')).toBe('/');
    expect(mailSearchBackFallback('/reply/a', '', { pathname: '/', search: '' })).toBeNull();
  });
  it('reconstructs cold search reader and pops its actual warm query', () => {
    expect(mailSearchBackFallback('/reply/a', '?origin=search&q=Review')).toBe('/search/message/a?q=Review');
    expect(mailSearchBackFallback('/reply/a', '?origin=search&q=Review', { pathname: '/search/message/a', search: '?q=Review' })).toBeNull();
  });
  it('keeps draft-list search separate from a source reader parent', () => {
    expect(mailSearchBackFallback('/reply/a', '?origin=draftSearch&q=Review')).toBe('/search?q=Review');
    expect(mailSearchBackFallback('/reply/a', '?origin=draftSearch&q=Review', { pathname: '/search', search: '?q=Review' })).toBeNull();
  });
});
