import type { NavigationDeclaration } from './navigation.types';

const MAIN_SCROLL = [
  { name: 'main', direction: 'vertical', description: '页面主内容区' },
] as const;

export const NAVIGATION_DECLARATION = {
  app: 'theme_store',
  routes: [
    {
      path: '/',
      component: 'ThemeStoreHomePage',
      params: {},
      entryPoint: 'home',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'themeStore.home.base', search: {}, description: '主题商店首页' }],
      queryParams: {},
      description: '主题商店首页',
    },
    {
      path: '/ranking',
      component: 'ThemeStoreRankingPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'themeStore.ranking.base', search: {}, description: '主题排行榜', actions: [{ id: 'themeStore.ranking.retry', label: '重试加载排行榜', behavior: 'other' }] }],
      queryParams: {},
      description: '主题排行榜',
    },
    {
      path: '/item/:kind/:id',
      component: 'StoreItemDetailPage',
      params: { kind: 'string', id: 'string' },
      entryPoint: 'deepLink',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'themeStore.item.base', search: {}, description: '主题详情页', actions: [
        { id: 'themeStore.item.theme.submit', label: '应用整套主题', behavior: 'submit', paramsSchema: { themeId: 'string' } },
        { id: 'themeStore.item.icons.submit', label: '只应用主题图标', behavior: 'submit', paramsSchema: { themeId: 'string' } },
        { id: 'themeStore.item.wallpaper.submit', label: '只应用主题壁纸', behavior: 'submit', paramsSchema: { themeId: 'string' } },
      ] }],
      queryParams: {},
      description: '主题详情页',
    },
  ],
  transitions: [
    {
      id: 'ranking.open',
      from: '/',
      to: '/ranking',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '打开主题排行榜',
      ui: { placement: 'tabbar', icon: 'ranking', gesture: 'tap' },
    },
    {
      id: 'home.open',
      from: '/ranking',
      to: '/',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '返回主题推荐首页',
      ui: { placement: 'tabbar', icon: 'home', gesture: 'tap' },
    },
    {
      id: 'item.open',
      from: ['/', '/ranking'],
      to: '/item/:kind/:id',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { kind: 'string', id: 'string' },
      label: '打开主题详情页',
      ui: { placement: 'content', icon: 'item', gesture: 'tap' },
    },
  ],
  capabilities: {
    historyBack: true,
  },
} as const satisfies NavigationDeclaration;

export type TransitionId = typeof NAVIGATION_DECLARATION.transitions[number]['id'];
