import { describe, expect, it } from 'vitest';
import { patchSmsConversationDraft, smsConversationSourceKey } from '../system/Sms/conversationDrafts';
import { smsComposeParent, smsComposeBackFallback } from '../system/Sms/composeOverlay';
import type { Conversation } from '../system/Sms/types';
const source: Conversation = { id: 'a', sender: 'Same name', phoneNumber: '2025550123', timestamp: '09:00', isUnread: false };
describe('SMS conversation draft recipient ownership', () => {
  it('persists the complete number and body without changing the source', () => {
    expect(patchSmsConversationDraft(undefined, source, 'Prefix')).toEqual({ a: { sourceKey: smsConversationSourceKey(source), recipient: source.phoneNumber, body: 'Prefix' } });
    expect(source).not.toHaveProperty('body');
  });
  it('preserves all other drafts and supports one exact append and clearing', () => {
    const first = patchSmsConversationDraft({}, { ...source, id: 'b' }, 'Other');
    const next = patchSmsConversationDraft(first, source, 'Prefix + append');
    expect(next.b).toBe(first.b); expect(first).not.toHaveProperty('a');
    expect(patchSmsConversationDraft(next, source, '').a.body).toBe('');
  });
  it.each(['id', 'sender', 'phoneNumber'] as const)('distinguishes a changed %s, not merely a display name', field => {
    expect(smsConversationSourceKey({ ...source, [field]: 'different' })).not.toBe(smsConversationSourceKey(source));
  });
  it('does not rebind retained text to a replacement recipient', () => {
    const first = patchSmsConversationDraft({}, source, 'Protected');
    expect(patchSmsConversationDraft(first, { ...source, phoneNumber: '2025550198' }, 'Wrong')).toBe(first);
  });
  it('read/unread and message metadata changes preserve identity', () => {
    expect(smsConversationSourceKey({ ...source, isUnread: true, timestamp: '10:00', messageCount: 8 })).toBe(smsConversationSourceKey(source));
  });
  it('missing and explicit numbers cannot alias', () => {
    expect(smsConversationSourceKey({ ...source, phoneNumber: undefined })).not.toBe(smsConversationSourceKey(source));
  });
});
describe('SMS conversation attachment Back', () => {
  it('closes only the cold attachment layer on the same conversation', () => {
    expect(smsComposeParent('/conversation/a', '?panel=attachments')).toBe('/conversation/a');
    expect(smsComposeBackFallback('/conversation/a', '?panel=attachments', { pathname: '/', search: '' })).toBe('/conversation/a');
  });
  it('pops an actual matching parent but never a different conversation', () => {
    expect(smsComposeBackFallback('/conversation/a', '?panel=attachments', { pathname: '/conversation/a', search: '' })).toBeNull();
    expect(smsComposeBackFallback('/conversation/a', '?panel=attachments', { pathname: '/conversation/b', search: '' })).toBe('/conversation/a');
    expect(smsComposeParent('/conversation/a', '')).toBeNull();
  });
});
