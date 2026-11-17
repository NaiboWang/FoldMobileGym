import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockContacts = [
  { wxid: 'wxid_a', name: 'Alice', avatar: '/alice.png', category: 'A', isBlacklisted: false },
  { wxid: 'wxid_b', name: 'Bob', avatar: '/bob.png', category: 'B', isBlacklisted: false },
  { wxid: 'wxid_c', name: 'Carol', avatar: '/carol.png', category: 'C', isBlacklisted: true },
];

vi.mock('../apps/Wechat/hooks/useWechatStrings', () => ({
  useWechatStrings: () => ({
    contacts_new_friend: '新的朋友',
    contacts_group_chat: '群聊',
    contacts_tags: '标签',
    contacts_official_accounts: '公众号',
    contacts_count_suffix: '位联系人',
    contacts_index: '联系人分组索引',
    contacts_index_top: '回到通讯录顶部',
    contacts_index_jump: '跳转到 {{letter}} 组',
  }),
}));

vi.mock('../apps/Wechat/hooks/useChatEntryOwner', () => ({useChatEntryOwner: () => () => true}));
vi.mock('react-router-dom', () => ({useLocation: () => ({pathname: '/contacts', search: ''})}));

vi.mock('../apps/Wechat/hooks/useWechatGestures', () => ({
  useWechatGestures: () => ({
    bindTap: () => ({}),
  }),
}));

vi.mock('../apps/Wechat/state', () => ({
  useWechatStore: (selector: (state: { contacts: typeof mockContacts }) => unknown) =>
    selector({ contacts: mockContacts }),
}));

describe('Wechat Contacts 布局', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('字母索引栏位于滚动容器之外，避免跟随列表一起滚动', async () => {
    const { default: Contacts } = await import('../apps/Wechat/pages/Contacts');

    const markup = renderToStaticMarkup(React.createElement(Contacts));

    expect(markup).toContain('data-scroll-container="main"');
    expect(markup).toContain('2位联系人');
    expect(markup).toContain('2位联系人</div></div><nav class="wechat-contact-index" aria-label="联系人分组索引">');
    expect(markup).toContain('data-contact-index="A" aria-label="跳转到 A 组"');
    expect(markup).toContain('data-contact-index="C" disabled=""');
    expect(markup).toContain('wechat-contact-avatar');
    expect(markup).toContain('wechat-contact-name');
  });
});
