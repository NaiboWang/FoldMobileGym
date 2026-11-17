import type { NavigationDeclaration } from './navigation.types';
const MAIN_SCROLL = [{ name: 'main', direction: 'vertical', description: 'App Store content' }] as const;
const DETAIL_SCROLL = [...MAIN_SCROLL, { name: 'catalog', direction: 'vertical', description: 'Expanded app catalog sidebar' }] as const;
export const NAVIGATION_DECLARATION = {
  app: 'appstore',
  routes: [
    { path: '/', component: 'FeaturedPage', params: {}, entryPoint: 'home', scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'appstore.featured.base', search: {}, description: '精选' }], queryParams: {}, description: '精选页' },
    { path: '/apps', component: 'AppsPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'appstore.apps.base', search: {}, description: '应用列表' }], queryParams: {}, description: '应用列表' },
    { path: '/search', component: 'SearchPage', params: {}, entryPoint: 'none', scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'appstore.search.base', search: {}, description: '搜索', actions: [
        { id: 'appstore.search.query.input', label: '输入关键词', behavior: 'input', paramsSchema: { value: 'string' } },
      ] }], queryParams: { q: 'string' }, description: '搜索应用' },
    { path: '/app/:appId', component: 'DetailPage', params: { appId: 'string' }, entryPoint: 'deepLink', scrollContainers: DETAIL_SCROLL,
      uiStates: [{ id: 'appstore.detail.base', search: {}, description: '应用详情', actions: [
        { id: 'appstore.detail.item.open', label: '打开应用', behavior: 'other', scope: 'item', paramsSchema: { appId: 'string' } },
      ] }], queryParams: {}, description: '应用详情' },
  ],
  transitions: [
    { id: 'appstore.tab.featured', from: ['/apps', '/search'], to: '/', search: {}, searchParams: {}, params: {}, mode: 'replace', label: '精选', ui: { placement: 'tabbar', icon: 'sparkles', gesture: 'tap' } },
    { id: 'appstore.tab.apps', from: ['/', '/search'], to: '/apps', search: {}, searchParams: {}, params: {}, mode: 'replace', label: '应用', ui: { placement: 'tabbar', icon: 'grid', gesture: 'tap' } },
    { id: 'appstore.tab.search', from: ['/', '/apps'], to: '/search', search: {}, searchParams: {}, params: {}, mode: 'replace', label: '搜索', ui: { placement: 'tabbar', icon: 'search', gesture: 'tap' } },
    { id: 'appstore.search.results', from: { path: '/search', search: {} }, to: '/search', search: {}, searchParams: { q: 'string' }, params: {}, mode: 'replace', label: '搜索应用', ui: { placement: 'content', icon: 'search', gesture: 'tap' } },
    { id: 'appstore.item.detail', from: ['/', '/apps', '/search', '/app/:appId'], to: '/app/:appId', search: {}, searchParams: {}, params: { appId: 'string' }, mode: 'push', label: '应用详情', ui: { placement: 'content', icon: 'app', gesture: 'tap' } },
  ],
  capabilities: { historyBack: true },
} as const satisfies NavigationDeclaration;
export type TransitionId = typeof NAVIGATION_DECLARATION.transitions[number]['id'];
