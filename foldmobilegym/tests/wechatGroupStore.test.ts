import {afterEach, describe, expect, it, vi} from 'vitest';
vi.mock('../os/AIService', () => ({}));
import {useWechatStore} from '../apps/Wechat/state';
import {groupCount, groupMember} from '../apps/Wechat/utils/groupChat';
const initial = useWechatStore.getState();
const members = initial.contacts.filter(contact => !contact.isBlacklisted && contact.wxid !== initial.user.wxid).slice(0, 2);
describe('local group actual store boundary', () => {
  afterEach(() => useWechatStore.setState(initial, true));
  it('only appends a group, preserves source chats/contacts/drafts/settings and never sends', () => {
    const id = initial.createLocalGroup(members, initial.user.wxid, 'Group')!;
    const after = useWechatStore.getState(), group = after.chats.find(chat => chat.id === id)!;
    expect(group.kind).toBe('group'); expect(group.messages).toEqual([]); expect(group.group!.memberCount).toBe(3);
    expect(after.chats.slice(0, -1)).toEqual(initial.chats);
    for (const key of Object.keys(initial) as Array<keyof typeof initial>) if (key !== 'chats') expect(after[key]).toBe(initial[key]);
  });
  it('rejects a foreign actor, stale contact, single selection and logged-out session with no state write', () => {
    expect(initial.createLocalGroup(members, 'foreign', 'Group')).toBeNull();
    expect(initial.createLocalGroup([{...members[0]}, members[1]], initial.user.wxid, 'Group')).toBeNull();
    expect(initial.createLocalGroup(members.slice(0, 1), initial.user.wxid, 'Group')).toBeNull();
    expect(useWechatStore.getState()).toBe(initial);
    useWechatStore.setState({auth: {...initial.auth, session: {...initial.auth.session, loggedIn: false}}});
    const loggedOut = useWechatStore.getState();
    expect(loggedOut.createLocalGroup(members, loggedOut.user.wxid, 'Group')).toBeNull(); expect(useWechatStore.getState()).toBe(loggedOut);
  });
  it('retains group metadata when a synthetic local text is subsequently appended', () => {
    const id = initial.createLocalGroup(members, initial.user.wxid, 'Group')!;
    const group = useWechatStore.getState().chats.find(chat => chat.id === id)!;
    useWechatStore.getState().sendMessage(id, 'Synthetic unit test text');
    const updated = useWechatStore.getState().chats.find(chat => chat.id === id)!;
    expect(updated.group).toEqual(group.group); expect(updated.kind).toBe('group'); expect(updated.createdAt).toBe(group.createdAt);
    expect(updated.messages.some(message => message.content === 'Synthetic unit test text')).toBe(true);
  });
  it('keeps distinct source IDs when selected contacts have identical display names', () => {
    const sameName = members.map(member => ({...member, name: 'Synthetic same-name peer'}));
    useWechatStore.setState({contacts: sameName});
    const id = useWechatStore.getState().createLocalGroup(sameName, initial.user.wxid, 'Group')!;
    const group = useWechatStore.getState().chats.find(chat => chat.id === id)!;
    expect(groupCount(group)).toBe(3);
    expect(group.group!.members.slice(1).map(member => member.wxid)).toEqual(members.map(member => member.wxid));
    expect(groupMember(group, members[0].wxid)?.avatar).toBe(members[0].avatar);
    expect(groupMember(group, members[1].wxid)?.avatar).toBe(members[1].avatar);
  });
  it('rejects a removed selected source without substituting another available contact', () => {
    useWechatStore.setState({contacts: initial.contacts.filter(contact => contact !== members[0])});
    const before = useWechatStore.getState();
    expect(before.createLocalGroup(members, before.user.wxid, 'Group')).toBeNull();
    expect(useWechatStore.getState()).toBe(before);
  });
  it('rejects a selected peer replaced by a blacklisted source with the same ID', () => {
    useWechatStore.setState({contacts: initial.contacts.map(contact => contact === members[0] ? {...contact, isBlacklisted: true} : contact)});
    const before = useWechatStore.getState();
    expect(before.createLocalGroup(members, before.user.wxid, 'Group')).toBeNull();
    const blacklisted = before.contacts.find(contact => contact.wxid === members[0].wxid)!;
    expect(before.createLocalGroup([blacklisted, members[1]], before.user.wxid, 'Group')).toBeNull();
    expect(useWechatStore.getState()).toBe(before);
  });
  it('rejects a stale selected object even if a replacement retains its ID and display name', () => {
    useWechatStore.setState({contacts: initial.contacts.map(contact => contact === members[0] ? {...contact} : contact)});
    const before = useWechatStore.getState();
    expect(before.createLocalGroup(members, before.user.wxid, 'Group')).toBeNull();
    expect(useWechatStore.getState()).toBe(before);
  });
  it('rejects the prior actor after an account change', () => {
    useWechatStore.setState({user: {...initial.user, wxid: 'synthetic-new-actor'}});
    const before = useWechatStore.getState();
    expect(before.createLocalGroup(members, initial.user.wxid, 'Group')).toBeNull();
    expect(useWechatStore.getState()).toBe(before);
  });
  it('preserves member identity/count and creation metadata through the actual persistence partializer', () => {
    const id = initial.createLocalGroup(members, initial.user.wxid, 'Group')!;
    const state = useWechatStore.getState();
    const partialize = useWechatStore.persist.getOptions().partialize!;
    const persisted = JSON.parse(JSON.stringify(partialize(state)));
    const restored = persisted.chats.find((chat: {id: string}) => chat.id === id);
    expect(restored).toEqual(state.chats.find(chat => chat.id === id));
    expect(groupCount(restored)).toBe(3);
    expect(groupMember(restored, members[1].wxid)?.wxid).toBe(members[1].wxid);
    expect(persisted.contacts).toEqual(initial.contacts);
    expect(persisted.chatDrafts).toEqual(initial.chatDrafts);
    expect(persisted.sendCount).toBe(initial.sendCount);
    expect('createLocalGroup' in persisted).toBe(false);
  });
});
