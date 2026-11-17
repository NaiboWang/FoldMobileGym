import type { StringKey } from './strings';

export const stringsEn: Partial<Record<StringKey, string>> = {
  app_name: 'Google Chrome',

  // ── BrowserHome ──
  search_or_enter_url: 'Search or enter URL',

  // ── TabsOverlay ──
  tabs: 'Tabs',
  new_tab: 'New Tab',

  // ── BrowserContent ──
  home_page: 'Home',
  close_tab: 'Close tab: {{title}}',
  close_tabs: 'Close tab overview',
  go_back: 'Back',
  go_forward: 'Forward',
  reload_page: 'Reload page',
  navigate_address: 'Go to address',
  bookmark_add: 'Add bookmark',
  bookmark_saved: 'Bookmark saved',
};
