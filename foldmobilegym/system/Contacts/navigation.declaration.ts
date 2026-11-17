import type { NavigationDeclaration, ScrollContainerDeclaration } from './navigation.types';

const MAIN_SCROLL: ScrollContainerDeclaration[] = [
  { name: 'main', direction: 'vertical', description: '主滚动区域' },
];

export const NAVIGATION_DECLARATION = {
  app: 'contacts',

  routes: [
    // =========================
    // Main tabs (bottom navigation)
    // =========================
    {
      path: '/',
      component: 'CallsPage',
      params: {},
      entryPoint: 'home',
      scrollContainers: [...MAIN_SCROLL, { name: 'dialpad', direction: 'vertical', description: '拨号盘' }],
      uiStates: [
        { id: 'calls.base', search: {}, description: '通话-通话记录列表' },
        { id: 'calls.dialpad', search: { dialpad: 'true' }, description: '通话-拨号盘浮层', actions: [
          { id: 'contacts.dialpad.digit.append', label: '输入拨号字符', behavior: 'other', paramsSchema: { digit: 'string' } },
          { id: 'contacts.dialpad.digit.remove', label: '删除末尾拨号字符', behavior: 'other' },
          { id: 'contacts.dialpad.sms.open', label: '给拨号号码写短信', behavior: 'other', paramsSchema: { number: 'string' } },
        ] },
      ],
      queryParams: { number: 'string' },
      description: '通话',
    },
    {
      path: '/contacts',
      component: 'ContactsPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [
        { id: 'phoneContacts.base', search: {}, description: '联系人-列表' },
        { id: 'phoneContacts.favorites', search: { fav: 'true' }, description: '联系人-收藏筛选' },
      ],
      queryParams: {},
      description: '联系人',
    },
    {
      path: '/contacts/choose-existing', component: 'ChooseExistingContactPage', params: {}, entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'chooseExisting.base', search: {}, description: '选择要添加号码的联系人' }],
      queryParams: { number: 'string', from: 'string' }, description: '选择已有联系人',
    },
    {
      path: '/calling', component: 'SimulatedCallPage', params: {}, entryPoint: 'none',
      scrollContainers: [], uiStates: [{ id: 'simulatedCall.base', search: {}, description: '本地模拟呼叫界面，不进行真实通话' }],
      queryParams: { number: 'string', slot: 'number' }, description: '模拟呼叫',
    },
    // =========================
    // Search
    // =========================
    {
      path: '/search',
      component: 'SearchPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'search.base', search: {}, description: '联系人-搜索' }],
      queryParams: { q: 'string' },
      description: '搜索',
    },

    // =========================
    // Details
    // =========================
    {
      path: '/contact/:contactId',
      component: 'ContactMasterDetailRoute',
      params: { contactId: 'string' },
      entryPoint: 'deepLink',
      scrollContainers: [...MAIN_SCROLL, { name: 'directory', direction: 'vertical', description: '展开态联系人目录' }, { name: 'confirmation', direction: 'vertical', description: '删除确认' }, { name: 'menu', direction: 'vertical', description: '联系人操作' }, { name: 'smsNumbers', direction: 'vertical', description: 'Choose an original contact phone for a local message' }],
      uiStates: [
        { id: 'contactDetail.base', search: {}, description: '联系人详情', actions: [
          { id: 'contacts.contact.sms.open', label: '打开当前号码的短信编辑器', behavior: 'other', scope: 'item', paramsSchema: { contactId: 'string', number: 'string' } },
          { id: 'contacts.contact.email.open', label: '打开本地邮件编辑器', behavior: 'other', scope: 'item', paramsSchema: { contactId: 'string', email: 'string' } },
          { id: 'contacts.contact.favorite.toggle', label: '切换当前联系人收藏', behavior: 'toggle', scope: 'item', paramsSchema: { contactId: 'string' } },
        ] },
        { id: 'contactDetail.qr', search: { modal: 'qr' }, description: '联系人二维码' },
        { id: 'contactDetail.menu', search: { menu: 'more' }, description: '联系人操作菜单' },
        { id: 'contactDetail.smsPicker', search: { modal: 'sms' }, description: 'Choose a phone before opening SMS', actions: [
          { id: 'contacts.contact.sms.choose', label: 'Open a local composer for this original phone', behavior: 'other', scope: 'item', paramsSchema: { contactId: 'string', phoneId: 'string', number: 'string' } },
        ] },
        { id: 'contactDetail.delete', search: { modal: 'delete' }, description: '确认删除当前联系人', actions: [
          { id: 'contacts.contact.delete.submit', label: '确认删除当前联系人', behavior: 'submit', scope: 'item', paramsSchema: { contactId: 'string' } },
        ] },
      ],
      queryParams: { q: 'string', fav: 'string' },
      description: '联系人详情',
    },
    {
      path: '/call/:callLogId',
      component: 'CallMasterDetailRoute',
      params: { callLogId: 'string' },
      entryPoint: 'deepLink',
      scrollContainers: [...MAIN_SCROLL, { name: 'directory', direction: 'vertical', description: '展开态通话目录' }],
      uiStates: [{ id: 'callDetail.base', search: {}, description: '通话详情', actions: [
        { id: 'contacts.call.sms.open', label: '给通话记录号码写短信', behavior: 'other', scope: 'item', paramsSchema: { callLogId: 'string', number: 'string' } },
      ] }],
      queryParams: {},
      description: '通话详情',
    },

    // =========================
    // Contacts flow
    // =========================
    {
      path: '/contacts/new',
      component: 'NewContactPage',
      params: {},
      entryPoint: 'none',
      scrollContainers: [...MAIN_SCROLL, { name: 'discard', direction: 'vertical', description: '放弃编辑确认' }],
      uiStates: [{ id: 'contactNew.base', search: {}, description: '新建联系人', actions: [
          { id: 'contacts.new.field.input', label: '编辑联系人字段', behavior: 'input', paramsSchema: { field: 'string', value: 'string' } },
          { id: 'contacts.new.phone.add', label: '添加电话号码', behavior: 'other' },
          { id: 'contacts.new.phone.remove', label: '移除电话号码', behavior: 'other', paramsSchema: { id: 'string' } },
          { id: 'contacts.new.phone.primary', label: '设置默认电话', behavior: 'other', paramsSchema: { id: 'string' } },
          { id: 'contacts.new.email.add', label: '添加邮箱', behavior: 'other' },
          { id: 'contacts.new.email.remove', label: '移除邮箱', behavior: 'other', paramsSchema: { id: 'string' } },
          { id: 'contacts.new.email.primary', label: '设置默认邮箱', behavior: 'other', paramsSchema: { id: 'string' } },
          { id: 'contacts.new.save.submit', label: '保存联系人', behavior: 'submit' }
      ] }, { id: 'contactNew.discard', search: { modal: 'discard' }, description: '放弃新建联系人', actions: [
        { id: 'contacts.new.discard.submit', label: '放弃新建联系人', behavior: 'submit' },
      ] }],
      queryParams: { number: 'string' },
      description: '新建联系人',
    },

    {
      path: '/contact/:contactId/edit', component: 'NewContactPage', params: { contactId: 'string' }, entryPoint: 'deepLink',
      scrollContainers: [...MAIN_SCROLL, { name: 'discard', direction: 'vertical', description: '放弃编辑确认' }],
      uiStates: [{ id: 'contactEdit.base', search: {}, description: '编辑联系人', actions: [
          { id: 'contacts.edit.field.input', label: '编辑联系人字段', behavior: 'input', paramsSchema: { field: 'string', value: 'string' } },
          { id: 'contacts.edit.phone.add', label: '添加电话号码', behavior: 'other' },
          { id: 'contacts.edit.phone.remove', label: '移除电话号码', behavior: 'other', paramsSchema: { id: 'string' } },
          { id: 'contacts.edit.phone.primary', label: '设置默认电话', behavior: 'other', paramsSchema: { id: 'string' } },
          { id: 'contacts.edit.email.add', label: '添加邮箱', behavior: 'other' },
          { id: 'contacts.edit.email.remove', label: '移除邮箱', behavior: 'other', paramsSchema: { id: 'string' } },
          { id: 'contacts.edit.email.primary', label: '设置默认邮箱', behavior: 'other', paramsSchema: { id: 'string' } },
          { id: 'contacts.edit.save.submit', label: '保存联系人', behavior: 'submit' }
      ] }, { id: 'contactEdit.discard', search: { modal: 'discard' }, description: '放弃联系人更改', actions: [
        { id: 'contacts.edit.discard.submit', label: '放弃联系人更改', behavior: 'submit' },
      ] }], queryParams: { fav: 'string', q: 'string', from: 'string', number: 'string' }, description: '编辑联系人',
    },

    // =========================
    // Settings (from decompiled preference_*.xml)
    // =========================
    {
      path: '/settings/calls',
      component: 'PhoneSettingsHomePage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'dialerSettings.base', search: {}, description: '电话设置-通话' }],
      queryParams: {},
      description: '电话设置（通话）',
    },
    {
      path: '/settings/contacts',
      component: 'PhoneSettingsHomePage',
      params: {},
      entryPoint: 'none',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'contactsSettings.base', search: {}, description: '电话设置-联系人' }],
      queryParams: {},
      description: '电话设置（联系人）',
    },
    {
      path: '/settings/page/:pageId',
      component: 'PhonePreferenceScreenPage',
      params: { pageId: 'string' },
      entryPoint: 'deepLink',
      scrollContainers: MAIN_SCROLL,
      uiStates: [{ id: 'phonePref.base', search: {}, description: '电话设置-偏好页' }],
      queryParams: {},
      description: '电话设置-偏好页',
    },
  ],

  transitions: [
    {
      id: 'call.dial.open', from: '/call/:callLogId', to: '/', params: {},
      search: { dialpad: 'true' }, searchParams: { number: 'string' }, mode: 'push',
      label: '打开通话记录号码的拨号盘', ui: { placement: 'content', icon: 'call', gesture: 'tap' },
    },
    {
      id: 'contact.dial.open', from: { path: '/contact/:contactId', search: { modal: null } },
      to: '/', params: {}, search: { dialpad: 'true' }, searchParams: { number: 'string' }, mode: 'push',
      label: '打开当前号码的拨号盘', ui: { placement: 'content', icon: 'call', gesture: 'tap' },
    },
    { id: 'dialpad.contact.new', from: { path: '/', search: { dialpad: 'true' } }, to: '/contacts/new',
      params: {}, search: {}, searchParams: { number: 'string' }, mode: 'push',
      label: '从拨号盘新建联系人', ui: { placement: 'content', icon: 'add', gesture: 'tap' } },
    { id: 'dialpad.contact.existing', from: { path: '/', search: { dialpad: 'true' } }, to: '/contacts/choose-existing',
      params: {}, search: {}, searchParams: { number: 'string' }, mode: 'push',
      label: '从拨号盘选择已有联系人', ui: { placement: 'content', icon: 'contact', gesture: 'tap' } },
    { id: 'contact.existing.edit', from: '/contacts/choose-existing', to: '/contact/:contactId/edit',
      params: { contactId: 'string' }, search: { from: 'dialpad' }, searchParams: { number: 'string' }, mode: 'push',
      label: '编辑已有联系人的新增号码', ui: { placement: 'content', icon: 'contact', gesture: 'tap' } },
    { id: 'contact.existing.picker.return', from: '/contact/:contactId/edit', to: '/contacts/choose-existing',
      params: {}, search: {}, searchParams: { number: 'string' }, mode: 'replace',
      label: '返回选择已有联系人', ui: { placement: 'topbar', icon: 'back', gesture: 'tap' } },
    { id: 'dialpad.simulatedCall.open', from: { path: '/', search: { dialpad: 'true' } }, to: '/calling',
      params: {}, search: {}, searchParams: { number: 'string', slot: 'number' }, mode: 'push',
      label: '打开本地模拟呼叫界面', ui: { placement: 'content', icon: 'call', gesture: 'tap' } },
    // =========================
    // Main tab switching (bottom nav)
    // =========================
    {
      id: 'tab.calls',
      from: [{ path: '/', search: { dialpad: null } }, '/contacts',
        { path: '/contact/:contactId', search: { menu: null, modal: null } }, '/call/:callLogId'],
      to: '/',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到通话',
      ui: { placement: 'tabbar', icon: 'tab_calls', gesture: 'tap' },
    },
    {
      id: 'tab.contacts',
      from: [{ path: '/', search: { dialpad: null } }, '/contacts',
        { path: '/contact/:contactId', search: { menu: null, modal: null } }, '/call/:callLogId'],
      to: '/contacts',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到联系人',
      ui: { placement: 'tabbar', icon: 'tab_contacts', gesture: 'tap' },
    },
    {
      id: 'tab.favorites',
      from: [{ path: '/', search: { dialpad: null } }, '/contacts',
        { path: '/contact/:contactId', search: { menu: null, modal: null } }, '/call/:callLogId'],
      to: '/contacts',
      search: { fav: 'true' },
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '切换到个人收藏',
      ui: { placement: 'tabbar', icon: 'tab_favorites', gesture: 'tap' },
    },

    // =========================
    // Dialpad overlay
    // =========================
    {
      id: 'dialpad.open',
      from: { path: '/', search: { dialpad: null } },
      to: '/',
      search: { dialpad: 'true' },
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开拨号盘',
      ui: { placement: 'fab', icon: 'dialpad', gesture: 'tap' },
    },

    // =========================
    // Contacts actions
    // =========================
    {
      id: 'contacts.favorites.on',
      from: '/contacts',
      to: '/contacts',
      search: { fav: 'true' },
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '筛选收藏联系人',
      ui: { placement: 'content', icon: 'favorite', gesture: 'tap' },
    },
    {
      id: 'contacts.favorites.off',
      from: '/contacts',
      to: '/contacts',
      search: { fav: null },
      searchParams: {},
      mode: 'replace',
      params: {},
      label: '退出收藏筛选',
      ui: { placement: 'content', icon: 'favorite_off', gesture: 'tap' },
    },
    {
      id: 'contact.new.open',
      from: ['/contacts', { path: '/contact/:contactId', search: { modal: null, menu: null } }],
      to: '/contacts/new',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '新建联系人',
      ui: { placement: 'fab', icon: 'add', gesture: 'tap' },
    },

    // =========================
    // Search / detail (placeholders for upcoming pages)
    // =========================
    {
      id: 'search.open',
      from: [{ path: '/', search: { dialpad: null } }, '/contacts'],
      to: '/search',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开搜索',
      ui: { placement: 'topbar', icon: 'search', gesture: 'tap' },
    },
    {
      id: 'contact.open',
      from: ['/contacts', '/search'],
      to: '/contact/:contactId',
      search: {},
      searchParams: {},
      preserveParams: ['fav'],
      mode: 'push',
      params: { contactId: 'string' },
      label: '打开联系人详情',
      ui: { placement: 'content', icon: 'contact', gesture: 'tap' },
    },
    {
      id: 'call.open',
      from: { path: '/', search: { dialpad: null } },
      to: '/call/:callLogId',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { callLogId: 'string' },
      label: '打开通话详情',
      ui: { placement: 'content', icon: 'call', gesture: 'tap' },
    },
    {
      id: 'contact.call.open',
      from: { path: '/contact/:contactId', search: { modal: null, menu: null } },
      to: '/call/:callLogId', search: {}, searchParams: {}, mode: 'push',
      params: { callLogId: 'string' }, label: 'Open the current contact call record',
      ui: { placement: 'content', icon: 'call', gesture: 'tap' },
    },
    {
      id: 'contact.switch',
      from: { path: '/contact/:contactId', search: { modal: null, menu: null } },
      to: '/contact/:contactId',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: { contactId: 'string' },
      preserveParams: ['fav', 'q'],
      label: '切换联系人详情',
      ui: { placement: 'content', icon: 'contact', gesture: 'tap' },
    },
    {
      id: 'contact.delete.open', from: { path: '/contact/:contactId', search: { modal: null, menu: null } }, to: '/contact/:contactId',
      params: { contactId: 'string' }, search: { modal: 'delete' }, searchParams: {}, preserveParams: ['fav', 'q'], mode: 'push',
      label: '打开删除联系人确认', ui: { placement: 'content', icon: 'delete', gesture: 'tap' },
    },
    {
      id: 'contact.delete.finish', from: { path: '/contact/:contactId', search: { modal: 'delete' } }, to: '/contacts',
      params: {}, search: {}, searchParams: {}, preserveParams: ['fav'], mode: 'replace',
      label: '删除后返回联系人列表', ui: { placement: 'content', icon: 'delete', gesture: 'tap' },
    },
    { id: 'contact.sms.picker.open', from: { path: '/contact/:contactId', search: { modal: null, menu: null } }, to: '/contact/:contactId',
      params: { contactId: 'string' }, search: { modal: 'sms' }, searchParams: {}, preserveParams: ['fav', 'q'], mode: 'push',
      label: 'Choose a contact phone for a message', ui: { placement: 'content', icon: 'message', gesture: 'tap' } },
    { id: 'contact.menu.open', from: { path: '/contact/:contactId', search: { modal: null, menu: null } }, to: '/contact/:contactId',
      params: { contactId: 'string' }, search: { menu: 'more' }, searchParams: {}, preserveParams: ['fav', 'q'], mode: 'push',
      label: '打开联系人操作', ui: { placement: 'topbar', icon: 'more', gesture: 'tap' } },
    { id: 'contact.qr.open', from: { path: '/contact/:contactId', search: { modal: null, menu: null } }, to: '/contact/:contactId',
      params: { contactId: 'string' }, search: { modal: 'qr' }, searchParams: {}, preserveParams: ['fav', 'q'], mode: 'push',
      label: '显示联系人二维码', ui: { placement: 'topbar', icon: 'qrcode', gesture: 'tap' } },
    { id: 'contact.edit.open', from: [
      { path: '/contact/:contactId', search: { modal: null, menu: null } },
      { path: '/contact/:contactId', search: { modal: null, menu: 'more' } },
    ], to: '/contact/:contactId/edit',
      params: { contactId: 'string' }, search: {}, searchParams: {}, mode: 'replace',
      preserveParams: ['fav', 'q'], label: '编辑联系人', ui: { placement: 'content', icon: 'edit', gesture: 'tap' } },
    { id: 'contact.edit.finish', from: '/contact/:contactId/edit', to: '/contact/:contactId',
      params: { contactId: 'string' }, search: {}, searchParams: {}, preserveParams: ['fav', 'q'], mode: 'replace',
      label: '结束联系人编辑', ui: { placement: 'topbar', icon: 'done', gesture: 'tap' } },
    { id: 'contact.new.finish', from: '/contacts/new', to: '/contacts',
      params: {}, search: {}, searchParams: {}, mode: 'replace',
      label: '结束联系人新建', ui: { placement: 'topbar', icon: 'done', gesture: 'tap' } },
    { id: 'contact.new.discard.open', from: { path: '/contacts/new', search: { modal: null } }, to: '/contacts/new',
      params: {}, search: { modal: 'discard' }, searchParams: {}, preserveParams: ['number'], mode: 'push',
      label: '确认放弃新建联系人', ui: { placement: 'topbar', icon: 'close', gesture: 'tap' } },
    { id: 'contact.edit.discard.open', from: { path: '/contact/:contactId/edit', search: { modal: null } }, to: '/contact/:contactId/edit',
      params: { contactId: 'string' }, search: { modal: 'discard' }, searchParams: {}, preserveParams: ['fav', 'q', 'from', 'number'], mode: 'push',
      label: '确认放弃联系人更改', ui: { placement: 'topbar', icon: 'close', gesture: 'tap' } },
    {
      id: 'call.switch',
      from: '/call/:callLogId',
      to: '/call/:callLogId',
      search: {},
      searchParams: {},
      mode: 'replace',
      params: { callLogId: 'string' },
      label: '切换通话详情',
      ui: { placement: 'content', icon: 'call', gesture: 'tap' },
    },

    // =========================
    // Settings entry
    // =========================
    {
      id: 'settings.open.calls',
      from: { path: '/', search: { dialpad: null } },
      to: '/settings/calls',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开电话设置（通话）',
      ui: { placement: 'topbar', icon: 'settings', gesture: 'tap' },
    },
    {
      id: 'settings.open.contacts',
      from: '/contacts',
      to: '/settings/contacts',
      search: {},
      searchParams: {},
      mode: 'push',
      params: {},
      label: '打开电话设置（联系人）',
      ui: { placement: 'topbar', icon: 'settings', gesture: 'tap' },
    },
    {
      id: 'settings.page.open',
      from: ['/settings/calls', '/settings/contacts', '/settings/page/:pageId'],
      to: '/settings/page/:pageId',
      search: {},
      searchParams: {},
      mode: 'push',
      params: { pageId: 'string' },
      label: '打开设置子页',
      ui: { placement: 'content', icon: 'chevron', gesture: 'tap' },
    },
  ],

  capabilities: {
    historyBack: true,
  },
} as const satisfies NavigationDeclaration;

export type TransitionId = (typeof NAVIGATION_DECLARATION.transitions)[number]['id'];

