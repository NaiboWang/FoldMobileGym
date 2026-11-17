import type { Draft, Message, ReplyInput } from './types';
export function canUseReplySurface(ownsActivity: boolean, state?: { isLauncherVisible?: boolean; isRecentsVisible?: boolean }) {
  return ownsActivity && !!state && !state.isLauncherVisible && !state.isRecentsVisible;
}

export function replyAddress(message: Message | undefined): string | null {
  const value = message?.senderAddress?.trim();
  return value && /^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(value) ? value : null;
}
/** Exact version token, not a cryptographic hash or a new source of message facts. */
export const replySourceKey = (message: Message) => JSON.stringify([
  message.id, message.from, message.senderAddress ?? null, message.subject, message.date, message.body,
]);
type ReplyState = { messages: Message[]; drafts: Draft[]; replyInputs?: Record<string, ReplyInput> };
export function replyEditor(state: ReplyState, messageId: string) {
  const source = state.messages.find(message => message.id === messageId);
  const address = replyAddress(source);
  const saved = state.drafts.filter(draft => draft.replyTo?.messageId === messageId);
  const draft = saved.length === 1 ? saved[0] : undefined;
  const buffer = state.replyInputs?.[messageId];
  const input: ReplyInput = buffer ?? {
    to: draft?.to ?? address ?? '', subject: draft?.subject ?? (source ? `Re: ${source.subject}` : ''),
    body: draft?.body ?? '',
    ...(draft?.attachments !== undefined ? { attachments: draft.attachments.map(ref => ({ ...ref })) } : {}),
    ...(draft ? { draftId: draft.id, draftKey: JSON.stringify(draft) } : {}),
    replyTo: draft?.replyTo ?? { messageId, sourceKey: source ? replySourceKey(source) : '' },
  };
  const status = !source ? 'missing' : !address ? 'address' : saved.length > 1 ? 'ambiguous'
    : input.replyTo?.messageId !== messageId || input.replyTo.sourceKey !== replySourceKey(source)
      || input.to !== address || (input.draftId && (draft?.id !== input.draftId || input.draftKey !== JSON.stringify(draft)))
      || (buffer && !input.draftId && !!draft)
      ? 'changed' : 'ready';
  return { source, draft, input, status, available: status === 'ready', key: JSON.stringify(input) };
}
