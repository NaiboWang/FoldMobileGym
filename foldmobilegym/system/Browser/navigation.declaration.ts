import type { NavigationDeclaration } from './navigation.types';

const MAIN_SCROLL = [
  { name: 'main', direction: 'vertical', description: '页面主内容区' },
  { name: 'tabs', direction: 'horizontal', description: '展开态标签栏' },
  { name: 'overview', direction: 'vertical', description: '标签页概览' },
] as const;

export const NAVIGATION_DECLARATION = {
  app: 'browser',
  routes: [
    {
      path: '/',
      component: 'BrowserHome',
      params: {},
      entryPoint: 'home',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'browser.home.base', search: {}, description: '浏览器首页', actions: [{ id: 'browser.home.reload', label: '刷新当前首页', behavior: 'other', scope: 'item', paramsSchema: { tabId: 'string', url: 'string' } }] }, { id: 'browser.home.tabs', search: { panel: 'tabs' }, description: '首页标签页概览' }],
      queryParams: {},
      description: '浏览器首页',
    },
    {
      path: '/view',
      component: 'BrowserView',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'browser.view.base', search: {}, description: '网页浏览页', actions: [
        { id: 'browser.page.reload', label: '刷新当前网页', behavior: 'other', scope: 'item', paramsSchema: { tabId: 'string', url: 'string' } },
        { id: 'browser.bookmark.add', label: '保存当前网页书签', behavior: 'other', scope: 'item', paramsSchema: { tabId: 'string', url: 'string' } },
      ] }, { id: 'browser.view.tabs', search: { panel: 'tabs' }, description: '网页标签页概览' }],
      queryParams: {},
      description: '网页浏览页',
    },
  ],
  transitions: [
    {
      id: 'history.forward.home', from: [{ path: '/', search: { panel: null } }, { path: '/view', search: { panel: null } }], to: '/',
      search: {}, searchParams: {}, params: { tabId: 'string' }, mode: 'replace', label: '前进到已有首页历史',
      ui: { placement: 'topbar', icon: 'forward', gesture: 'tap', condition: { op: 'notEmpty', ref: 'tabs', filterFn: 'tab => Boolean(tab.history && Array.isArray(tab.history.entries) && Number.isInteger(tab.history.index) && tab.history.index + 1 < tab.history.entries.length)', text: 'Requires forward history in the active source tab.' } },
    },
    {
      id: 'history.forward.view', from: [{ path: '/', search: { panel: null } }, { path: '/view', search: { panel: null } }], to: '/view',
      search: {}, searchParams: {}, params: { tabId: 'string' }, mode: 'replace', label: '前进到已有网页历史',
      ui: { placement: 'topbar', icon: 'forward', gesture: 'tap', condition: { op: 'notEmpty', ref: 'tabs', filterFn: 'tab => Boolean(tab.history && Array.isArray(tab.history.entries) && Number.isInteger(tab.history.index) && tab.history.index + 1 < tab.history.entries.length)', text: 'Requires forward history in the active source tab.' } },
    },
    {
      id: 'tab.close.home', from: [{ path: '/', search: { panel: null } }, { path: '/view', search: { panel: null } }], to: '/',
      search: {}, searchParams: {}, params: { tabId: 'string' }, mode: 'replace',
      label: '关闭标签页并保留或显示首页', ui: { placement: 'topbar', icon: 'close', gesture: 'tap' },
    },
    {
      id: 'tab.close.view', from: [{ path: '/', search: { panel: null } }, { path: '/view', search: { panel: null } }], to: '/view',
      search: {}, searchParams: {}, params: { tabId: 'string' }, mode: 'replace',
      label: '关闭标签页并保留或显示网页', ui: { placement: 'topbar', icon: 'close', gesture: 'tap',
        condition: { op: 'notEmpty', ref: 'tabs', filterFn: 'tab => Boolean(tab.url)', text: 'Requires an existing document tab; not a cold-default route to a webpage.' },
      },
    },
    {
      id: 'tabs.open.home', from: { path: '/', search: { panel: null } }, to: '/', search: { panel: 'tabs' },
      searchParams: {}, mode: 'push', params: {}, label: '打开首页标签页概览', ui: { placement: 'topbar', icon: 'tabs', gesture: 'tap' },
    },
    {
      id: 'tabs.open.view', from: { path: '/view', search: { panel: null } }, to: '/view', search: { panel: 'tabs' },
      searchParams: {}, mode: 'push', params: {}, label: '打开网页标签页概览', ui: { placement: 'topbar', icon: 'tabs', gesture: 'tap' },
    },
    {
      id: 'view.open',
      from: ['/', '/view'],
      to: '/view',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开网页浏览页',
      ui: { placement: 'content', icon: 'search', gesture: 'tap' },
    },
    {
      id: 'home.open',
      from: ['/view', '/'],
      to: '/',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '返回浏览器首页',
      ui: { placement: 'tabbar', icon: 'home', gesture: 'tap' },
    },
  ],
  capabilities: {
    historyBack: true,
  },
} as const satisfies NavigationDeclaration;

export type TransitionId = typeof NAVIGATION_DECLARATION.transitions[number]['id'];
