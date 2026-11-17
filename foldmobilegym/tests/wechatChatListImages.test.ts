import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const fixtures = vi.hoisted(() => ({
  contacts: [{ wxid: 'hidden', isBlacklisted: true }],
  chats: [
    { id: 'normal', user: { wxid: 'normal', name: 'Synthetic normal', avatar: '/@app-assets/Wechat/avatars/a.jpg' }, messages: [] },
    { id: 'sticky', isSticky: true, user: { wxid: 'sticky', name: 'Synthetic sticky', avatar: '/@app-assets/Wechat/avatars/b.jpg' }, messages: [] },
    { id: 'hidden', user: { wxid: 'hidden', name: 'Synthetic hidden', avatar: '/@app-assets/Wechat/avatars/c.jpg' }, messages: [] },
  ],
}));
vi.mock('../apps/Wechat/state', () => ({ useWechatStore: (selector: (state: typeof fixtures) => unknown) => selector(fixtures) }));
vi.mock('../apps/Wechat/hooks/useWechatStrings', () => ({ useWechatStrings: () => ({ common_search: 'Search' }) }));
vi.mock('../apps/Wechat/hooks/useWechatGestures', () => ({
  useWechatGestures: () => ({ bindTap: (id: string, options?: { params?: Record<string, string> }) => ({
    'data-trigger': id, ...(options?.params ? { 'data-trigger-params': JSON.stringify(options.params) } : {}),
  }) }),
}));
import ChatList from '../apps/Wechat/pages/ChatList';
const render = () => renderToStaticMarkup(React.createElement(ChatList));

describe('WeChat conversation identity images', () => {
  it('requests critical mounted avatars eagerly rather than deferring identity to lazy intersection', () => {
    const markup = render(), images = markup.match(/<img\b[^>]*>/g) ?? [];
    expect(images).toHaveLength(2);
    expect(images.every(image => image.includes('loading="eager"'))).toBe(true);
    expect(images.some(image => image.includes('loading="lazy"'))).toBe(false);
  });
  it('preserves exact source URLs and accessible identities; no replacement avatar data', () => {
    const markup = render();
    expect(markup).toContain('src="/@app-assets/Wechat/avatars/a.jpg"');
    expect(markup).toContain('alt="Synthetic normal"');
    expect(markup).toContain('src="/@app-assets/Wechat/avatars/b.jpg"');
    expect(markup).toContain('alt="Synthetic sticky"');
    expect(markup).not.toContain('c.jpg');
  });
  it('keeps existing sticky ordering, blacklist filtering and chat transition identities', () => {
    const markup = render();
    expect(markup.indexOf('alt="Synthetic sticky"')).toBeLessThan(markup.indexOf('alt="Synthetic normal"'));
    expect(markup).not.toContain('Synthetic hidden');
    expect(markup).toContain('data-trigger="chat.open"');
    expect(markup).toContain('&quot;id&quot;:&quot;sticky&quot;');
    expect(markup).toContain('&quot;id&quot;:&quot;normal&quot;');
  });
  it('does not mutate source contacts, conversation order or messages while rendering', () => {
    const before = structuredClone(fixtures);
    render(); render();
    expect(fixtures).toEqual(before);
  });
});
