import type {ChatSession, ContactItem, GroupMember, User} from '../types';

export function groupMember(chat: ChatSession, wxid: string): GroupMember | null {
  if (chat.kind !== 'group' || !Array.isArray(chat.group?.members)) return null;
  const matches = chat.group.members.filter(member => member.wxid === wxid);
  return matches.length === 1 ? matches[0] : null;
}

export function groupCount(chat: ChatSession): number | null {
  if (chat.kind !== 'group' || !Array.isArray(chat.group?.members)) return null;
  const ids = chat.group.members.map(member => member.wxid);
  if (!ids.length || ids.some(id => !id) || new Set(ids).size !== ids.length) return null;
  const count = chat.group.memberCount ?? ids.length;
  return Number.isSafeInteger(count) && count >= ids.length ? count : null;
}

/** Preserve the selected ID as well as the selected source object until submission. */
export function selectedContactSourcesValid(selected: ReadonlyMap<string, ContactItem>, contacts: ContactItem[], actorId: string): boolean {
  return [...selected.entries()].every(([id, contact]) => Boolean(id) && id === contact.wxid && id !== actorId
    && !contact.isBlacklisted && contacts.includes(contact) && contacts.filter(source => source.wxid === id).length === 1);
}
/** Local record only: no invitation, message, AI or account-service effect. */
export function makeLocalGroup(user: User, selected: ContactItem[], existing: ChatSession[], contacts: ContactItem[], now: number, fallbackName: string): ChatSession | null {
  if (!user.wxid || !Number.isFinite(now) || selected.length < 2) return null;
  const ids = selected.map(contact => contact.wxid);
  if (new Set(ids).size !== ids.length || selected.some(contact => !contact.wxid || contact.wxid === user.wxid || contact.isBlacklisted || !contacts.includes(contact) || contacts.filter(source => source.wxid === contact.wxid).length !== 1)) return null;
  const members = [user, ...selected].map(({wxid, name, avatar}) => ({wxid, name, avatar}));
  const used = new Set([user.wxid, ...contacts.map(contact => contact.wxid), ...existing.map(chat => chat.id), ...existing.flatMap(chat => chat.group?.members?.map(member => member.wxid) ?? [])]);
  const base = `local-group-${Math.floor(now)}`; let id = base, suffix = 0;
  while (used.has(id)) id = `${base}-${++suffix}`;
  return {id, kind: 'group', group: {members, memberCount: members.length}, createdAt: now,
    user: {wxid: id, name: members.map(member => member.name).filter(Boolean).join('、') || fallbackName, avatar: ''}, messages: []};
}
