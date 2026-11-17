import type { ChatSession, Message } from '../types';
/** Keep all original IDs; allocate only the new outgoing identities against the full current corpus. */
export function ownOutgoingMessageIds(chats: readonly ChatSession[], messages: readonly Message[]): Message[] {
  const used = new Set(chats.flatMap(chat => (chat.messages ?? []).map(message => message.id)));
  return messages.map(message => {
    let id = message.id, suffix = 0;
    while (used.has(id)) id = `${message.id}_${++suffix}`;
    used.add(id);
    return id === message.id ? message : { ...message, id };
  });
}
