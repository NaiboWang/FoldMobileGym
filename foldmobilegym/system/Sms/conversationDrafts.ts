import type { Conversation } from './types';

export interface SmsConversationDraft { sourceKey: string; recipient: string; body: string }
// Read/unread and incoming messages do not change recipient identity.
export const smsConversationSourceKey = (source: Conversation) =>
  JSON.stringify([source.id, source.sender, source.phoneNumber ?? null]);

export function patchSmsConversationDraft(
  drafts: Record<string, SmsConversationDraft> | undefined,
  source: Conversation, body: string,
): Record<string, SmsConversationDraft> {
  const current = drafts ?? {}, sourceKey = smsConversationSourceKey(source);
  if (current[source.id] && current[source.id].sourceKey !== sourceKey) return current;
  return { ...current, [source.id]: { sourceKey, recipient: source.phoneNumber ?? '', body } };
}
