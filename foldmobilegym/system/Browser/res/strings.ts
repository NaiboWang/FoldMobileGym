/**
 * Browser 字符串资源 — 对应 AOSP res/values/strings.xml
 */
export const strings = {
  app_name: 'Chrome',

  // ── BrowserHome ──
  search_or_enter_url: '搜索或输入网址',

  // ── TabsOverlay ──
  tabs: '标签页',
  new_tab: '新标签页',

  // ── BrowserContent ──
  home_page: '主页',
  close_tab: '关闭标签页：{{title}}',
  close_tabs: '关闭标签页概览',
  go_back: '后退',
  go_forward: '前进',
  reload_page: '刷新网页',
  navigate_address: '前往网址',
  bookmark_add: '添加书签',
  bookmark_saved: '已保存书签',
} as const;

export type StringKey = keyof typeof strings;
