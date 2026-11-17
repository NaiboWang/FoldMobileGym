import { describe, expect, it } from 'vitest';
import { selectedSmsConversationId } from '../system/Sms/workspaceSelection';
import type { Conversation } from '../system/Sms/types';
const sources: readonly Conversation[] = Object.freeze([
  Object.freeze({ id: 'alpha', sender: 'Synthetic Alpha', timestamp: '09:00', isUnread: false }),
  Object.freeze({ id: 'a/b %', sender: 'Synthetic special ID', timestamp: '09:01', isUnread: false }),
]);
describe('SMS workspace selection follows the visible conversation', () => {
  it.each(['/', '/new', '/settings', '/newer', '/conversation/', '/conversation/missing', '/conversation/%ZZ', '/conversation/alpha/extra'])(
    'does not select the first source for %s', pathname => {
      expect(selectedSmsConversationId(pathname, sources)).toBeUndefined();
    },
  );
  it('selects the exact current source and respects encoded IDs', () => {
    expect(selectedSmsConversationId('/conversation/alpha', sources)).toBe('alpha');
    expect(selectedSmsConversationId('/conversation/' + encodeURIComponent('a/b %'), sources)).toBe('a/b %');
  });
  it('does not retain selection after source removal or reorder', () => {
    expect(selectedSmsConversationId('/conversation/alpha', sources.slice(1))).toBeUndefined();
    expect(selectedSmsConversationId('/conversation/alpha', [...sources].reverse())).toBe('alpha');
    expect(selectedSmsConversationId('/', [])).toBeUndefined();
  });
});
