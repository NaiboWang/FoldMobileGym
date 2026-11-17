import type { Conversation } from './types';

/** A row is current only when the foreground detail resolves to that exact source. */
export function selectedSmsConversationId(pathname: string, conversations: readonly Conversation[]): string | undefined {
  const match = /^\/conversation\/([^/]+)$/.exec(pathname);
  if (!match) return undefined;
  try {
    const id = decodeURIComponent(match[1]);
    return conversations.some(conversation => conversation.id === id) ? id : undefined;
  } catch {
    return undefined;
  }
}
