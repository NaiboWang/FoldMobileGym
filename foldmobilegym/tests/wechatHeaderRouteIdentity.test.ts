import {describe, expect, it} from 'vitest';
import {headerRouteIdentity} from '../apps/Wechat/utils/headerRouteIdentity';
import {replaceParams} from '../apps/Wechat/navigation';
describe('WeChat header URL identity', () => {
  for (const kind of ['chat', 'user-profile', 'friend-settings'] as const) {
    it.each(['ordinary', 'info', 'source /%2F ?#', 'literal %252F', '联系人'])('decodes one %s source exactly once for ' + kind, id => {
      expect(headerRouteIdentity(`/${kind}/${encodeURIComponent(id)}`, kind)).toBe(id);
    });
    it('does not accept malformed, nested or foreign routes for ' + kind, () => {
      for (const route of [`/${kind}/`, `/${kind}/%XX`, `/${kind}/peer/info`, `/${kind}/peer/chat-search`, '/contacts']) {
        expect(headerRouteIdentity(route, kind)).toBeNull();
      }
    });
  }
  it('decodes the explicit chat-info segment without consuming nested pages', () => {
    const id = 'peer /%2F ?#';
    expect(headerRouteIdentity('/chat/' + encodeURIComponent(id) + '/info', 'chat', 'info')).toBe(id);
    expect(headerRouteIdentity('/chat/' + encodeURIComponent(id) + '/info/extra', 'chat', 'info')).toBeNull();
  });
  it('encodes each outgoing path operand exactly once, never as path/query syntax', () => {
    const id = 'peer /%2F ?#';
    expect(replaceParams('/chat/:id/info', {id})).toBe('/chat/' + encodeURIComponent(id) + '/info');
    expect(replaceParams('/chat/:id', {id: 42})).toBe('/chat/42');
    expect(() => replaceParams('/chat/:id', {})).toThrow('Missing param');
  });
});
