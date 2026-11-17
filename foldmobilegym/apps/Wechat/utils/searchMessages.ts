import type { ChatSession, Message } from '../types';

// Search displayed content, never image URLs, system notices or storage paths.
export function messageSearchText(message: Message): string | null {
  if (message.type === 'text') return message.content;
  if (message.type === 'file') return message.fileName || null;
  return null;
}

export function findMatchingChatMessages(chats: ChatSession[], query: string, blockedIds: ReadonlySet<string>) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  return chats.flatMap(chat => {
    if (blockedIds.has(chat.id)) return [];
    const matches = chat.messages.filter(message => messageSearchText(message)?.toLowerCase().includes(needle));
    if (!matches.length) return [];
    const latest = matches.reduce((a, b) => a.timestamp >= b.timestamp ? a : b);
    return [{ chat, count: matches.length, preview: messageSearchText(latest)!, timestamp: latest.timestamp }];
  }).sort((a, b) => b.timestamp - a.timestamp);
}

export function splitSearchMatches(text: string, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [{ text, matched: false }];
  const normalized = text.toLowerCase();
  const parts: { text: string; matched: boolean }[] = [];
  let offset = 0;
  let index = normalized.indexOf(needle);
  while (index !== -1) {
    if (index > offset) parts.push({ text: text.slice(offset, index), matched: false });
    parts.push({ text: text.slice(index, index + needle.length), matched: true });
    offset = index + needle.length;
    index = normalized.indexOf(needle, offset);
  }
  if (offset < text.length) parts.push({ text: text.slice(offset), matched: false });
  return parts;
}
