import {describe, expect, it} from 'vitest';
import defaults from '../apps/Wechat/data/defaults.json';
import type {ChatSession, ContactItem, User} from '../apps/Wechat/types';
import {groupCount, groupMember, makeLocalGroup} from '../apps/Wechat/utils/groupChat';

const user = defaults.user as unknown as User;
const contacts = defaults.contacts.filter(contact => contact.wxid !== user.wxid && !contact.isBlacklisted) as unknown as ContactItem[];
const make = (selected = contacts.slice(0, 2), existing: ChatSession[] = [], now = 1) => makeLocalGroup(user, selected, existing, contacts, now, 'Group');
describe('source-backed local group creation', () => {
  it('creates only actor and explicitly selected source members without mutating sources', () => {
    const before = JSON.stringify({user, contacts}), group = make()!;
    expect(groupCount(group)).toBe(3);
    expect(group.group?.members.map(member => member.wxid)).toEqual([user.wxid, contacts[0].wxid, contacts[1].wxid]);
    expect(group.messages).toEqual([]);
    expect(group.createdAt).toBe(1);
    expect(Object.keys(group.group!.members[0]).sort()).toEqual(['avatar', 'name', 'wxid']);
    expect(JSON.stringify({user, contacts})).toBe(before);
  });
  it('rejects empty, single, duplicate, replaced, self, and blacklisted sources', () => {
    for (const selected of [[], contacts.slice(0, 1), [contacts[0], contacts[0]], [{...contacts[0]}, contacts[1]], [{...contacts[0], wxid: user.wxid}, contacts[1]], [{...contacts[0], isBlacklisted: true}, contacts[1]]]) expect(make(selected)).toBeNull();
  });
  it('allocates noncolliding IDs even at the same simulated timestamp', () => {
    const first = make()!, second = make(contacts.slice(0, 2), [first])!;
    expect(second.id).not.toBe(first.id); expect(second.user.wxid).toBe(second.id);
    const collision = {...contacts[0], wxid: 'local-group-1'};
    expect(makeLocalGroup(user, contacts.slice(0, 2), [], [...contacts, collision], 1, '')!.id).not.toBe(collision.wxid);
  });
  it('rejects invalid clocks and an unidentified actor', () => {
    expect(make(undefined, [], NaN)).toBeNull(); expect(make(undefined, [], Infinity)).toBeNull();
    expect(makeLocalGroup({...user, wxid: ''}, contacts.slice(0, 2), [], contacts, 1, '')).toBeNull();
  });
  it('rejects duplicate source identities even when two distinct objects exist', () => {
    expect(makeLocalGroup(user, contacts.slice(0, 2), [], [...contacts, {...contacts[0]}], 1, '')).toBeNull();
  });
  it('never infers group identity/count from an ordinary chat name', () => {
    const direct = {id: 'direct', user: {...user, name: 'Group(426)'}, messages: []} as ChatSession;
    expect(groupCount(direct)).toBeNull(); expect(groupMember(direct, user.wxid)).toBeNull();
  });
  it('resolves exact sender IDs rather than same-name or group avatars', () => {
    const group = make()!, members = group.group!.members;
    expect(groupMember(group, members[1].wxid)).toEqual(members[1]);
    expect(groupMember(group, 'unknown')).toBeNull();
    members.push({...members[1]});
    expect(groupMember(group, members[1].wxid)).toBeNull(); expect(groupCount(group)).toBeNull();
  });
  it('accepts a larger count only when explicitly supplied by the source', () => {
    const group = make()!; group.group!.memberCount = 426; expect(groupCount(group)).toBe(426);
    for (const count of [2, -1, 3.5, Infinity]) {group.group!.memberCount = count; expect(groupCount(group)).toBeNull();}
    delete group.group!.memberCount; expect(groupCount(group)).toBe(3);
  });
});
