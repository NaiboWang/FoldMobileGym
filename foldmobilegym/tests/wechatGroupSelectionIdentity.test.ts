import { describe, expect, it } from 'vitest';
import defaults from '../apps/Wechat/data/defaults.json';
import type { ContactItem } from '../apps/Wechat/types';
import { selectedContactSourcesValid } from '../apps/Wechat/utils/groupChat';

describe('group picker source identity', () => {
  it('rejects a selected contact whose ID is mutated in place before submission', () => {
    const contact = { ...defaults.contacts[0] } as ContactItem;
    const originalId = contact.wxid;
    const contacts = [contact];
    const selection = new Map([[originalId, contact]]);
    expect(selectedContactSourcesValid(selection, contacts, 'synthetic-actor')).toBe(true);
    contact.wxid = 'synthetic-different-id';
    expect(selectedContactSourcesValid(selection, contacts, 'synthetic-actor')).toBe(false);
  });
  it('rejects missing, duplicate, blocked and self sources', () => {
    const contact = { ...defaults.contacts[0] } as ContactItem;
    const selection = new Map([[contact.wxid, contact]]);
    expect(selectedContactSourcesValid(selection, [], 'synthetic-actor')).toBe(false);
    expect(selectedContactSourcesValid(selection, [contact, { ...contact }], 'synthetic-actor')).toBe(false);
    expect(selectedContactSourcesValid(selection, [contact], contact.wxid)).toBe(false);
    contact.isBlacklisted = true;
    expect(selectedContactSourcesValid(selection, [contact], 'synthetic-actor')).toBe(false);
  });
});