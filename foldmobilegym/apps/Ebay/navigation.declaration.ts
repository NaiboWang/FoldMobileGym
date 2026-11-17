import type { NavigationDeclaration, ScrollContainerDeclaration } from './navigation.types';

const MAIN_SCROLL: ScrollContainerDeclaration[] = [
  { name: 'main', direction: 'vertical', description: 'Main Content Area' },
];

export const NAVIGATION_DECLARATION: NavigationDeclaration = {
  app: 'ebay',
  routes: [
    {
      path: '/',
      component: 'HomePage',
      params: {},
      entryPoint: 'home',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        {
          id: 'home.base',
          search: {},
          description: 'eBay 首页',
          actions: [
            { id: 'home.auth.login', label: '登录', behavior: 'other', description: '点击登录按钮' },
            { id: 'home.auth.register', label: '注册', behavior: 'other', description: '点击注册按钮' },
            { id: 'home.promo.getCoupon', label: '获取优惠券', behavior: 'other', description: '点击获取优惠券' }
          ]
        },
      ],
      queryParams: {},
      description: 'eBay 首页',
    },
    {
      path: '/me',
      component: 'MePage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        {
          id: 'me.base',
          search: {},
          description: '我的 eBay 页面',
          actions: [
            { id: 'me.auth.login', label: '登录', behavior: 'other', description: '点击登录按钮' },
            { id: 'me.card.watchlist', label: '追踪列表', behavior: 'other', description: '点击追踪列表卡片' },
            { id: 'me.card.bids', label: '出价和议价', behavior: 'other', description: '点击出价和议价卡片' }
          ]
        },
      ],
      queryParams: {},
      description: '我的 eBay 页面',
    },
    {
      path: '/search',
      component: 'SearchPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        {
          id: 'search.base',
          search: {},
          description: '搜索页面',
          actions: [
             { id: 'search.history.clear', label: '清除记录', behavior: 'other', description: '清除最近搜索记录' }
          ]
        },
      ],
      queryParams: {},
      description: '搜索页面',
    },
    {
      path: '/sell',
      component: 'SellPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        {
          id: 'sell.base',
          search: {},
          description: '出售页面',
          actions: [
            { id: 'sell.auth.login', label: '登录', behavior: 'other', description: '点击登录按钮' },
            { id: 'sell.auth.register', label: '注册', behavior: 'other', description: '点击注册按钮' },
            { id: 'sell.info.learnMore', label: '了解详情', behavior: 'other', description: '点击了解详情' }
          ]
        },
      ],
      queryParams: {},
      description: '出售页面',
    },
    {
      path: '/inbox',
      component: 'InboxPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        {
          id: 'inbox.base',
          search: {},
          description: '收件箱页面',
        },
      ],
      queryParams: {},
      description: '收件箱页面',
    },
    {
      path: '/cart',
      component: 'CartPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        {
          id: 'cart.base',
          search: {},
          description: '购物车页面',
          actions: [
            { id: 'cart.item.remove', label: '从购物车移除商品', behavior: 'other', paramsSchema: { productId: 'string' } },
            { id: 'cart.checkout.preview', label: '查看结算说明', behavior: 'other' },
          ],
        },
      ],
      queryParams: {},
      description: '购物车页面',
    },
    {
      path: '/categories',
      component: 'CategoriesPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        {
          id: 'categories.base',
          search: {},
          description: '类别页面',
        },
      ],
      queryParams: {},
      description: '类别页面',
    },
    {
      path: '/settings',
      component: 'SettingsPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        {
          id: 'settings.base',
          search: {},
          description: '设置页面',
        },
      ],
      queryParams: {},
      description: '设置页面',
    },
    {
      path: '/item/:id',
      component: 'ItemDetailPage',
      params: { id: 'string' },
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        {
          id: 'item.base',
          search: {},
          description: '商品详情页',
          actions: [
            { id: 'item.cart.add', label: '添加至购物车', behavior: 'other', paramsSchema: { productId: 'string' } },
            { id: 'item.purchase.preview', label: '查看立即购买提示', behavior: 'other', paramsSchema: { productId: 'string' } },
            { id: 'item.offer.preview', label: '查看议价提示', behavior: 'other', paramsSchema: { productId: 'string' } },
            { id: 'item.watchlist.toggle', label: '切换追踪状态', behavior: 'other', paramsSchema: { productId: 'string' } },
          ]
        },
      ],
      queryParams: {},
      description: '商品详情页',
    }
  ],

  transitions: [
    {
      id: 'cart.item.open',
      from: '/cart',
      to: '/item/:id',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { id: 'string' },
      label: '从购物车打开商品',
      ui: { placement: 'content', icon: 'item', gesture: 'tap' },
    },
    // =========================
    // Global Header Actions
    // =========================
    {
      id: 'cart.open',
      from: ['/', '/me', '/search', '/sell', '/item/:id'],
      to: '/cart',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开购物车',
      ui: { placement: 'topbar', icon: 'shopping-cart', gesture: 'tap' }
    },

    // =========================
    // Tab switching
    // =========================
    {
      id: 'tab.home',
      from: ['/me', '/search', '/sell', '/inbox'],
      to: '/',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到首页',
      ui: { placement: 'tabbar', icon: 'home', gesture: 'tap' }
    },
    {
      id: 'tab.me',
      from: ['/', '/search', '/sell', '/inbox'],
      to: '/me',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到我的页面',
      ui: { placement: 'tabbar', icon: 'user', gesture: 'tap' }
    },
    {
      id: 'tab.search',
      from: ['/', '/me', '/sell', '/inbox'],
      to: '/search',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到搜索页面',
      ui: { placement: 'tabbar', icon: 'search', gesture: 'tap' }
    },
    {
      id: 'tab.inbox',
      from: ['/', '/me', '/search', '/sell'],
      to: '/inbox',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到收件箱页面',
      ui: { placement: 'tabbar', icon: 'bell', gesture: 'tap' }
    },
    {
      id: 'tab.sell',
      from: ['/', '/me', '/search', '/inbox'],
      to: '/sell',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到出售页面',
      ui: { placement: 'tabbar', icon: 'tag', gesture: 'tap' }
    },
    
    // =========================
    // Home Page Transitions
    // =========================
    {
      id: 'home.search.open',
      from: '/',
      to: '/search',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '点击搜索栏',
      ui: { placement: 'topbar', icon: 'search', gesture: 'tap' }
    },
    {
      id: 'home.quick_filter.sell',
      from: '/',
      to: '/sell',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '点击出售快捷筛选',
      ui: { placement: 'content', icon: 'tag', gesture: 'tap' }
    },
    {
      id: 'home.quick_filter.categories',
      from: '/',
      to: '/categories',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开类别页',
      ui: { placement: 'content', icon: 'grid', gesture: 'tap' }
    },
    {
      id: 'me.settings.open',
      from: '/me',
      to: '/settings',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开设置',
      ui: { placement: 'content', icon: 'settings', gesture: 'tap' }
    },
    {
      id: 'search.item.open',
      from: '/search',
      to: '/item/:id',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { id: 'string' },
      label: '打开商品详情',
      ui: { placement: 'content', icon: 'package', gesture: 'tap' }
    },
    {
      id: 'home.item.open',
      from: '/',
      to: '/item/:id',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { id: 'string' },
      label: '打开商品详情',
      ui: { placement: 'content', icon: 'package', gesture: 'tap' }
    }
  ],

  capabilities: {
    historyBack: true,
  },
};
