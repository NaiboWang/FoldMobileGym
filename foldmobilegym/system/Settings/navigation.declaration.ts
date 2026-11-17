/**
 * Settings 导航声明（用于静态分析 / 任务生成）
 *
 * 注意：
 * - Settings 历史上使用过自定义结构的 navigation.declaration.ts，脚本无法识别。
 * - 这里统一为标准 NAVIGATION_DECLARATION（与其它 App 一致），以便 `build_nav_artifacts.mjs` 工作。
 */

const MAIN_SCROLL = [
  { name: 'main', direction: 'vertical', description: '页面主内容区' },
  { name: 'master', direction: 'vertical', description: 'Expanded settings directory' },
] as const;

export const NAVIGATION_DECLARATION = {
  app: 'settings',
  routes: [
    {
      path: '/',
      component: 'SettingsMainPage',
      params: {},
      entryPoint: 'home',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'settings.main.base', search: {}, description: '设置首页' }],
      queryParams: {},
      description: '设置首页',
    },
    {
      path: '/search',
      component: 'SettingsSearchPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'settings.search.base', search: {}, description: '设置搜索页' }],
      queryParams: {},
      description: '设置搜索页',
    },
    {
      path: '/search/:pageId',
      component: 'PreferenceScreenPage',
      params: { pageId: 'string' },
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        { id: 'settings.searchDetail.base', search: {}, description: '搜索结果详情页' },
        {
          id: 'settings.searchDetail.inputMethod',
          search: { sheet: 'input-method' },
          description: '搜索结果详情中的默认输入法对话框',
          actions: [
            { id: 'settings.search.inputMethod.select.sogou', label: '选择搜狗输入法', behavior: 'select' },
            { id: 'settings.search.inputMethod.select.sogouHonor', label: '选择搜狗输入法荣耀版', behavior: 'select' },
            { id: 'settings.search.inputMethod.select.baiduHonor', label: '选择百度输入法荣耀版', behavior: 'select' },
          ],
        },
      ],
      queryParams: {},
      description: '设置搜索结果详情页',
    },
    {
      path: '/page/:pageId',
      component: 'PreferenceScreenPage',
      params: { pageId: 'string' },
      entryPoint: 'deepLink',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        { id: 'settings.page.base', search: {}, description: '设置详情页' },
        {
          id: 'settings.page.inputMethod',
          search: { sheet: 'input-method' },
          description: '默认输入法对话框',
          actions: [
            { id: 'settings.page.inputMethod.select.sogou', label: '选择搜狗输入法', behavior: 'select' },
            { id: 'settings.page.inputMethod.select.sogouHonor', label: '选择搜狗输入法荣耀版', behavior: 'select' },
            { id: 'settings.page.inputMethod.select.baiduHonor', label: '选择百度输入法荣耀版', behavior: 'select' },
          ],
        },
      ],
      queryParams: {},
      description: '设置详情页',
    },
  ],
  transitions: [
    {
      id: 'search.open',
      from: ['/', '/page/:pageId'],
      to: '/search',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开设置搜索',
      ui: { placement: 'topbar', icon: 'search', gesture: 'tap' },
    },
    {
      id: 'page.open',
      from: ['/', '/page/:pageId', '/search/:pageId'],
      to: '/page/:pageId',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { pageId: 'string' },
      label: '打开设置项详情',
      ui: { placement: 'content', icon: 'page', gesture: 'tap' },
    },
    {
      id: 'settings.search.result.open',
      from: ['/search', '/search/:pageId'],
      to: '/search/:pageId',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { pageId: 'string' },
      label: '在搜索目录旁打开设置详情',
      ui: { placement: 'content', icon: 'page', gesture: 'tap' },
    },
    {
      id: 'settings.page.inputMethod.open',
      from: { path: '/page/:pageId', search: { sheet: null } },
      to: '/page/:pageId',
      search: { sheet: 'input-method' },
      searchParams: {},
      mode: 'push',
      params: { pageId: 'string' },
      label: '打开默认输入法对话框',
      ui: { placement: 'content', icon: 'keyboard', gesture: 'tap' },
    },
    {
      id: 'settings.search.inputMethod.open',
      from: { path: '/search/:pageId', search: { sheet: null } },
      to: '/search/:pageId',
      search: { sheet: 'input-method' },
      searchParams: {},
      mode: 'push',
      params: { pageId: 'string' },
      label: '从搜索详情打开默认输入法对话框',
      ui: { placement: 'content', icon: 'keyboard', gesture: 'tap' },
    },
  ],
  capabilities: {
    historyBack: true,
  },
} as const;

export type TransitionId = typeof NAVIGATION_DECLARATION.transitions[number]['id'];
