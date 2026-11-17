import type { Draft, Message } from './types';
export type MailFolder = 'inbox' | 'starred' | 'drafts' | 'all';
export const isMailFolder = (value: string | null | undefined): value is MailFolder =>
  value === 'inbox' || value === 'starred' || value === 'drafts' || value === 'all';
export function mailFolderFromPath(pathname: string): MailFolder | null {
  if (!pathname.startsWith('/folder/')) return 'inbox';
  const match = /^\/folder\/([^/]+)$/.exec(pathname);
  return match && isMailFolder(match[1]) && match[1] !== 'inbox' ? match[1] : null;
}
export const mailFolderParent = (value: string | null | undefined) =>
  isMailFolder(value) && value !== 'inbox' ? `/folder/${value}` : '/';
export function mailFolderRows(folder: MailFolder, messages: Message[], drafts: Draft[], starredIds: readonly string[] = [], archivedIds: readonly string[] = []) {
  const archived = new Set(archivedIds);
  const inbox = messages.some(message => archived.has(message.id)) ? messages.filter(message => !archived.has(message.id)) : messages;
  return {
    messages: folder === 'drafts' ? [] : folder === 'starred' ? messages.filter(message => starredIds.includes(message.id)) : folder === 'inbox' ? inbox : messages,
    drafts: folder === 'drafts' || folder === 'inbox' ? drafts : [],
  };
}
